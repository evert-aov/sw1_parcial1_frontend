import {
  Component,
  inject,
  signal,
  input,
  output,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroSparkles,
  heroXMark,
  heroArrowPath,
  heroMicrophone,
  heroStop,
  heroClipboard,
  heroCamera,
  heroPhoto,
  heroPaperAirplane,
  heroClipboardDocumentCheck,
} from '@ng-icons/heroicons/outline';
import { AuthService } from '../../../../../core/services/auth.service';
import { AiAssistantService } from '../../../../../core/services/ai-assistant.service';
import {
  UmlClassNode,
  UmlConnection,
  SessionActivityEvent,
} from '../../../../../core/models/diagram.model';

export interface AiChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
  status?: 'success' | 'clarification' | 'error';
  changesSummary?: string;
  imagePreview?: string | null;
}

@Component({
  selector: 'app-ai-assistant-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent],
  providers: [
    provideIcons({
      heroSparkles,
      heroXMark,
      heroArrowPath,
      heroMicrophone,
      heroStop,
      heroClipboard,
      heroCamera,
      heroPhoto,
      heroPaperAirplane,
      heroClipboardDocumentCheck,
    }),
  ],
  templateUrl: './ai-assistant-panel.component.html',
})
export class AiAssistantPanelComponent {
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
      sender: 'ai',
      text: '¡Hola! Soy tu Copilot de Modelado UML con Gemini 2.5 Flash.\n\nPuedes pedirme crear tablas, agregar atributos, conectar entidades, o adjuntar una foto/captura de una pizarra o cuaderno dibujado a mano para digitalizarlo automáticamente.',
      timestamp: new Date(),
    },
  ]);

  private speechRecognition: any = null;

  onTextareaKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.applyAiPrompt();
    }
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

    // Agregar mensaje del usuario al chat
    this.aiChatMessages.update((msgs) => [
      ...msgs,
      {
        id: 'msg-' + Date.now(),
        sender: 'user',
        text: userMessageText,
        timestamp: new Date(),
        imagePreview: imageBase64,
      },
    ]);

    this.isAiProcessing.set(true);
    this.scrollToBottom();

    const dId = this.diagramId() || 'temp_diagram';
    const rCode = this.roomCode() || undefined;
    const recentHistory = this.sessionHistory().slice(-12);

    if (imageBase64) {
      // Prompt con visión multimodal
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
      // Prompt de texto regular
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

    // Limpiar inputs
    this.aiPrompt.set('');
    this.attachedImageBase64.set(null);
    this.attachedImageName.set(null);
  }

  private handleAiResponse(res: any, sourceTag: string): void {
    this.isAiProcessing.set(false);

    if (res.status === 'clarification') {
      this.aiChatMessages.update((msgs) => [
        ...msgs,
        {
          id: 'msg-' + Date.now(),
          sender: 'ai',
          text: res.message || 'Por favor aclara los detalles de las tablas o relaciones requeridas.',
          status: 'clarification',
          timestamp: new Date(),
        },
      ]);
      this.scrollToBottom();
      return;
    }

    // Mutación exitosa
    const nodes = res.nodes || [];
    const connections = res.connections || [];
    const summary = res.changesSummary || 'Diagrama actualizado por el Asistente IA.';

    this.applyMutation.emit({
      nodes,
      connections,
      summary,
      rawResponse: res,
    });

    this.aiChatMessages.update((msgs) => [
      ...msgs,
      {
        id: 'msg-' + Date.now(),
        sender: 'ai',
        text: res.message || 'He aplicado los cambios al diagrama exitosamente.',
        status: 'success',
        changesSummary: summary,
        timestamp: new Date(),
      },
    ]);

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
    const errorMsg = err.error?.error?.message || err.error?.message || err.message || 'Ocurrió un error al procesar con el Asistente IA';

    this.aiChatMessages.update((msgs) => [
      ...msgs,
      {
        id: 'msg-' + Date.now(),
        sender: 'ai',
        text: `Error: ${errorMsg}`,
        status: 'error',
        timestamp: new Date(),
      },
    ]);

    this.scrollToBottom();
  }

  // -------------------------------------------------------------
  // DICTADO POR VOZ (SPEECH RECOGNITION)
  // -------------------------------------------------------------
  toggleVoiceRecognition(): void {
    if (this.isVoiceListening()) {
      this.stopVoiceRecognition();
      return;
    }

    const windowObj = window as any;
    const SpeechRecognition = windowObj.SpeechRecognition || windowObj.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Tu navegador no soporta la API de reconocimiento de voz. Por favor usa Google Chrome, Brave o Edge.');
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

  private stopVoiceRecognition(): void {
    if (this.speechRecognition) {
      this.speechRecognition.stop();
      this.speechRecognition = null;
    }
    this.isVoiceListening.set(false);
  }

  // -------------------------------------------------------------
  // RECONOCIMIENTO MULTIMODAL (PEGAR, ARRASTRAR, CÁMARA, SUBIR)
  // -------------------------------------------------------------
  triggerImageInput(): void {
    this.imageInputRef?.nativeElement?.click();
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.processImageFile(input.files[0]);
    }
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
      navigator.clipboard.read().then((data) => {
        for (const item of data) {
          for (const type of item.types) {
            if (type.startsWith('image/')) {
              item.getType(type).then((blob) => {
                this.processImageFile(new File([blob], 'captura_portapapeles.png', { type }));
              });
              return;
            }
          }
        }
        alert('No se encontró ninguna imagen en el portapapeles. Usa Ctrl+V o presiona "Impr Pant" primero.');
      }).catch(() => {
        alert('Para pegar imágenes usa directamente el atajo Ctrl+V en el campo de texto.');
      });
    } else {
      alert('Para pegar imágenes usa directamente el atajo Ctrl+V en el campo de texto.');
    }
  }

  removeAttachedImage(): void {
    this.attachedImageBase64.set(null);
    this.attachedImageName.set(null);
  }

  private processImageFile(file: File): void {
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido (PNG, JPG, JPEG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      this.attachedImageBase64.set(base64);
      this.attachedImageName.set(file.name || 'boceto_capturado.png');
    };
    reader.readAsDataURL(file);
  }

  // -------------------------------------------------------------
  // CÁMARA WEB
  // -------------------------------------------------------------
  openWebcamModal(): void {
    this.showWebcamModal.set(true);
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        setTimeout(() => {
          if (this.webcamVideoRef?.nativeElement) {
            this.webcamVideoRef.nativeElement.srcObject = stream;
          }
        }, 100);
      })
      .catch(() => {
        alert('No se pudo acceder a la cámara. Verifica los permisos del navegador.');
        this.showWebcamModal.set(false);
      });
  }

  closeWebcamModal(): void {
    if (this.webcamVideoRef?.nativeElement?.srcObject) {
      const stream = this.webcamVideoRef.nativeElement.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
    this.showWebcamModal.set(false);
  }

  captureWebcamPhoto(): void {
    if (!this.webcamVideoRef?.nativeElement) return;
    const video = this.webcamVideoRef.nativeElement;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL('image/jpeg', 0.9);
      this.attachedImageBase64.set(base64);
      this.attachedImageName.set('foto_pizarra_' + new Date().toISOString().slice(11, 19).replace(/:/g, '-') + '.jpg');
    }
    this.closeWebcamModal();
  }

  // -------------------------------------------------------------
  // ACCIONES DEL HISTORIAL
  // -------------------------------------------------------------
  copySessionHistory(): void {
    const list = this.sessionHistory();
    if (list.length === 0) {
      alert('No hay eventos registrados en el historial de esta sesión.');
      return;
    }

    const formatted = list
      .map((e) => `[${new Date(e.timestamp).toLocaleTimeString()}] ${e.actor} | ${e.title}: ${e.description}`)
      .join('\n');

    navigator.clipboard.writeText(formatted).then(() => {
      alert('Historial de la sesión copiado al portapapeles.');
    });
  }

  askAiAboutSession(): void {
    this.activeAiTab.set('chat');
    this.aiPrompt.set('Resume y analiza el trabajo que hemos realizado en esta sesión según el historial de actividad.');
  }

  clearChat(): void {
    this.aiChatMessages.set([
      {
        id: 'welcome',
        sender: 'ai',
        text: '¡Historial de chat reiniciado! ¿En qué puedo ayudarte ahora?',
        timestamp: new Date(),
      },
    ]);
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.chatScrollContainerRef?.nativeElement) {
        this.chatScrollContainerRef.nativeElement.scrollTop = this.chatScrollContainerRef.nativeElement.scrollHeight;
      }
    }, 100);
  }
}
