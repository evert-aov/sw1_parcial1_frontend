import {
  Component,
  inject,
  signal,
  input,
  output,
  ElementRef,
  ViewChild,
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
  heroClock,
} from '@ng-icons/heroicons/outline';
import { AuthService } from '../../../../../core/services/auth.service';
import { AiAssistantService, AiResponse } from '../../../../../core/services/ai-assistant.service';
import {
  UmlClassNode,
  UmlConnection,
  SessionActivityEvent,
} from '../../../../../core/models/diagram.model';

export interface AiChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  imagePreview?: string;
  changesSummary?: string;
  timestamp: Date;
  status?: 'success' | 'clarification' | 'error' | 'pending';
}

@Component({
  selector: 'app-ai-assistant-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent],
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
      heroClock,
    }),
  ],
  templateUrl: './ai-assistant-panel.component.html',
})
export class AiAssistantPanelComponent implements OnDestroy {
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
  readonly sessionHistory = input<SessionActivityEvent[]>([]);

  // Outputs
  readonly closePanel = output<void>();
  readonly applyMutation = output<{
    nodes: UmlClassNode[];
    connections: UmlConnection[];
    summary: string;
    rawResponse?: any;
  }>();
  readonly logActivity = output<Omit<SessionActivityEvent, 'id' | 'timestamp'>>();

  // Estados reactivos internos
  readonly activeAiTab = signal<'chat' | 'history'>('chat');
  readonly isAiProcessing = signal<boolean>(false);
  readonly aiPrompt = signal<string>('');
  readonly attachedImageBase64 = signal<string | null>(null);
  readonly attachedImageName = signal<string | null>(null);
  readonly isVoiceListening = signal<boolean>(false);
  readonly showWebcamModal = signal<boolean>(false);

  // Historial conversacional
  readonly aiChatMessages = signal<AiChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: '¡Hola! Soy tu Copilot de Modelado UML con Gemini 2.5 Flash.\n\nPuedes pedirme crear tablas, agregar atributos, conectar entidades, o adjuntar una foto/captura de una pizarra o cuaderno dibujado a mano para digitalizarlo automáticamente.',
      timestamp: new Date(),
    },
  ]);

  private speechRecognition: any = null;
  private webcamMediaStream: MediaStream | null = null;

  ngOnDestroy(): void {
    if (this.speechRecognition && this.isVoiceListening()) {
      this.speechRecognition.stop();
    }
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
  // PROMPT / ENVÍO DE MENSAJES (TEXTO / VISIÓN)
  // -------------------------------------------------------------
  applyAiPrompt(): void {
    const promptText = this.aiPrompt().trim();
    const imageBase64 = this.attachedImageBase64();

    if ((!promptText && !imageBase64) || this.isAiProcessing()) {
      return;
    }

    const userMessageText = promptText || (imageBase64 ? 'Digitalizar diagrama desde imagen adjunta' : '');

    this.aiChatMessages.update((msgs) => [
      ...msgs,
      {
        id: 'msg-' + Date.now(),
        sender: 'user',
        text: userMessageText,
        timestamp: new Date(),
        imagePreview: imageBase64 || undefined,
      },
    ]);

    this.isAiProcessing.set(true);
    this.scrollToBottom();

    const dId = this.diagramId() || 'temp_diagram';
    const rCode = this.roomCode() || undefined;
    const recentHistory = this.sessionHistory().slice(-12);

    if (imageBase64) {
      this.aiService
        .sendVisionPrompt(
          imageBase64,
          'image/jpeg',
          promptText || 'Analiza este boceto/diagrama y digitalízalo como entidades UML completas.',
          dId,
          rCode,
          this.currentNodes(),
          this.currentConnections(),
          recentHistory,
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
          recentHistory,
        )
        .subscribe({
          next: (res) => this.handleAiResponse(res, '✨ Copilot IA (Prompt)'),
          error: (err) => this.handleAiError(err),
        });
    }

    this.aiPrompt.set('');
    this.attachedImageBase64.set(null);
    this.attachedImageName.set(null);
  }

  private handleAiResponse(res: AiResponse, sourceTag: string): void {
    this.isAiProcessing.set(false);

    const summary = res.changesSummary || res.message || 'Diagrama actualizado por Copilot IA.';
    const isClarification = res.action === 'clarification';

    this.aiChatMessages.update((msgs) => [
      ...msgs,
      {
        id: 'msg-res-' + Date.now(),
        sender: 'assistant',
        text: res.message || (isClarification ? 'Por favor aclara la solicitud.' : '¡Diagrama modelado con éxito!'),
        changesSummary: summary,
        status: isClarification ? 'clarification' : 'success',
        timestamp: new Date(),
      },
    ]);

    if (!isClarification && res.nodes && res.nodes.length > 0) {
      this.applyMutation.emit({
        nodes: res.nodes,
        connections: res.connections || [],
        summary,
        rawResponse: res,
      });
    }

    this.logActivity.emit({
      type: 'ai_mutation',
      title: sourceTag,
      description: summary,
      actor: '🤖 Copilot IA',
      icon: 'heroSparkles',
      badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
    });

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
  // DICTADO POR VOZ (WEB SPEECH API)
  // -------------------------------------------------------------
  toggleVoiceRecognition(): void {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Tu navegador no soporta reconocimiento de voz nativo (Web Speech API). Usa Chrome o Edge.');
      return;
    }

    if (this.isVoiceListening()) {
      this.speechRecognition?.stop();
      this.isVoiceListening.set(false);
      return;
    }

    try {
      this.speechRecognition = new SpeechRecognition();
      this.speechRecognition.lang = 'es-ES';
      this.speechRecognition.continuous = false;
      this.speechRecognition.interimResults = false;

      this.speechRecognition.onstart = () => {
        this.isVoiceListening.set(true);
      };

      this.speechRecognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          const current = this.aiPrompt().trim();
          this.aiPrompt.set(current ? `${current} ${transcript}` : transcript);
        }
        this.isVoiceListening.set(false);
      };

      this.speechRecognition.onerror = () => {
        this.isVoiceListening.set(false);
      };

      this.speechRecognition.onend = () => {
        this.isVoiceListening.set(false);
      };

      this.speechRecognition.start();
    } catch {
      this.isVoiceListening.set(false);
    }
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

  // -------------------------------------------------------------
  // HISTORIAL DE SESIÓN
  // -------------------------------------------------------------
  copySessionHistory(): void {
    const text = this.sessionHistory()
      .map(
        (h) =>
          `[${new Date(h.timestamp).toLocaleTimeString()}] ${h.title} (${h.actor}): ${h.description}`
      )
      .join('\n');

    navigator.clipboard.writeText(text).then(() => {
      alert('Historial de sesión copiado al portapapeles.');
    });
  }

  askAiAboutSession(): void {
    const count = this.sessionHistory().length;
    this.activeAiTab.set('chat');
    this.aiPrompt.set(
      `Analiza los ${count} eventos del historial de esta sesión y resume la arquitectura UML que hemos construido hasta ahora.`
    );
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
