import {
  Component,
  inject,
  signal,
  input,
  output,
  ElementRef,
  ViewChild,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroSparkles,
  heroChevronRight,
  heroXMark,
  heroMicrophone,
  heroStop,
  heroClipboard,
  heroCamera,
  heroPhoto,
  heroPaperAirplane,
  heroClipboardDocumentCheck,
  heroChatBubbleLeftRight,
  heroCpuChip,
  heroArrowPath,
  heroChevronDown,
  heroChevronUp,
} from '@ng-icons/heroicons/outline';
import { AuthService } from '../../../../../core/services/auth.service';
import { AiAssistantService, AiResponse, AiModelOption } from '../../../../../core/services/ai-assistant.service';
import {
  UmlClassNode,
  UmlConnection,
} from '../../../../../core/models/diagram.model';

export interface AiChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  imagePreview?: string;
  audioInfo?: {
    duration?: number;
    mimeType?: string;
  };
  changesSummary?: string;
  providerUsed?: 'vertex';
  modelUsed?: string;
  timestamp: Date;
  status?: 'success' | 'clarification' | 'error' | 'pending';
}

import { TranslatePipe } from '../../../../../core/i18n';

@Component({
  selector: 'app-ai-assistant-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent, TranslatePipe],
  providers: [
    provideIcons({
      heroSparkles,
      heroChevronRight,
      heroXMark,
      heroMicrophone,
      heroStop,
      heroClipboard,
      heroCamera,
      heroPhoto,
      heroPaperAirplane,
      heroClipboardDocumentCheck,
      heroChatBubbleLeftRight,
      heroCpuChip,
      heroArrowPath,
      heroChevronDown,
      heroChevronUp,
    }),
  ],
  templateUrl: './ai-assistant-panel.component.html',
})
export class AiAssistantPanelComponent implements OnInit, OnDestroy {
  readonly authService = inject(AuthService);
  private readonly aiService = inject(AiAssistantService);

  @ViewChild('chatScrollContainer') chatScrollContainerRef?: ElementRef<HTMLDivElement>;
  @ViewChild('imageInput') imageInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('webcamVideo') webcamVideoRef?: ElementRef<HTMLVideoElement>;

  // Inputs
  readonly isOpen = input<boolean>(false);
  readonly diagramId = input<string | null>(null);
  readonly roomCode = input<string | null>(null);
  readonly currentNodes = input<UmlClassNode[]>([]);
  readonly currentConnections = input<UmlConnection[]>([]);

  // Outputs
  readonly closePanel = output<void>();
  readonly applyMutation = output<{
    nodes: UmlClassNode[];
    connections: UmlConnection[];
    summary: string;
    rawResponse?: any;
  }>();

  // Modelos de IA disponibles y seleccionados por el usuario
  readonly availableModels = signal<AiModelOption[]>([]);
  readonly selectedModelId = signal<string>('gemini-2.5-flash');
  readonly selectedProvider = signal<'vertex'>('vertex');
  readonly isOllamaAvailable = signal<boolean>(false);
  readonly isLoadingModels = signal<boolean>(false);
  readonly isModelDropdownOpen = signal<boolean>(false);

  // Estados reactivos internos
  readonly isAiProcessing = signal<boolean>(false);
  readonly aiPrompt = signal<string>('');
  readonly attachedImageBase64 = signal<string | null>(null);
  readonly attachedImageName = signal<string | null>(null);
  readonly isRecordingAudio = signal<boolean>(false);
  readonly isVoiceListening = this.isRecordingAudio; // Alias para compatibilidad
  readonly recordingSeconds = signal<number>(0);
  readonly attachedAudioBase64 = signal<string | null>(null);
  readonly attachedAudioMimeType = signal<string>('audio/webm');
  readonly attachedAudioDuration = signal<number>(0);
  readonly showWebcamModal = signal<boolean>(false);

  // Historial conversacional
  readonly aiChatMessages = signal<AiChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: '¡Hola! Soy tu Copilot de Modelado UML impulsado por Google Gemini.\n\nPídeme crear tablas, agregar atributos, conectar entidades, dictar comandos por voz con Gemini Multimodal, o adjuntar un boceto para digitalizarlo automáticamente.',
      timestamp: new Date(),
    },
  ]);

  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private recordingTimer: any = null;
  private recordedMimeType = 'audio/webm';
  private webcamMediaStream: MediaStream | null = null;

  ngOnInit(): void {
    this.loadAvailableModels();
  }

  loadAvailableModels(): void {
    this.isLoadingModels.set(true);
    this.aiService.getAvailableModels().subscribe({
      next: (res) => {
        this.isLoadingModels.set(false);
        const data = (res as any)?.data || res;
        const models: AiModelOption[] = data?.models || [];
        this.availableModels.set(models);
        this.selectedModelId.set(data?.defaultModel || 'gemini-2.5-flash');
        this.selectedProvider.set('vertex');
      },
      error: () => {
        this.isLoadingModels.set(false);
        this.availableModels.set([
          {
            id: 'gemini-2.5-flash',
            name: 'Google Gemini 2.5 Flash',
            provider: 'vertex',
            isLocal: false,
            description: 'Google Vertex AI (Nativo: Texto, Visión y Audio)',
          },
        ]);
        this.selectedModelId.set('gemini-2.5-flash');
        this.selectedProvider.set('vertex');
      },
    });
  }

  toggleModelDropdown(): void {
    this.isModelDropdownOpen.update((v) => !v);
  }

  closeModelDropdown(): void {
    this.isModelDropdownOpen.set(false);
  }

  selectModel(model: AiModelOption): void {
    this.selectedModelId.set(model.id);
    this.selectedProvider.set(model.provider);
    localStorage.setItem('uml_preferred_ai_model', model.id);
    this.closeModelDropdown();
  }

  onModelChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const modelId = target.value;
    const model = this.availableModels().find((m) => m.id === modelId);
    if (model) {
      this.selectModel(model);
    }
  }

  getSelectedModel(): AiModelOption | undefined {
    return this.availableModels().find((m) => m.id === this.selectedModelId());
  }

  ngOnDestroy(): void {
    this.cancelAudioRecording();
    this.stopWebcam();
  }

  onAiInputKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.applyAiPrompt();
    }
  }

  setAiSuggestion(text: string): void {
    this.aiPrompt.set(text);
  }

  // -------------------------------------------------------------
  // PROMPT / ENVÍO DE MENSAJES (TEXTO / VISIÓN / AUDIO MULTIMODAL)
  // -------------------------------------------------------------
  applyAiPrompt(): void {
    const promptText = this.aiPrompt().trim();
    const imageBase64 = this.attachedImageBase64();
    const audioBase64 = this.attachedAudioBase64();
    const audioMimeType = this.attachedAudioMimeType();
    const audioDuration = this.attachedAudioDuration();

    if ((!promptText && !imageBase64 && !audioBase64) || this.isAiProcessing()) {
      return;
    }

    let userMessageText = promptText;
    if (audioBase64 && !promptText) {
      userMessageText = `🎙️ [Comando de Voz] (${audioDuration ? audioDuration + 's' : 'audio'})`;
    } else if (audioBase64 && promptText) {
      userMessageText = `🎙️ [Comando de Voz (${audioDuration ? audioDuration + 's' : 'audio'})]: ${promptText}`;
    } else if (!promptText && imageBase64) {
      userMessageText = 'Digitalizar diagrama desde imagen adjunta';
    }

    this.aiChatMessages.update((msgs) => [
      ...msgs,
      {
        id: 'msg-' + Date.now(),
        sender: 'user',
        text: userMessageText,
        timestamp: new Date(),
        imagePreview: imageBase64 || undefined,
        audioInfo: audioBase64 ? { duration: audioDuration, mimeType: audioMimeType } : undefined,
      },
    ]);

    this.isAiProcessing.set(true);
    this.scrollToBottom();

    const dId = this.diagramId() || 'temp_diagram';
    const rCode = this.roomCode() || undefined;
    const provider = this.selectedProvider();
    const model = this.selectedModelId();

    if (audioBase64) {
      this.aiService
        .sendAudioPrompt(
          audioBase64,
          audioMimeType,
          promptText || undefined,
          dId,
          rCode,
          this.currentNodes(),
          this.currentConnections(),
          [],
          { provider: 'vertex', model: 'gemini-2.5-flash' },
        )
        .subscribe({
          next: (res) => this.handleAiResponse(res, '🎙️ Comando de Voz (Gemini Multimodal)'),
          error: (err) => this.handleAiError(err),
        });
    } else if (imageBase64) {
      this.aiService
        .sendVisionPrompt(
          imageBase64,
          'image/jpeg',
          promptText || 'Analiza este boceto/diagrama y digitalízalo como entidades UML completas.',
          dId,
          rCode,
          this.currentNodes(),
          this.currentConnections(),
          [],
          { provider: 'vertex', model: 'gemini-2.5-flash' },
        )
        .subscribe({
          next: (res) => this.handleAiResponse(res, '📸 Reconocimiento de Boceto / Imagen'),
          error: (err) => this.handleAiError(err),
        });
    } else {
      this.aiService
        .sendTextPrompt(
          promptText,
          dId,
          rCode,
          this.currentNodes(),
          this.currentConnections(),
          [],
          { provider, model },
        )
        .subscribe({
          next: (res) => this.handleAiResponse(res, '✨ Copilot IA (Prompt)'),
          error: (err) => this.handleAiError(err),
        });
    }

    this.aiPrompt.set('');
    this.attachedImageBase64.set(null);
    this.attachedImageName.set(null);
    this.attachedAudioBase64.set(null);
    this.attachedAudioDuration.set(0);
  }

  private handleAiResponse(res: AiResponse, sourceTag: string): void {
    this.isAiProcessing.set(false);

    const summary = res.changesSummary || res.message || 'Diagrama actualizado por Copilot IA.';
    const isClarification = res.action === 'clarification' || res.action === 'clarification_required';
    const isError = !res.success && !isClarification;

    let status: 'success' | 'clarification' | 'error' = 'success';
    if (isClarification) status = 'clarification';
    else if (isError) status = 'error';

    this.aiChatMessages.update((msgs) => [
      ...msgs,
      {
        id: 'msg-res-' + Date.now(),
        sender: 'assistant',
        text: res.message || (isClarification ? 'Por favor aclara la solicitud.' : '¡Diagrama modelado con éxito!'),
        changesSummary: summary,
        status,
        providerUsed: res.providerUsed,
        modelUsed: res.modelUsed,
        timestamp: new Date(),
      },
    ]);

    if (res.success && res.nodes && res.nodes.length > 0) {
      this.applyMutation.emit({
        nodes: res.nodes,
        connections: res.connections || [],
        summary,
        rawResponse: res,
      });
    }

    this.scrollToBottom();
  }

  private handleAiError(err: any): void {
    this.isAiProcessing.set(false);
    const msg = err.error?.message || err.message || 'Error de conexión con el Asistente IA.';

    this.aiChatMessages.update((msgs) => [
      ...msgs,
      {
        id: 'msg-err-' + Date.now(),
        sender: 'assistant',
        text: '❌ Ocurrió un error al procesar tu solicitud: ' + msg,
        status: 'error',
        timestamp: new Date(),
      },
    ]);

    this.scrollToBottom();
  }

  // -------------------------------------------------------------
  // GRABACIÓN DE AUDIO MULTIMODAL DIRECTO (GEMINI 2.5 FLASH)
  // -------------------------------------------------------------
  toggleAudioRecording(): void {
    if (this.isRecordingAudio()) {
      this.stopAudioRecording();
    } else {
      this.startAudioRecording();
    }
  }

  // Alias para mantener compatibilidad con plantillas existentes
  toggleVoiceRecognition(): void {
    this.toggleAudioRecording();
  }

  async startAudioRecording(): Promise<void> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Tu navegador no soporta captura de audio desde el micrófono (MediaDevices API).');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioStream = stream;
      this.audioChunks = [];

      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        }
      }

      this.recordedMimeType = mimeType;
      this.mediaRecorder = new MediaRecorder(stream, { mimeType });

      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(250);
      this.isRecordingAudio.set(true);
      this.recordingSeconds.set(0);

      if (this.recordingTimer) {
        clearInterval(this.recordingTimer);
      }
      this.recordingTimer = setInterval(() => {
        this.recordingSeconds.update((s) => s + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Error al acceder al micrófono:', err);
      alert('No se pudo acceder al micrófono: ' + (err.message || 'Permiso denegado'));
      this.isRecordingAudio.set(false);
    }
  }

  stopAudioRecording(autoSend = false): void {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      this.isRecordingAudio.set(false);
      return;
    }

    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }

    const duration = this.recordingSeconds();

    this.mediaRecorder.onstop = async () => {
      this.cleanupAudioStream();
      const audioBlob = new Blob(this.audioChunks, { type: this.recordedMimeType });
      const base64 = await this.blobToBase64(audioBlob);
      const cleanMime = (this.recordedMimeType || 'audio/webm').split(';')[0].trim();
      this.attachedAudioBase64.set(base64);
      this.attachedAudioMimeType.set(cleanMime);
      this.attachedAudioDuration.set(duration);
      this.isRecordingAudio.set(false);

      if (autoSend) {
        this.applyAiPrompt();
      }
    };

    this.mediaRecorder.stop();
  }

  cancelAudioRecording(): void {
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.onstop = null;
      this.mediaRecorder.stop();
    }
    this.cleanupAudioStream();
    this.audioChunks = [];
    this.isRecordingAudio.set(false);
    this.recordingSeconds.set(0);
  }

  removeAttachedAudio(): void {
    this.attachedAudioBase64.set(null);
    this.attachedAudioDuration.set(0);
  }

  private cleanupAudioStream(): void {
    if (this.audioStream) {
      this.audioStream.getTracks().forEach((track) => track.stop());
      this.audioStream = null;
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // -------------------------------------------------------------
  // IMÁGENES / VISION (PEGAR, ARRASTRAR, ARCHIVO)
  // -------------------------------------------------------------
  triggerImageInput(): void {
    this.imageInputRef?.nativeElement?.click();
  }

  onImageSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      this.processImageFile(file);
    }
    target.value = '';
  }

  onPasteImage(event: ClipboardEvent): void {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          event.preventDefault();
          this.processImageFile(blob);
          break;
        }
      }
    }
  }

  pasteFromClipboard(): void {
    if (navigator.clipboard && navigator.clipboard.read) {
      navigator.clipboard
        .read()
        .then((items) => {
          for (const item of items) {
            const imageType = item.types.find((t) => t.startsWith('image/'));
            if (imageType) {
              item.getType(imageType).then((blob) => {
                this.processImageFile(blob);
              });
              return;
            }
          }
          alert('No se encontró ninguna imagen en el portapapeles. Copia una captura con Ctrl+C o tecla Impr Pant primero.');
        })
        .catch(() => {
          alert('Usa el atajo de teclado Ctrl+V dentro del cuadro de texto para pegar la imagen.');
        });
    } else {
      alert('Usa el atajo Ctrl+V dentro del cuadro de texto.');
    }
  }

  onDropImage(event: DragEvent): void {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0 && files[0].type.startsWith('image/')) {
      this.processImageFile(files[0]);
    }
  }

  removeAttachedImage(): void {
    this.attachedImageBase64.set(null);
    this.attachedImageName.set(null);
  }

  private processImageFile(file: File | Blob): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      this.attachedImageBase64.set(base64);
      this.attachedImageName.set((file as File).name || 'captura_pizarra.png');
    };
    reader.readAsDataURL(file);
  }

  // -------------------------------------------------------------
  // CÁMARA WEB
  // -------------------------------------------------------------
  openWebcamModal(): void {
    this.showWebcamModal.set(true);
    setTimeout(() => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ video: { facingMode: 'environment' } })
          .then((stream) => {
            this.webcamMediaStream = stream;
            if (this.webcamVideoRef?.nativeElement) {
              this.webcamVideoRef.nativeElement.srcObject = stream;
            }
          })
          .catch((err) => {
            alert('No se pudo acceder a la cámara: ' + err.message);
            this.closeWebcamModal();
          });
      }
    }, 100);
  }

  closeWebcamModal(): void {
    this.stopWebcam();
    this.showWebcamModal.set(false);
  }

  private stopWebcam(): void {
    if (this.webcamMediaStream) {
      this.webcamMediaStream.getTracks().forEach((track) => track.stop());
      this.webcamMediaStream = null;
    }
  }

  captureWebcamPhoto(): void {
    if (!this.webcamVideoRef?.nativeElement) return;
    const video = this.webcamVideoRef.nativeElement;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      this.attachedImageBase64.set(dataUrl);
      this.attachedImageName.set(`foto_camara_${Date.now()}.jpg`);
    }
    this.closeWebcamModal();
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.chatScrollContainerRef?.nativeElement) {
        const el = this.chatScrollContainerRef.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    }, 50);
  }
}
