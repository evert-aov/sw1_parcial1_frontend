import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, OnDestroy, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { TranslatePipe } from '../../../core/i18n/index';
import { ChatMessage, ChatProvider } from '../../../core/plugins/contracts/ai-assistant.service.contract';
import { ConversationStateService } from '../conversation-state.service';
import { ChatMediaService } from '../chat-media.service';
import { AiAssistantService } from '../ai-assistant.service';
import { ChatMarkdownComponent } from '../chat-markdown.component';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroArrowsPointingIn, heroArrowsPointingOut, heroCamera, heroChatBubbleLeftRight, heroCheck, heroChevronDown, heroChevronLeft, heroChevronRight, heroClipboard, heroMicrophone, heroPaperAirplane, heroPhoto, heroPlus, heroSparkles, heroStop, heroXMark } from '@ng-icons/heroicons/outline';

/** Panel grupal: presenta conversación y propuestas sin ejecutar mutaciones locales del AST. */
@Component({ selector: 'app-ai-assistant-panel', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TranslatePipe, ChatMarkdownComponent, NgIconComponent],
  providers: [ConversationStateService, ChatMediaService, provideIcons({ heroArrowsPointingIn, heroArrowsPointingOut, heroCamera, heroChatBubbleLeftRight, heroCheck, heroChevronDown, heroChevronLeft, heroChevronRight, heroClipboard, heroMicrophone, heroPaperAirplane, heroPhoto, heroPlus, heroSparkles, heroStop, heroXMark })],
  templateUrl: './ai-assistant-panel.component.html',
  styleUrl: './ai-assistant-panel.component.css',
  host: { '[class.panel-expanded]': 'expanded()', '[style.--panel-width]': 'panelWidth() + "px"', '(document:pointerdown)': 'dismissMenus($event)', '(keydown.escape)': 'onEscape($event)' },
})
export class AiAssistantPanelComponent implements OnDestroy {
  readonly state = inject(ConversationStateService);
  readonly media = inject(ChatMediaService);
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
  readonly askAssistant = signal(false);
  readonly applying = signal<string | null>(null);
  readonly assets = signal<Record<string, string>>({});
  readonly error = signal('');
  readonly selectedModel = computed(() => this.state.models()?.models.find(model => model.provider === this.provider()));
  @ViewChild('historyContainer') historyContainer?: ElementRef<HTMLDivElement>;
  private generation = 0;
  private lastSequence = 0;

  /** Alterna el menú solicitado y mantiene un solo desplegable abierto. */
  toggleMenu(menu: 'attachments' | 'models'): void { this.menu.update(current => current === menu ? null : menu); }

  /** Selecciona un proveedor disponible sin reiniciar la conversación ni el borrador. */
  selectProvider(provider: ChatProvider): void {
    if (this.state.sending() || !this.state.models()?.models.some(model => model.provider === provider && model.available)) return;
    this.provider.set(provider);
    this.menu.set(null);
  }

  /** Cierra los desplegables al pulsar fuera de sus controles. */
  dismissMenus(event: Event): void {
    if (!(event.target instanceof Element) || !this.element.nativeElement.contains(event.target) || !event.target.closest('[data-chat-menu]')) this.menu.set(null);
  }

  /** Cierra menús o restaura el ancho lateral sin propagar Escape al lienzo. */
  onEscape(event: Event): void {
    if (!this.menu() && !this.expanded()) return;
    event.stopPropagation();
    if (this.menu()) this.element.nativeElement.querySelector<HTMLButtonElement>(`[data-menu-trigger="${this.menu()}"]`)?.focus();
    this.menu() ? this.menu.set(null) : this.expanded.set(false);
  }

  /** Cambia entre ancho compacto y ampliado conservando la instancia del chat. */
  toggleWidth(): void { this.setPanelWidth(this.panelWidth() > 500 ? 420 : 720); }

  /** Limita el ancho al espacio disponible y mantiene una franja visible del editor. */
  private setPanelWidth(width: number): void {
    const host = this.element.nativeElement;
    const parent = host.parentElement;
    const occupied = Array.from(parent?.children || [])
      .filter(sibling => sibling !== host && getComputedStyle(sibling).flexGrow === '0')
      .reduce((total, sibling) => total + sibling.getBoundingClientRect().width, 0);
    const available = (parent?.clientWidth || window.innerWidth) - occupied;
    this.panelWidth.set(Math.round(Math.max(320, Math.min(width, Math.max(320, available - 160)))));
  }

  /** Inicia el ajuste mediante captura de puntero para soportar ratón y pantalla táctil. */
  startResize(event: PointerEvent): void {
    if (event.button !== 0 || this.expanded()) return;
    event.preventDefault();
    this.resizeStart = { x: event.clientX, width: this.element.nativeElement.getBoundingClientRect().width || this.panelWidth() };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  /** Ajusta el ancho desde el borde izquierdo mientras el puntero permanece capturado. */
  resize(event: PointerEvent): void {
    if (this.resizeStart) this.setPanelWidth(this.resizeStart.width + this.resizeStart.x - event.clientX);
  }

  /** Finaliza el arrastre, incluida la cancelación por pérdida de captura. */
  stopResize(): void { this.resizeStart = null; }

  /** Ofrece ajuste de ancho por teclado en el separador accesible. */
  resizeWithKeyboard(event: KeyboardEvent): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    this.setPanelWidth(event.key === 'Home' ? 420 : this.panelWidth() + (event.key === 'ArrowLeft' ? 40 : -40));
  }

  /** Sincroniza el panel con el diagrama activo y limpia capturas al cambiar de pestaña. */
  constructor() {
    effect(() => {
      const diagramId = this.diagramId();
      // Solo el cambio de diagrama reinicia la sesión; las lecturas de limpieza no son dependencias.
      untracked(() => {
        this.generation++;
        this.state.connect(diagramId);
        this.media.reset();
        this.prompt.set('');
        this.error.set('');
        this.applying.set(null);
        this.lastSequence = 0;
        this.releaseAssets();
      });
    });
    effect(() => {
      const latest = this.state.messages().at(-1)?.sequence || 0;
      if (latest > this.lastSequence) {
        const element = this.historyContainer?.nativeElement;
        const follow = !this.lastSequence || !element || element.scrollHeight - element.scrollTop - element.clientHeight < 120;
        const generation = this.generation;
        if (follow) setTimeout(() => {
          const container = this.historyContainer?.nativeElement;
          if (container && generation === this.generation) container.scrollTop = container.scrollHeight;
        });
      }
      this.lastSequence = latest;
    });
    effect(() => { const models = this.state.models(); if (models) this.provider.set(models.defaultProvider); });
  }

  /** Publica una intervención; limpia el borrador únicamente tras aceptación del servidor. */
  async send(): Promise<void> {
    if (this.media.recording() || this.media.busy() || (!this.prompt().trim() && !this.media.attachment())) return;
    const generation = this.generation;
    const attachment = this.media.attachment();
    const sent = await this.state.send({ content: this.prompt().trim(), provider: this.provider(), askAssistant: this.askAssistant(), ...(attachment ? { attachment } : {}) });
    if (sent && generation === this.generation) { this.prompt.set(''); this.media.clear(); }
  }

  /** Reserva Enter para envío y permite Shift+Enter para redactar varias líneas. */
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); void this.send(); }
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
    const image = Array.from(event.clipboardData?.items || []).find(item => item.type.startsWith('image/'))?.getAsFile();
    if (image) { event.preventDefault(); void this.media.attachImage(image, 'clipboard.png'); }
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
        const mime = item.types.find(type => type.startsWith('image/'));
        if (mime) {
          const blob = await item.getType(mime);
          if (generation === this.generation && !this.state.sending()) await this.media.attachImage(blob, 'clipboard.png');
          return;
        }
      }
      const text = await navigator.clipboard.readText();
      if (generation === this.generation && !this.state.sending()) this.prompt.update(value => value + (value ? '\n' : '') + text);
    } catch { this.error.set('chat.clipboardError'); }
  }

  /** Aplica únicamente una propuesta revisada y bloquea el botón durante la petición. */
  async apply(message: ChatMessage): Promise<void> {
    const diagramId = this.diagramId();
    if (!diagramId || !message.proposal || this.applying() || !this.canEdit() || this.hasUnsavedChanges()) return;
    const generation = this.generation;
    this.applying.set(message.id);
    this.error.set('');
    try {
      await firstValueFrom(this.api.apply(diagramId, message.proposal.id));
      if (generation === this.generation) this.proposalApplied.emit(diagramId);
    } catch (error: unknown) {
      if (generation === this.generation) {
        const messages: Partial<Record<number, string>> = {
          400: 'chat.invalidProposal', 422: 'chat.invalidProposal',
          403: 'chat.applyForbidden', 409: 'chat.conflict',
        };
        this.error.set(messages[(error as { status?: number } | null)?.status ?? 0] ?? 'chat.applyFailed');
      }
    } finally { if (generation === this.generation) this.applying.set(null); }
  }

  /** Descarga un adjunto privado solo cuando el participante decide abrirlo. */
  async openAttachment(message: ChatMessage): Promise<void> {
    const diagramId = this.diagramId();
    if (!diagramId || this.assets()[message.id]) return;
    const generation = this.generation;
    try {
      const blob = await firstValueFrom(this.api.attachment(diagramId, message.id));
      if (generation !== this.generation) return;
      const url = URL.createObjectURL(blob);
      this.assets.update(assets => ({ ...assets, [message.id]: url }));
    } catch { if (generation === this.generation) this.error.set('chat.mediaError'); }
  }

  /** Revoca todos los recursos locales al cerrar el panel. */
  ngOnDestroy(): void { this.generation++; this.releaseAssets(); }

  /** Evita retener imágenes y audios después de salir de la conversación. */
  private releaseAssets(): void { Object.values(this.assets()).forEach(url => URL.revokeObjectURL(url)); this.assets.set({}); }
}
