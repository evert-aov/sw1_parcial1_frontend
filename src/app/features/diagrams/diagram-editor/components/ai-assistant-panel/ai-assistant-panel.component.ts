import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroCamera,
  heroChevronRight,
  heroClipboard,
  heroMicrophone,
  heroPaperAirplane,
  heroPhoto,
  heroSparkles,
  heroStop,
} from '@ng-icons/heroicons/outline';
import { AiAssistantService, AiResponse } from '../../../../../core/services/ai-assistant.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { TranslatePipe } from '../../../../../core/i18n';
import { DiagramType, UmlClassNode, UmlConnection } from '../../../../../core/models/diagram.model';
import {
  AiChatMessageItem,
  captureFrameFromVideo,
  readAudioBlobAsBase64,
  readImageFileAsBase64,
} from './ai-assistant-media.util';

/**
 * Panel lateral de Copilot IA Multimodal (Texto, Visión y Audio con Google Gemini)
 * para generación y edición asistida de diagramas UML.
 */
@Component({
  selector: 'app-ai-assistant-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, NgIconComponent, TranslatePipe],
  providers: [
    provideIcons({
      heroSparkles,
      heroChevronRight,
      heroMicrophone,
      heroStop,
      heroClipboard,
      heroCamera,
      heroPhoto,
      heroPaperAirplane,
    }),
  ],
  templateUrl: './ai-assistant-panel.component.html',
})
export class AiAssistantPanelComponent implements OnDestroy {
  readonly authService = inject(AuthService);
  private readonly aiAssistantService = inject(AiAssistantService);
  private readonly toastService = inject(ToastService, { optional: true });

  readonly isOpen = input<boolean>(false);
  readonly diagramId = input<string | null>(null);
  readonly roomCode = input<string | null | undefined>(undefined);
  readonly currentNodes = input<UmlClassNode[]>([]);
  readonly currentConnections = input<UmlConnection[]>([]);
  readonly diagramType = input<DiagramType>(DiagramType.CLASS);

  readonly closePanel = output<void>();
  readonly applyMutation = output<{ nodes: UmlClassNode[]; connections: UmlConnection[] }>();

  @ViewChild('imageInput') imageInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('chatScrollContainer') chatScrollContainerRef?: ElementRef<HTMLDivElement>;
  @ViewChild('webcamVideo') webcamVideoRef?: ElementRef<HTMLVideoElement>;

  readonly aiPrompt = signal<string>('');
  readonly isAiProcessing = signal<boolean>(false);

  readonly attachedImageBase64 = signal<string | null>(null);
  readonly attachedImageRawBase64 = signal<string | null>(null);
  readonly attachedImageMimeType = signal<string>('image/png');
  readonly attachedImageName = signal<string | null>(null);

  readonly attachedAudioBase64 = signal<string | null>(null);
  readonly attachedAudioMimeType = signal<string>('audio/webm');
  readonly attachedAudioDuration = signal<number>(0);

  readonly isRecordingAudio = signal<boolean>(false);
  readonly recordingSeconds = signal<number>(0);
  readonly showWebcamModal = signal<boolean>(false);

  readonly aiChatMessages = signal<AiChatMessageItem[]>([
    {
      id: 'welcome-msg',
      sender: 'ai',
      text: '¡Hola! Soy tu Copilot UML impulsado por Google Gemini. Puedes pedirme crear o modificar clases, relaciones, subir o pegar una foto de tu diagrama, o grabar un comando de voz.',
      timestamp: new Date(),
      status: 'success',
    },
  ]);

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private recordingTimer: ReturnType<typeof setInterval> | null = null;
  private webcamStream: MediaStream | null = null;

  /**
   * Limpia streams de audio o cámara activos al destruir el componente.
   */
  ngOnDestroy(): void {
    this.cancelAudioRecording();
    this.stopWebcamStream();
  }

  /**
   * Asigna una sugerencia rápida al campo de texto del prompt.
   *
   * @param suggestion Texto sugerido.
   */
  setAiSuggestion(suggestion: string): void {
    this.aiPrompt.set(suggestion);
  }

  /**
   * Abre el selector nativo de archivos de imagen.
   */
  triggerImageInput(): void {
    this.imageInputRef?.nativeElement?.click();
  }

  /**
   * Procesa el archivo de imagen seleccionado desde el input de archivos.
   *
   * @param event Evento de cambio del input file.
   */
  async onImageSelected(event: Event): Promise<void> {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    if (!file) return;
    await this.attachImageBlob(file, file.name);
    inputEl.value = '';
  }

  /**
   * Intercepta el pegado (`Ctrl+V`) para extraer capturas de imagen desde el portapapeles.
   *
   * @param event Evento de portapapeles.
   */
  async onPasteImage(event: ClipboardEvent): Promise<void> {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        event.preventDefault();
        const blob = item.getAsFile();
        if (blob) {
          await this.attachImageBlob(blob, `portapapeles-${Date.now()}.png`);
        }
        return;
      }
    }
  }

  /**
   * Procesa imágenes soltadas mediante Drag & Drop sobre la caja de texto.
   *
   * @param event Evento DragEvent.
   */
  async onDropImage(event: DragEvent): Promise<void> {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      await this.attachImageBlob(file, file.name);
    }
  }

  /**
   * Lee el portapapeles del navegador mediante botón directo para adjuntar imágenes o texto.
   */
  async pasteFromClipboard(): Promise<void> {
    try {
      if (navigator.clipboard?.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imgType = item.types.find((t) => t.startsWith('image/'));
          if (imgType) {
            const blob = await item.getType(imgType);
            await this.attachImageBlob(blob, `portapapeles-${Date.now()}.png`);
            return;
          }
        }
      }
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          this.aiPrompt.update((prev) => (prev ? `${prev} ${text}` : text));
        }
      }
    } catch {
      this.toastService?.warning('Usa Ctrl+V directamente en la caja de texto para pegar tu captura.');
    }
  }

  /**
   * Elimina la imagen adjunta actual.
   */
  removeAttachedImage(): void {
    this.attachedImageBase64.set(null);
    this.attachedImageRawBase64.set(null);
    this.attachedImageName.set(null);
  }

  /**
   * Elimina el audio adjunto actual.
   */
  removeAttachedAudio(): void {
    this.attachedAudioBase64.set(null);
    this.attachedAudioDuration.set(0);
  }

  /**
   * Alterna el estado de grabación de voz con el micrófono del usuario.
   */
  async toggleAudioRecording(): Promise<void> {
    if (this.isRecordingAudio()) {
      this.stopAudioRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) this.audioChunks.push(e.data);
      };

      this.mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (this.audioChunks.length === 0) return;
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.audioChunks, { type: mimeType });
        try {
          const base64 = await readAudioBlobAsBase64(blob);
          this.attachedAudioBase64.set(base64);
          this.attachedAudioMimeType.set(mimeType);
          this.attachedAudioDuration.set(Math.max(1, this.recordingSeconds()));
        } catch {
          this.toastService?.error('No se pudo procesar el audio grabado.');
        }
      };

      this.mediaRecorder.start();
      this.isRecordingAudio.set(true);
      this.recordingSeconds.set(0);
      this.recordingTimer = setInterval(() => {
        this.recordingSeconds.update((s) => s + 1);
      }, 1000);
    } catch {
      this.toastService?.error('No se pudo acceder al micrófono. Verifica los permisos del navegador.');
    }
  }

  /**
   * Detiene la grabación de audio activa conservando el clip capturado.
   *
   * @param _autoSend reservado para compatibilidad con el template.
   */
  stopAudioRecording(_autoSend = false): void {
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }
    if (this.mediaRecorder && this.isRecordingAudio()) {
      this.mediaRecorder.stop();
      this.isRecordingAudio.set(false);
    }
  }

  /**
   * Cancela la grabación de audio descartando los fragmentos grabados.
   */
  cancelAudioRecording(): void {
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }
    if (this.mediaRecorder && this.isRecordingAudio()) {
      this.audioChunks = [];
      this.mediaRecorder.stop();
      this.isRecordingAudio.set(false);
    }
  }

  /**
   * Abre el modal de cámara web e inicializa el stream de video.
   */
  async openWebcamModal(): Promise<void> {
    this.showWebcamModal.set(true);
    try {
      this.webcamStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      setTimeout(() => {
        if (this.webcamVideoRef?.nativeElement && this.webcamStream) {
          this.webcamVideoRef.nativeElement.srcObject = this.webcamStream;
        }
      }, 50);
    } catch {
      this.toastService?.error('No se pudo acceder a la cámara web.');
      this.showWebcamModal.set(false);
    }
  }

  /**
   * Cierra el modal de cámara web y libera los tracks de video.
   */
  closeWebcamModal(): void {
    this.stopWebcamStream();
    this.showWebcamModal.set(false);
  }

  /**
   * Captura el fotograma actual de la cámara web y lo adjunta al prompt.
   */
  captureWebcamPhoto(): void {
    const videoEl = this.webcamVideoRef?.nativeElement;
    if (!videoEl) return;
    const captured = captureFrameFromVideo(videoEl);
    if (captured) {
      this.attachedImageBase64.set(captured.dataUrl);
      this.attachedImageRawBase64.set(captured.rawBase64);
      this.attachedImageMimeType.set(captured.mimeType);
      this.attachedImageName.set(captured.fileName);
    }
    this.closeWebcamModal();
  }

  /**
   * Maneja la tecla Enter para enviar el prompt sin salto de línea.
   *
   * @param event Evento de teclado.
   */
  onAiInputKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.applyAiPrompt();
    }
  }

  /**
   * Envía la instrucción (texto, imagen o audio) al servicio de IA y emite la mutación resultante.
   */
  applyAiPrompt(): void {
    if (this.isAiProcessing()) return;

    const promptText = this.aiPrompt().trim();
    const imgRaw = this.attachedImageRawBase64();
    const imgPreview = this.attachedImageBase64();
    const imgMime = this.attachedImageMimeType();
    const audioRaw = this.attachedAudioBase64();
    const audioMime = this.attachedAudioMimeType();
    const audioDur = this.attachedAudioDuration();

    if (!promptText && !imgRaw && !audioRaw) return;

    const userMsg: AiChatMessageItem = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text:
        promptText ||
        (imgRaw ? 'Digitalizar diagrama de la imagen adjunta' : 'Comando por voz enviado'),
      timestamp: new Date(),
      imagePreview: imgPreview || undefined,
      audioInfo: audioRaw ? { duration: audioDur, mimeType: audioMime } : undefined,
    };

    const sessionHistory = this.aiChatMessages()
      .slice(-10)
      .map((m) => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }));

    this.aiChatMessages.update((list) => [...list, userMsg]);
    this.aiPrompt.set('');
    this.removeAttachedImage();
    this.removeAttachedAudio();
    this.isAiProcessing.set(true);
    this.scrollToBottom();

    const diagId = this.diagramId() || 'local-diagram';
    const room = this.roomCode() || undefined;
    const nodes = this.currentNodes().filter((n) => !n.isAnchor);
    const conns = this.currentConnections();
    const options = { diagramType: this.diagramType() };

    const req$ = audioRaw
      ? this.aiAssistantService.sendAudioPrompt(
          audioRaw,
          audioMime,
          promptText || undefined,
          diagId,
          room,
          nodes,
          conns,
          sessionHistory,
          options,
        )
      : imgRaw
        ? this.aiAssistantService.sendVisionPrompt(
            imgRaw,
            imgMime,
            promptText || undefined,
            diagId,
            room,
            nodes,
            conns,
            sessionHistory,
            options,
          )
        : this.aiAssistantService.sendTextPrompt(
            promptText,
            diagId,
            room,
            nodes,
            conns,
            sessionHistory,
            options,
          );

    req$.subscribe({
      next: (res: AiResponse) => {
        this.isAiProcessing.set(false);
        const isClarification = res.action === 'clarification' || res.action === 'CLARIFICATION';
        const aiMsg: AiChatMessageItem = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: res.message || 'Diagrama actualizado correctamente.',
          timestamp: new Date(),
          status: isClarification ? 'clarification' : 'success',
          changesSummary: res.changesSummary,
          modelUsed: res.modelUsed,
        };
        this.aiChatMessages.update((list) => [...list, aiMsg]);

        if (!isClarification && (res.nodes || res.connections)) {
          this.applyMutation.emit({
            nodes: res.nodes || [],
            connections: res.connections || [],
          });
        }
        this.scrollToBottom();
      },
      error: (err) => {
        this.isAiProcessing.set(false);
        const errMsg =
          err?.error?.message || err?.message || 'Error al procesar la solicitud con el motor IA.';
        this.aiChatMessages.update((list) => [
          ...list,
          {
            id: `ai-err-${Date.now()}`,
            sender: 'ai',
            text: errMsg,
            timestamp: new Date(),
            status: 'error',
          },
        ]);
        this.scrollToBottom();
      },
    });
  }

  /**
   * Convierte y adjunta un archivo de imagen al estado reactivo del panel.
   */
  private async attachImageBlob(file: File | Blob, fallbackName: string): Promise<void> {
    try {
      const res = await readImageFileAsBase64(file, fallbackName);
      this.attachedImageBase64.set(res.dataUrl);
      this.attachedImageRawBase64.set(res.rawBase64);
      this.attachedImageMimeType.set(res.mimeType);
      this.attachedImageName.set(res.fileName);
    } catch {
      this.toastService?.error('Error al cargar la imagen seleccionada.');
    }
  }

  /**
   * Detiene todos los tracks de video de la cámara web si están activos.
   */
  private stopWebcamStream(): void {
    if (this.webcamStream) {
      this.webcamStream.getTracks().forEach((t) => t.stop());
      this.webcamStream = null;
    }
  }

  /**
   * Desplaza automáticamente el contenedor de mensajes al final de la conversación.
   */
  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.chatScrollContainerRef?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }, 50);
  }
}
