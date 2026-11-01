import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { TranslatePipe, TranslationService } from '../../../core/i18n/index';
import {
  ChatAttachment,
  ChatMessage,
  ChatProvider,
  ChatScope,
} from '../../../core/plugins/contracts/ai-assistant.service.contract';
import { ConversationStateService } from '../conversation-state.service';
import { ChatSpeechService } from '../chat-speech.service';
import { ChatMediaService } from '../chat-media.service';
import { AiAssistantService } from '../ai-assistant.service';
import { VoiceCallService } from '../voice-call.service';
import { AiAssistantCoordinatorService } from '../ai-assistant-coordinator.service';
import { ChatMarkdownComponent } from '../chat-markdown.component';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroArrowsPointingIn,
  heroArrowsPointingOut,
  heroAtSymbol,
  heroCamera,
  heroChatBubbleLeftRight,
  heroCheck,
  heroChevronDown,
  heroChevronLeft,
  heroChevronRight,
  heroClipboard,
  heroMicrophone,
  heroPaperAirplane,
  heroPhone,
  heroPhoneXMark,
  heroPhoto,
  heroPlus,
  heroSparkles,
  heroSpeakerWave,
  heroSpeakerXMark,
  heroNoSymbol,
  heroStop,
  heroUser,
  heroUserGroup,
  heroXMark,
} from '@ng-icons/heroicons/outline';

const KANON_MENTION_RE = /(?:^|[^\w])@kanon\b/i;
const TRAILING_AT_QUERY_RE = /(?:^|\s)@(?:k(?:a(?:n(?:o(?:n)?)?)?)?)?$/i;

/**
 * Panel lateral de Kanon: gestiona los chats Personal y Grupal por diagrama, menciones `@Kanon`,
 * grabación reactiva estilo Gemini, llamada grupal WebRTC y revisión explícita de propuestas AST.
 */
@Component({
  selector: 'app-ai-assistant-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TranslatePipe, ChatMarkdownComponent, NgIconComponent],
  providers: [
    ConversationStateService,
    ChatMediaService,
    provideIcons({
      heroArrowsPointingIn,
      heroArrowsPointingOut,
      heroAtSymbol,
      heroCamera,
      heroChatBubbleLeftRight,
      heroCheck,
      heroChevronDown,
      heroChevronLeft,
      heroChevronRight,
      heroClipboard,
      heroMicrophone,
      heroPaperAirplane,
      heroPhone,
      heroPhoneXMark,
      heroPhoto,
      heroPlus,
      heroSparkles,
      heroSpeakerWave,
      heroSpeakerXMark,
      heroNoSymbol,
      heroStop,
      heroUser,
      heroUserGroup,
      heroXMark,
    }),
  ],
  templateUrl: './ai-assistant-panel.component.html',
  styleUrl: './ai-assistant-panel.component.css',
  host: {
    '[class.panel-expanded]': 'expanded()',
    '[style.--panel-width]': 'panelWidth() + "px"',
    '(document:pointerdown)': 'dismissMenus($event)',
    '(keydown.escape)': 'onEscape($event)',
  },
})
export class AiAssistantPanelComponent implements OnDestroy {
  readonly state = inject(ConversationStateService);
  readonly media = inject(ChatMediaService);
  readonly speech = inject(ChatSpeechService);
  /** Conserva la reproducción manual implementada, oculta temporalmente en la interfaz. */
  readonly showReplayControls = false;
  readonly voiceCall = inject(VoiceCallService, { optional: true });
  private readonly coordinator = inject(AiAssistantCoordinatorService, { optional: true });
  readonly hasMultipleCollaborators = computed(() => this.coordinator ? this.coordinator.hasMultipleCollaborators() : true);
  private readonly i18n = inject(TranslationService);
  readonly attachmentPlaying = signal(false);
  readonly auth = inject(AuthService);
  private readonly api = inject(AiAssistantService);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly expanded = signal(false);
  readonly panelWidth = signal(420);
  readonly menu = signal<'attachments' | 'models' | null>(null);
  private resizeStart: { x: number; width: number } | null = null;

  readonly isOpen = input(false);
  readonly diagramId = input<string | null>(null);
  readonly canEdit = input(false);
  readonly hasUnsavedChanges = input(false);
  readonly closePanel = output<void>();
  readonly proposalApplied = output<string>();

  readonly prompt = signal('');
  readonly provider = signal<ChatProvider>('ollama');
  readonly applying = signal<string | null>(null);
  readonly assets = signal<Record<string, string>>({});
  readonly error = signal('');

  readonly selectedModel = computed(() =>
    this.state.models()?.models.find((model) => model.provider === this.provider()),
  );
  readonly userDisplayName = computed(() => {
    const user = this.auth.currentUser() as { fullName?: string; name?: string; email?: string } | null;
    const raw = user?.fullName?.trim() || user?.name?.trim() || user?.email?.split('@')[0] || '';
    return raw ? raw.split(/\s+/)[0] : 'equipo';
  });
  readonly hasKanonMention = computed(() => KANON_MENTION_RE.test(this.prompt()));
  readonly showMentionAutocomplete = computed(
    () =>
      this.state.scope() === 'group' &&
      !this.hasKanonMention() &&
      TRAILING_AT_QUERY_RE.test(this.prompt()),
  );
  readonly isCallInCurrentDiagram = computed(
    () => !!this.voiceCall?.inCall() && this.voiceCall.activeDiagramId() === this.diagramId(),
  );

  @ViewChild('historyContainer') historyContainer?: ElementRef<HTMLDivElement>;
  private generation = 0;
  private lastSequence = 0;
  private handledOpenRequests = 0;
  private readonly loadingAssets = new Set<string>();

  /** Alterna el menú solicitado y mantiene un solo desplegable abierto. */
  toggleMenu(menu: 'attachments' | 'models'): void {
    this.menu.update((current) => (current === menu ? null : menu));
  }

  /** Selecciona un proveedor disponible sin reiniciar la conversación ni el borrador. */
  selectProvider(provider: ChatProvider): void {
    if (
      this.state.sending() ||
      !this.state.models()?.models.some((model) => model.provider === provider && model.available)
    ) {
      return;
    }
    this.provider.set(provider);
    this.voiceCall?.preferredProvider.set(provider);
    this.menu.set(null);
  }

  /** Alterna entre las pestañas Personal y Grupal dentro del mismo diagrama. */
  switchScope(scope: ChatScope): void {
    if (this.state.scope() === scope) return;
    this.lastSequence = 0;
    this.state.setScope(scope);
  }

  /** Inserta o enfoca la etiqueta `@Kanon` en el compositor del chat grupal. */
  insertKanonMention(): void {
    const current = this.prompt();
    if (KANON_MENTION_RE.test(current)) return;
    if (TRAILING_AT_QUERY_RE.test(current)) {
      this.prompt.set(current.replace(/@(?:k(?:a(?:n(?:o(?:n)?)?)?)?)?$/i, '@Kanon '));
      return;
    }
    const prefix = current.trim().length ? `${current.trimEnd()} @Kanon ` : '@Kanon ';
    this.prompt.set(prefix);
  }

  /** Solicita iniciar o unirse a la llamada (personal con Kanon o grupal con el equipo) del diagrama actual. */
  startOrJoinCall(): void {
    const id = this.diagramId();
    if (!id || !this.voiceCall) return;
    if (this.state.scope() === 'personal') {
      void this.voiceCall.startPersonalCall(id);
    } else {
      this.voiceCall.promptJoin(id);
    }
  }

  /** Cierra los desplegables al pulsar fuera de sus controles. */
  dismissMenus(event: Event): void {
    if (
      !(event.target instanceof Element) ||
      !this.element.nativeElement.contains(event.target) ||
      !event.target.closest('[data-chat-menu]')
    ) {
      this.menu.set(null);
    }
  }

  /** Cierra menús o restaura el ancho lateral sin propagar Escape al lienzo. */
  onEscape(event: Event): void {
    if (!this.menu() && !this.expanded()) return;
    event.stopPropagation();
    if (this.menu()) {
      this.element.nativeElement
        .querySelector<HTMLButtonElement>(`[data-menu-trigger="${this.menu()}"]`)
        ?.focus();
    }
    this.menu() ? this.menu.set(null) : this.expanded.set(false);
  }

  /** Cambia entre ancho compacto y ampliado conservando la instancia del chat. */
  toggleWidth(): void {
    this.setPanelWidth(this.panelWidth() > 500 ? 420 : 720);
  }

  /** Limita el ancho al espacio disponible y mantiene una franja visible del editor. */
  private setPanelWidth(width: number): void {
    const host = this.element.nativeElement;
    const parent = host.parentElement;
    const occupied = Array.from(parent?.children || [])
      .filter((sibling) => sibling !== host && getComputedStyle(sibling).flexGrow === '0')
      .reduce((total, sibling) => total + sibling.getBoundingClientRect().width, 0);
    const available = (parent?.clientWidth || window.innerWidth) - occupied;
    this.panelWidth.set(Math.round(Math.max(320, Math.min(width, Math.max(320, available - 160)))));
  }

  /** Inicia el ajuste mediante captura de puntero para soportar ratón y pantalla táctil. */
  startResize(event: PointerEvent): void {
    if (event.button !== 0 || this.expanded()) return;
    event.preventDefault();
    this.resizeStart = {
      x: event.clientX,
      width: this.element.nativeElement.getBoundingClientRect().width || this.panelWidth(),
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  /** Ajusta el ancho desde el borde izquierdo mientras el puntero permanece capturado. */
  resize(event: PointerEvent): void {
    if (this.resizeStart) {
      this.setPanelWidth(this.resizeStart.width + this.resizeStart.x - event.clientX);
    }
  }

  /** Finaliza el arrastre, incluida la cancelación por pérdida de captura. */
  stopResize(): void {
    this.resizeStart = null;
  }

  /** Ofrece ajuste de ancho por teclado en el separador accesible. */
  resizeWithKeyboard(event: KeyboardEvent): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    this.setPanelWidth(
      event.key === 'Home' ? 420 : this.panelWidth() + (event.key === 'ArrowLeft' ? 40 : -40),
    );
  }

  /** Sincroniza el panel con el diagrama activo, el coordinador y la reproducción selectiva. */
  constructor() {
    this.handledOpenRequests = this.coordinator?.openRequests() ?? 0;
    let speechView: string | null = null;

    effect(() => {
      const hasMultiple = this.hasMultipleCollaborators();
      if (!hasMultiple && this.state.scope() === 'group') {
        untracked(() => {
          this.switchScope('personal');
        });
      }
    });

    effect(() => {
      const diagramId = this.diagramId();
      // Solo el cambio de diagrama reinicia la sesión; las lecturas de limpieza no son dependencias.
      untracked(() => {
        this.generation++;
        const pendingScope = this.coordinator?.requestedScope();
        if (pendingScope) {
          this.state.scope.set(pendingScope);
          this.coordinator?.requestedScope.set(null);
        }
        this.state.connect(diagramId);
        this.media.reset();
        if (!this.voiceCall?.inCall()) {
          this.speech.reset(diagramId);
        }
        this.attachmentPlaying.set(false);
        this.prompt.set('');
        this.error.set('');
        this.applying.set(null);
        this.lastSequence = 0;
        this.loadingAssets.clear();
        this.releaseAssets();
      });
    });

    effect(() => {
      const requests = this.coordinator?.openRequests() ?? 0;
      if (requests <= this.handledOpenRequests) return;
      this.handledOpenRequests = requests;
      untracked(() => {
        const targetScope = this.coordinator?.requestedScope();
        if (targetScope) {
          this.coordinator?.requestedScope.set(null);
          if (this.state.scope() !== targetScope) {
            this.lastSequence = 0;
            this.state.setScope(targetScope);
          } else {
            this.state.refreshNow();
          }
        }
      });
    });

    effect(() => {
      const lastMessage = this.state.messages().at(-1);
      const latest = lastMessage?.sequence || 0;
      if (lastMessage) this.speech.displayedContent(lastMessage);
      if (latest > this.lastSequence || (lastMessage && this.speech.playing() === lastMessage.id)) {
        const element = this.historyContainer?.nativeElement;
        const follow =
          !this.lastSequence ||
          !element ||
          element.scrollHeight - element.scrollTop - element.clientHeight < 120;
        const generation = this.generation;
        if (follow) {
          setTimeout(() => {
            const container = this.historyContainer?.nativeElement;
            if (container && generation === this.generation) {
              container.scrollTop = container.scrollHeight;
            }
          });
        }
      }
      this.lastSequence = latest;
    });

    effect(() => {
      const messages = this.state.messages();
      const scope = this.state.scope();
      const inCall = this.isCallInCurrentDiagram();
      const currentUserId = this.auth.currentUser()?.id || null;
      const historyLoaded = this.state.historyLoaded();
      const isOpen = this.isOpen();
      const diagramId = this.diagramId();
      const view = isOpen && historyLoaded && diagramId ? `${diagramId}:${scope}` : null;
      untracked(() => {
        if (historyLoaded && (isOpen || inCall)) {
          if (view && view !== speechView && !inCall) {
            this.speech.stop();
            this.speech.primeFloor(diagramId!, messages, scope);
          }
          this.speech.observe(diagramId, messages, { inCall, currentUserId }, scope);
        }
        speechView = view;
        // Precarga solo los clips recientes para no saturar las conexiones HTTP con todo el historial.
        for (const msg of messages.slice(-3)) {
          if (
            msg.source === 'audio' &&
            msg.attachment &&
            !this.assets()[msg.id] &&
            !this.loadingAssets.has(msg.id)
          ) {
            void this.openAttachment(msg);
          }
        }
      });
    });

    effect(() => {
      const blocked = this.media.recording() || this.media.busy() || this.attachmentPlaying();
      untracked(() => this.speech.setBlocked(blocked));
    });

    effect(() => {
      if (!this.isOpen() && !this.voiceCall?.inCall()) {
        untracked(() => this.speech.reset(this.diagramId()));
      }
    });

    effect(() => {
      const models = this.state.models();
      if (models) {
        this.provider.set(models.defaultProvider);
        this.voiceCall?.preferredProvider.set(models.defaultProvider);
      }
    });
  }

  /** Indica si un mensaje de nota de voz incluye un texto adicional distinto de su transcripción. */
  hasDistinctAudioCaption(message: ChatMessage): boolean {
    if (message.source !== 'audio') return false;
    const content = message.content?.trim() || '';
    const transcript = message.transcription?.trim() || '';
    return !!content && !!transcript && content !== transcript;
  }

  /** Lee manualmente una respuesta completada tras detener cualquier clip humano en reproducción. */
  playSpeech(message: ChatMessage): void {
    const room = this.diagramId();
    if (!room || this.media.recording() || this.media.busy()) return;
    this.pauseAttachments();
    this.speech.setBlocked(false);
    this.speech.play(room, message, this.state.scope());
  }

  /** Inicia o detiene la grabación reactiva de nota de voz bloqueando la síntesis simultánea. */
  async toggleRecording(): Promise<void> {
    if (!this.media.recording()) {
      this.speech.stop();
      this.pauseAttachments();
      this.speech.setBlocked(true);
    }
    await this.media.toggleRecording();
    this.speech.setBlocked(this.media.recording() || this.media.busy());
  }

  /** Cancela la grabación en vivo descartando el audio capturado. */
  cancelVoiceRecording(): void {
    this.media.cancelRecording();
    this.speech.setBlocked(false);
  }

  /** Finaliza la grabación en vivo y la publica en un solo toque como mensaje de audio. */
  async sendRecordedVoiceNow(): Promise<void> {
    const clip = await this.media.finishRecordingForSend();
    this.speech.setBlocked(this.media.recording() || this.media.busy());
    if (!clip) return;
    await this.submitTurn(this.prompt().trim(), clip);
  }

  /** Pausa clips humanos para que grabación y síntesis no se superpongan. */
  private pauseAttachments(): void {
    this.element.nativeElement.querySelectorAll('audio').forEach((audio) => audio.pause());
    this.attachmentPlaying.set(false);
  }

  /** Publica una intervención en la pestaña activa; limpia el borrador tras aceptación del servidor. */
  async send(): Promise<void> {
    if (
      this.media.recording() ||
      this.media.busy() ||
      (!this.prompt().trim() && !this.media.attachment())
    ) {
      return;
    }
    await this.submitTurn(this.prompt().trim(), this.media.attachment());
  }

  /** Ejecuta el envío con soporte para adjunto explícito o capturado en un toque. */
  private async submitTurn(content: string, attachment: ChatAttachment | null): Promise<void> {
    const generation = this.generation;
    const activeScope = this.state.scope();
    const sent = await this.state.send({
      content,
      provider: attachment ? 'vertex' : this.provider(),
      language: this.i18n.currentLang(),
      ...(activeScope === 'personal' ? { scope: 'personal' } : {}),
      ...(attachment ? { attachment } : {}),
    });
    if (sent && generation === this.generation) {
      this.prompt.set('');
      this.media.clear();
    }
  }

  /** Reserva Enter para envío y permite Shift+Enter para redactar varias líneas. */
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Tab' && this.showMentionAutocomplete()) {
      event.preventDefault();
      this.insertKanonMention();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      void this.send();
    }
  }

  /** Procesa imágenes seleccionadas desde el control nativo. */
  async selectImage(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file && !this.state.sending()) await this.media.attachImage(file, file.name);
    input.value = '';
  }

  /** Conserva el pegado de texto y captura exclusivamente los elementos de imagen. */
  onPaste(event: ClipboardEvent): void {
    if (this.state.sending()) return;
    const image = Array.from(event.clipboardData?.items || [])
      .find((item) => item.type.startsWith('image/'))
      ?.getAsFile();
    if (image) {
      event.preventDefault();
      void this.media.attachImage(image, 'clipboard.png');
    }
  }

  /** Conserva el ingreso de imágenes mediante arrastrar y soltar. */
  onDrop(event: DragEvent): void {
    event.preventDefault();
    if (this.state.sending()) return;
    const image = event.dataTransfer?.files[0];
    if (image) void this.media.attachImage(image, image.name);
  }

  /** Lee el portapapeles mediante una acción explícita del usuario. */
  async pasteClipboard(): Promise<void> {
    if (this.state.sending()) return;
    const generation = this.generation;
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const mime = item.types.find((type) => type.startsWith('image/'));
        if (mime) {
          const blob = await item.getType(mime);
          if (generation === this.generation && !this.state.sending()) {
            await this.media.attachImage(blob, 'clipboard.png');
          }
          return;
        }
      }
      const text = await navigator.clipboard.readText();
      if (generation === this.generation && !this.state.sending()) {
        this.prompt.update((value) => value + (value ? '\n' : '') + text);
      }
    } catch {
      this.error.set('chat.clipboardError');
    }
  }

  /** Aplica únicamente una propuesta revisada y bloquea el botón durante la petición. */
  async apply(message: ChatMessage): Promise<void> {
    const diagramId = this.diagramId();
    if (
      !diagramId ||
      !message.proposal ||
      this.applying() ||
      !this.canEdit() ||
      this.hasUnsavedChanges()
    ) {
      return;
    }
    const generation = this.generation;
    const scopeParam = this.state.scope() === 'personal' ? 'personal' : undefined;
    this.applying.set(message.id);
    this.error.set('');
    try {
      await firstValueFrom(
        scopeParam
          ? this.api.apply(diagramId, message.proposal.id, scopeParam)
          : this.api.apply(diagramId, message.proposal.id),
      );
      if (generation === this.generation) this.proposalApplied.emit(diagramId);
    } catch (error: unknown) {
      if (generation === this.generation) {
        const messages: Partial<Record<number, string>> = {
          400: 'chat.invalidProposal',
          422: 'chat.invalidProposal',
          403: 'chat.applyForbidden',
          409: 'chat.conflict',
        };
        this.error.set(
          messages[(error as { status?: number } | null)?.status ?? 0] ?? 'chat.applyFailed',
        );
      }
    } finally {
      if (generation === this.generation) this.applying.set(null);
    }
  }

  /** Descarga el adjunto autenticado de un mensaje según el ámbito activo. */
  async openAttachment(message: ChatMessage): Promise<void> {
    const diagramId = this.diagramId();
    if (
      !diagramId ||
      this.assets()[message.id] ||
      this.loadingAssets.has(message.id) ||
      typeof this.api.attachment !== 'function'
    ) {
      return;
    }
    const generation = this.generation;
    const scopeParam = this.state.scope() === 'personal' ? 'personal' : undefined;
    this.loadingAssets.add(message.id);
    try {
      const blob = await firstValueFrom(
        scopeParam
          ? this.api.attachment(diagramId, message.id, scopeParam)
          : this.api.attachment(diagramId, message.id),
      );
      if (generation !== this.generation) return;
      const url = URL.createObjectURL(blob);
      this.assets.update((assets) => ({ ...assets, [message.id]: url }));
    } catch {
      if (generation === this.generation) this.error.set('chat.mediaError');
    } finally {
      this.loadingAssets.delete(message.id);
    }
  }

  /** Revoca los recursos locales al desmontar el panel sin cortar la voz si sigue en llamada. */
  ngOnDestroy(): void {
    this.generation++;
    if (!this.voiceCall?.inCall()) {
      this.speech.reset(null);
    }
    this.releaseAssets();
  }

  /** Evita retener imágenes y audios en memoria después de salir de la conversación. */
  private releaseAssets(): void {
    Object.values(this.assets()).forEach((url) => URL.revokeObjectURL(url));
    this.assets.set({});
  }
}
