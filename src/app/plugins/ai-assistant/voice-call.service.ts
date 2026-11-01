import { Injectable, OnDestroy, effect, inject, signal, untracked } from '@angular/core';
import { Subscription, timeout } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslationService } from '../../core/i18n/index';
import {
  ChatHistory,
  CallParticipant,
  ChatProvider,
} from '../../core/plugins/contracts/ai-assistant.service.contract';
import { AiAssistantService } from './ai-assistant.service';
import { ChatSpeechService } from './chat-speech.service';
import { LiveAudioService } from './live-audio.service';
import {
  AiConsentRequestEvent,
  CallSignalMessage, LivePacket,
  CallTransportHandle,
  ConversationRealtimeService,
} from './conversation-realtime.service';

interface PeerSlot {
  pc: RTCPeerConnection;
  audio: HTMLAudioElement;
  pendingCandidates: RTCIceCandidateInit[];
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

/**
 * Gestiona la llamada de voz grupal P2P WebRTC en malla sobre `/conversations`,
 * el permiso individual de escucha para Kanon y el audio nativo Gemini Live con texto incremental en el chat grupal.
 */
@Injectable()
export class VoiceCallService implements OnDestroy {
  private readonly api = inject(AiAssistantService);
  private readonly realtime = inject(ConversationRealtimeService);
  private readonly speech = inject(ChatSpeechService);
  readonly liveAudio = inject(LiveAudioService);
  readonly liveConnected = signal(false);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(TranslationService);
  private readonly toast = inject(ToastService, { optional: true });

  readonly consentModalDiagramId = signal<string | null>(null);
  readonly callScope = signal<'group' | 'personal'>('group');
  readonly inCall = signal(false);
  readonly joining = signal(false);
  readonly activeDiagramId = signal<string | null>(null);
  readonly muted = signal(false);
  readonly aiConsent = signal(false);
  readonly sendingAudio = signal(false);
  readonly localSpeaking = signal(false);
  readonly callLevels = signal<number[]>([16, 22, 30, 18, 36, 26, 20, 32, 24, 28, 19, 16]);
  readonly aiConsentRequest = signal<AiConsentRequestEvent | null>(null);
  readonly participants = signal<CallParticipant[]>([]);
  readonly error = signal('');
  readonly preferredProvider = signal<ChatProvider>('ollama');

  private transport?: CallTransportHandle;
  private roomWatcher?: Subscription;
  private localStream?: MediaStream;
  private meterContext?: AudioContext;
  private meterTimer?: ReturnType<typeof setInterval>;
  private readonly peers = new Map<string, PeerSlot>();
  private generation = 0;
  private destroyed = false;

  /** Mantiene salida y transcripción alineadas con los controles locales y evita transcribir a Kanon. */
  constructor() {
    effect(() => {
      const muted = this.speech.muted();
      untracked(() => {
        this.liveAudio.setMuted(muted);
        this.peers.forEach(peer => { peer.audio.muted = muted; });
      });
    });

  }

  /** Abre llamada privada 1-a-1 directa con Kanon en el ámbito personal. */
  async startPersonalCall(diagramId: string): Promise<void> {
    if (!diagramId || this.joining()) return;
    if (this.inCall() && this.activeDiagramId() === diagramId && this.callScope() === 'personal') return;
    this.callScope.set('personal');
    await this.confirmJoin(true, 'personal', diagramId);
  }

  /** Abre el diálogo de consentimiento explícito de Kanon antes de entrar a la llamada del diagrama. */
  promptJoin(diagramId: string): void {
    if (!diagramId || this.joining()) return;
    if (this.inCall() && this.activeDiagramId() === diagramId) return;
    this.callScope.set('group');
    this.error.set('');
    this.consentModalDiagramId.set(diagramId);
  }

  /** Cancela el diálogo de consentimiento sin activar el micrófono. */
  cancelJoinPrompt(): void {
    this.consentModalDiagramId.set(null);
  }

  /** Responde a una solicitud colectiva de consentimiento para que Kanon entre a la llamada grupal. */
  respondAiConsent(allowed: boolean): void {
    const req = this.aiConsentRequest();
    const diagramId = req?.diagramId || this.activeDiagramId();
    this.aiConsentRequest.set(null);
    if (!diagramId || !this.transport) return;
    this.transport.emit('call_ai_consent_response', { diagramId, allowed });
  }

  /** Une al participante a la llamada respetando su elección explícita de permiso para Kanon y el ámbito. */
  async confirmJoin(allowKanon: boolean, forcedScope?: 'group' | 'personal', explicitDiagramId?: string): Promise<void> {
    const diagramId = explicitDiagramId || this.consentModalDiagramId();
    this.consentModalDiagramId.set(null);
    if (!diagramId || this.joining()) return;
    if (forcedScope) this.callScope.set(forcedScope);

    if (this.inCall()) {
      this.leaveCall();
    }

    const gen = ++this.generation;
    this.joining.set(true);
    this.error.set('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (this.destroyed || gen !== this.generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      this.localStream = stream;
      this.activeDiagramId.set(diagramId);
      this.muted.set(false);
      this.aiConsent.set(this.callScope() === 'personal' ? true : allowKanon);
      this.inCall.set(true);

      await this.liveAudio.prepare();
      if (gen !== this.generation) return;
      this.startLocalMeter(stream, gen);
      this.startRoomSpeechWatcher(diagramId, gen);

      this.transport = this.realtime.acquireCallTransport(diagramId, {
        onReady: () => {
          if (gen === this.generation && this.inCall()) {
            void this.announceJoin(diagramId, gen);
          }
        },
        onParticipants: (list) => {
          if (gen !== this.generation || !this.inCall()) return;
          this.syncParticipants(diagramId, list);
        },
        onLive: packet => { if (gen === this.generation) this.handleLive(packet, gen); },
        onSignal: (signalMsg) => {
          if (gen !== this.generation || !this.inCall()) return;
          void this.handleSignal(diagramId, signalMsg);
        },
        onConsentRequest: (event) => {
          if (gen === this.generation && this.inCall()) {
            this.aiConsentRequest.set(event);
          }
        },
        onConsentDenied: (event) => {
          if (gen !== this.generation || !this.inCall()) return;
          this.aiConsentRequest.set(null);
          const text = this.i18n.t('chat.aiConsentDeniedToast', { name: event.deniedBy }) ||
            `${event.deniedBy} denegó la entrada de Kanon a la llamada grupal.`;
          this.toast?.warning(text);
          this.aiConsent.set(false);
          this.liveConnected.set(false);
          this.liveAudio.stopCapture();
        },
        onConsentApproved: () => {
          if (gen !== this.generation || !this.inCall()) return;
          this.aiConsentRequest.set(null);
          const text = this.i18n.t('chat.aiConsentApprovedToast') || 'Todos los participantes aceptaron. Kanon se ha unido a la llamada.';
          this.toast?.success(text);
          if (this.aiConsent() && !this.liveConnected()) {
            void this.startLive(diagramId, gen);
          }
        },
        onDisconnect: () => {
          if (gen !== this.generation) return;
          this.liveConnected.set(false);
          this.liveAudio.stopCapture();
          this.liveAudio.interrupt();
          this.closeAllPeers();
        },
      });


    } catch {
      this.error.set('chat.microphoneError');
      this.leaveCall();
    } finally {
      if (gen === this.generation) {
        this.joining.set(false);
      }
    }
  }

  /** Silencia o reactiva el micrófono local tanto para WebRTC como para la transcripción de Kanon. */
  toggleMute(): void {
    if (!this.inCall() || !this.localStream) return;
    const nextMuted = !this.muted();
    this.muted.set(nextMuted);
    if (nextMuted) this.localSpeaking.set(false);
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    const diagramId = this.activeDiagramId();
    if (diagramId) {
      this.transport?.emit('call_update_state', {
        diagramId,
        muted: nextMuted,
        aiConsent: this.aiConsent(),
      });

    }
  }

  /** Permite otorgar o revocar en caliente el permiso de escucha de Kanon durante la llamada. */
  toggleAiConsent(): void {
    if (!this.inCall()) return;
    const nextConsent = !this.aiConsent();
    this.aiConsent.set(nextConsent);
    if (!nextConsent) {
      this.liveConnected.set(false);
      this.liveAudio.stopCapture();
      this.transport?.emit('live_stop', {});
    }
    const diagramId = this.activeDiagramId();
    if (diagramId) {
      this.transport?.emit('call_update_state', {
        diagramId,
        muted: this.muted(),
        aiConsent: nextConsent,
      });
      if (nextConsent) void this.startLive(diagramId, this.generation);

    }
  }

  /** Cuelga la llamada liberando pistas de micrófono, conexiones P2P, audio Live y socket. */
  leaveCall(): void {
    const diagramId = this.activeDiagramId();
    this.generation++;
    this.liveConnected.set(false);
    this.liveAudio.close();
    clearInterval(this.meterTimer);
    void this.meterContext?.close().catch(() => undefined);
    this.meterContext = undefined;
    this.transport?.emit('live_stop', {});
    this.roomWatcher?.unsubscribe();
    this.roomWatcher = undefined;
    this.closeAllPeers();

    if (diagramId && this.transport) {
      this.transport.emit('call_leave', { diagramId });
    }
    this.transport?.release();
    this.transport = undefined;

    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = undefined;

    this.inCall.set(false);
    this.joining.set(false);
    this.activeDiagramId.set(null);
    this.participants.set([]);
    this.localSpeaking.set(false);
    this.sendingAudio.set(false);
    this.callLevels.set([16, 22, 30, 18, 36, 26, 20, 32, 24, 28, 19, 16]);
    this.aiConsentRequest.set(null);
    this.callScope.set('group');
  }

  /** Libera medios, conexiones y suscripciones al retirar el plug-in. */
  ngOnDestroy(): void {
    this.destroyed = true;
    this.leaveCall();
  }

  /** Registra la llamada después de que el transporte autenticado esté listo. */
  private async announceJoin(diagramId: string, gen: number): Promise<void> {
    if (!this.transport) return;
    try {
      const ack = await this.transport.emitWithAck<{
        success: boolean;
        participants?: CallParticipant[];
      }>('call_join', {
        diagramId,
        muted: this.muted(),
        aiConsent: this.aiConsent(),
        scope: this.callScope(),
      });
      const ackData = (ack as { data?: { success?: boolean; participants?: CallParticipant[] } })?.data;
      const success = Boolean(ack?.success ?? ackData?.success);
      const participants = Array.isArray(ack?.participants) ? ack.participants : ackData?.participants;
      if (gen === this.generation && success && Array.isArray(participants)) {
        this.syncParticipants(diagramId, participants);
        if (this.aiConsent()) await this.startLive(diagramId, gen);
      }
    } catch {
      // Si el socket aún está reconectando, onReady volverá a dispararse
    }
  }

  /** Mantiene sincronizada la malla RTCPeerConnection con los participantes activos en la sala. */
  private syncParticipants(diagramId: string, list: CallParticipant[]): void {
    this.participants.set(list);
    const mySocketId = this.transport?.getSocketId();
    if (!mySocketId) return;

    const activePeerSockets = new Set(
      list.filter((p) => p.socketId !== mySocketId).map((p) => p.socketId),
    );

    // Elimina pares desconectados
    for (const [socketId, slot] of this.peers.entries()) {
      if (!activePeerSockets.has(socketId)) {
        this.disposePeer(socketId, slot);
      }
    }

    // Crea conexiones hacia nuevos pares; el menor socketId lexicográfico inicia la oferta SDP
    for (const remoteSocketId of activePeerSockets) {
      if (!this.peers.has(remoteSocketId)) {
        const slot = this.createPeerSlot(diagramId, remoteSocketId);
        if (mySocketId < remoteSocketId) {
          void this.sendOffer(diagramId, remoteSocketId, slot);
        }
      }
    }
  }

  /** Crea un par WebRTC con el estado local del altavoz y señalización canónica. */
  private createPeerSlot(diagramId: string, remoteSocketId: string): PeerSlot {
    const existing = this.peers.get(remoteSocketId);
    if (existing) return existing;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    const audio = new Audio();
    audio.autoplay = true;
    audio.muted = this.speech.muted();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.transport?.emit('call_signal', {
          diagramId,
          targetSocketId: remoteSocketId,
          type: 'ice',
          data: event.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        audio.srcObject = remoteStream;
        void audio.play().catch(() => {});
      }
    };

    const slot: PeerSlot = { pc, audio, pendingCandidates: [] };
    this.peers.set(remoteSocketId, slot);
    return slot;
  }

  /** Publica una oferta SDP mediante el contrato de señalización del backend. */
  private async sendOffer(diagramId: string, remoteSocketId: string, slot: PeerSlot): Promise<void> {
    try {
      const offer = await slot.pc.createOffer();
      await slot.pc.setLocalDescription(offer);
      this.transport?.emit('call_signal', {
        diagramId,
        targetSocketId: remoteSocketId,
        type: 'offer',
        data: slot.pc.localDescription,
      });
    } catch {}
  }

  /** Aplica ofertas, respuestas y candidatos ICE recibidos del servidor autorizado. */
  private async handleSignal(diagramId: string, msg: CallSignalMessage): Promise<void> {
    const slot = this.createPeerSlot(diagramId, msg.fromSocketId);
    try {
      if (msg.type === 'offer' && msg.data) {
        await slot.pc.setRemoteDescription(new RTCSessionDescription(msg.data as RTCSessionDescriptionInit));
        await this.flushCandidates(slot);
        const answer = await slot.pc.createAnswer();
        await slot.pc.setLocalDescription(answer);
        this.transport?.emit('call_signal', {
          diagramId,
          targetSocketId: msg.fromSocketId,
          type: 'answer',
          data: slot.pc.localDescription,
        });
      } else if (msg.type === 'answer' && msg.data) {
        await slot.pc.setRemoteDescription(new RTCSessionDescription(msg.data as RTCSessionDescriptionInit));
        await this.flushCandidates(slot);
      } else if (msg.type === 'ice' && msg.data) {
        if (slot.pc.remoteDescription) {
          await slot.pc.addIceCandidate(new RTCIceCandidate(msg.data as RTCIceCandidateInit));
        } else {
          slot.pendingCandidates.push(msg.data as RTCIceCandidateInit);
        }
      }
    } catch {}
  }

  private async flushCandidates(slot: PeerSlot): Promise<void> {
    while (slot.pendingCandidates.length) {
      const candidate = slot.pendingCandidates.shift()!;
      try {
        await slot.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {}
    }
  }

  private closeAllPeers(): void {
    for (const [socketId, slot] of this.peers.entries()) {
      this.disposePeer(socketId, slot);
    }
  }

  private disposePeer(socketId: string, slot: PeerSlot): void {
    this.peers.delete(socketId);
    slot.pc.onicecandidate = null;
    slot.pc.ontrack = null;
    try {
      slot.pc.close();
    } catch {}
    slot.audio.pause();
    slot.audio.srcObject = null;
  }

  /** Consume snapshots push; serializa el respaldo HTTP y cancela la lectura al colgar. */
  private startRoomSpeechWatcher(diagramId: string, gen: number): void {
    this.roomWatcher?.unsubscribe();
    const owner = new Subscription();
    this.roomWatcher = owner;
    let revision = -1;
    let inFlight = false;
    let refreshPending = false;
    let initialized = false;
    const targetScope = this.callScope();
    const accept = (page: ChatHistory) => {
      if (gen !== this.generation || !this.inCall() || page.revision <= revision) return;
      revision = page.revision;
      if (!initialized) {
        this.speech.primeFloor(diagramId, page.messages, targetScope);
        initialized = true;
      }
      this.speech.observe(diagramId, page.messages,
        { inCall: true, currentUserId: this.auth.currentUser()?.id || null }, targetScope);
    };
    const refresh = () => {
      if (inFlight) { refreshPending = true; return; }
      inFlight = true;
      const finish = () => {
        inFlight = false;
        if (refreshPending && !owner.closed) { refreshPending = false; refresh(); }
      };
      owner.add(this.api.history(diagramId, undefined, targetScope).pipe(timeout(20000)).subscribe({
        next: accept, error: finish, complete: finish,
      }));
    };
    owner.add(this.realtime.watch(diagramId).subscribe(notice => {
      if (gen !== this.generation || !this.inCall() || notice.kind === 'offline' || notice.kind === 'live' || notice.kind === 'call_started') return;
      if (notice.kind === 'changed' && notice.scope && notice.scope !== targetScope) return;
      if (notice.kind === 'changed' && notice.snapshot) {
        accept(notice.snapshot);
        if (notice.revision === undefined || notice.snapshot.revision >= notice.revision) return;
      }
      refresh();
    }));
    refresh();
    const timer = setInterval(refresh, 30000);
    owner.add(() => clearInterval(timer));
  }

  /** Solicita una sesión Live después del alta autorizada en la llamada. */
  private async startLive(diagramId: string, gen: number): Promise<void> {
    try {
      const result = await this.transport?.emitWithAck<{ success: boolean; pendingConsent?: boolean }>('live_start', {
        diagramId,
        language: this.i18n.currentLang() === 'en' ? 'en' : 'es',
        scope: this.callScope(),
      });
      const ackData = (result as { data?: { success?: boolean; pendingConsent?: boolean } })?.data;
      const success = Boolean(result?.success ?? ackData?.success);
      const pendingConsent = Boolean(result?.pendingConsent ?? ackData?.pendingConsent);
      if (gen === this.generation && !success && !pendingConsent) this.error.set('chat.liveUnavailable');
    } catch {
      if (gen === this.generation) this.error.set('chat.liveUnavailable');
    }
  }

  /** Consume audio nativo y controla captura, interrupción y fallos sin volver al circuito de clips. */
  private handleLive(packet: LivePacket, gen: number): void {
    if (!this.inCall()) return;
    if (packet.type === 'ready' && this.aiConsent() && this.localStream) {
      this.liveConnected.set(true);
      this.error.set('');
      void this.liveAudio.capture(this.localStream, data => {
        if (gen === this.generation && this.liveConnected() && this.aiConsent() && !this.muted()) {
          this.transport?.emit('live_audio', { data });
        }
      }).catch(() => {
        if (gen !== this.generation) return;
        this.error.set('chat.liveUnavailable');
        this.liveConnected.set(false);
        this.transport?.emit('live_stop', {});
      });
    } else if (packet.type === 'audio' && packet.data && packet.sampleRate === 24000) {
      try { this.liveAudio.play(packet.data, packet.sourceSocketId ?? 'kanon'); }
      catch { this.liveAudio.interrupt(); this.error.set('chat.liveUnavailable'); }
    } else if (packet.type === 'interrupted') {
      this.liveAudio.interrupt(packet.sourceSocketId);
    } else if (packet.type === 'error' || packet.type === 'closed') {
      this.liveConnected.set(false);
      this.liveAudio.stopCapture();
      if (packet.type === 'error') this.error.set('chat.liveUnavailable');
    }
  }

  /** Mide actividad local para la animación; el audio de IA se envía por AudioWorklet. */
  private startLocalMeter(stream: MediaStream, gen: number): void {
    try {
      const context = new AudioContext();
      this.meterContext = context;
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      this.meterTimer = setInterval(() => {
        if (gen !== this.generation || !this.inCall()) return;
        analyser.getByteFrequencyData(data);
        const average = data.reduce((total, value) => total + value, 0) / data.length;
        const isSpeaking = !this.muted() && average > 18;
        this.localSpeaking.set(isSpeaking);

        const bars = Array.from({ length: 12 }, (_, idx) => {
          if (this.liveAudio.playing()) {
            const t = Date.now() / 120;
            const val = Math.sin(t + idx * 0.7) * 35 + 50;
            return Math.max(16, Math.min(100, Math.round(val)));
          }
          if (this.muted()) return 14;
          const sample = data[Math.min(idx + 1, data.length - 1)] || 0;
          return Math.max(14, Math.min(100, Math.round((sample / 255) * 92 + 12)));
        });
        this.callLevels.set(bars);
      }, 75);
    } catch { /* El medidor es opcional; el transporte de audio informa sus propios fallos. */ }
  }
}
