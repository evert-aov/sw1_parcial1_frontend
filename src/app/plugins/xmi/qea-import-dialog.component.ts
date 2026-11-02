import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroArrowDownTray,
  heroArrowPath,
  heroArrowUpTray,
  heroCheck,
  heroCircleStack,
  heroCloudArrowUp,
  heroExclamationTriangle,
  heroInformationCircle,
  heroTrash,
  heroXMark,
} from '@ng-icons/heroicons/outline';
import { XmiService, QeaDiagramPreview } from '../../core/plugins/contracts/xmi.service.contract';
import { DiagramService } from '../../core/services/diagram.service';
import { TranslatePipe } from '../../core/i18n/pipes/translate.pipe';

@Component({
  selector: 'app-qea-import-dialog',
  standalone: true,
  imports: [TranslatePipe, NgIconComponent],
  providers: [
    provideIcons({
      heroArrowDownTray,
      heroArrowPath,
      heroArrowUpTray,
      heroCheck,
      heroCircleStack,
      heroCloudArrowUp,
      heroExclamationTriangle,
      heroInformationCircle,
      heroTrash,
      heroXMark,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialog
      class="qea-dialog"
      (cancel)="$event.preventDefault(); dismiss()"
      (click)="onBackdropClick($event)"
      (pointerdown)="$event.stopPropagation()"
      (keydown)="$event.stopPropagation()"
    >
      <div
        class="bg-white dark:bg-[#111528] text-slate-800 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] w-full text-xs"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qea-title"
        [attr.aria-busy]="busy()"
        (click)="$event.stopPropagation()"
      >
        <!-- Modal Header -->
        <header
          class="border-b border-slate-100 dark:border-slate-800 px-5 py-4 flex items-center justify-between gap-3 shrink-0"
        >
          <div class="flex items-center gap-3">
            <div
              class="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/50 flex items-center justify-center shrink-0 shadow-xs"
            >
              <ng-icon name="heroCircleStack" class="text-lg"></ng-icon>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2
                  id="qea-title"
                  class="font-bold text-sm text-slate-800 dark:text-slate-100 tracking-tight"
                >
                  {{ 'qeaImport.title' | translate }}
                </h2>
                <span
                  class="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-medium"
                >
                  Enterprise Architect
                </span>
              </div>
              <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                {{ 'qeaImport.description' | translate }}
              </p>
            </div>
          </div>
          <button
            type="button"
            [disabled]="busy()"
            (click)="dismiss()"
            [attr.aria-label]="'qeaImport.close' | translate"
            class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40 leading-none shrink-0"
          >
            <ng-icon name="heroXMark" class="text-lg block"></ng-icon>
          </button>
        </header>

        <!-- Modal Body -->
        <div class="p-5 space-y-4 overflow-y-auto min-h-0 flex-1">
          <!-- Hidden Native File Input -->
          <input
            #fileInput
            type="file"
            accept=".qea"
            [disabled]="busy() || imported()"
            (change)="selectFile($event)"
            [attr.aria-label]="'qeaImport.file' | translate"
            class="hidden"
          />

          <!-- Drag and Drop Upload Zone -->
          @if (!selectedFile()) {
            <div
              role="button"
              tabindex="0"
              (click)="fileInput.click()"
              (keydown.enter)="fileInput.click()"
              (keydown.space)="fileInput.click()"
              (dragover)="onDragOver($event)"
              (dragleave)="onDragLeave($event)"
              (drop)="onDrop($event)"
              class="border-2 border-dashed rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer select-none group"
              [class]="
                isDragging()
                  ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/60 ring-4 ring-blue-500/10 scale-[1.01]'
                  : 'border-slate-200 dark:border-slate-800 hover:border-blue-500/70 dark:hover:border-blue-400/70 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-blue-50/30 dark:hover:bg-blue-950/20'
              "
            >
              <div
                class="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center text-blue-600 dark:text-blue-400 text-2xl group-hover:scale-105 transition-all mb-3"
              >
                <ng-icon name="heroCloudArrowUp" class="text-2xl"></ng-icon>
              </div>

              <h3 class="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                @if (isDragging()) {
                  {{ 'qeaImport.dragActive' | translate }}
                } @else {
                  {{ 'qeaImport.dropzoneTitle' | translate }}
                }
              </h3>
              <p class="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                {{ 'qeaImport.dropzoneSubtitle' | translate }}
              </p>

              <span
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs text-xs font-medium text-slate-700 dark:text-slate-200 group-hover:border-blue-400 dark:group-hover:border-blue-500 transition-colors"
              >
                <ng-icon name="heroArrowUpTray" class="text-xs text-slate-500 dark:text-slate-400"></ng-icon>
                <span>{{ 'qeaImport.browseFiles' | translate }}</span>
              </span>
            </div>
          } @else {
            <!-- Selected File Card Preview -->
            <div
              class="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3 shadow-xs"
            >
              <div class="flex items-center gap-3 min-w-0">
                <div
                  class="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/50 flex items-center justify-center shrink-0"
                >
                  <ng-icon name="heroCircleStack" class="text-base"></ng-icon>
                </div>
                <div class="min-w-0">
                  <p class="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate max-w-xs sm:max-w-md">
                    {{ selectedFile()?.name }}
                  </p>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                    {{ formattedFileSize() }} · {{ 'qeaImport.repository' | translate }}
                  </p>
                </div>
              </div>

              <button
                type="button"
                (click)="clearFile(fileInput)"
                [disabled]="busy() || imported()"
                class="text-xs text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 px-2.5 py-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40 shrink-0"
              >
                <ng-icon name="heroTrash" class="text-sm"></ng-icon>
                <span>{{ 'qeaImport.changeFile' | translate }}</span>
              </button>
            </div>
          }

          <!-- Busy State -->
          @if (busy()) {
            <div
              role="status"
              class="p-4 bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/50 rounded-xl flex items-center gap-3"
            >
              <ng-icon name="heroArrowPath" class="text-blue-600 dark:text-blue-400 text-lg animate-spin shrink-0"></ng-icon>
              <div>
                <p class="text-xs font-semibold text-blue-900 dark:text-blue-200">
                  {{ 'qeaImport.processing' | translate }}
                </p>
                <p class="text-[11px] text-blue-700/80 dark:text-blue-300/80 mt-0.5">
                  {{ 'qeaImport.analyzing' | translate }}
                </p>
              </div>
            </div>
          }

          <!-- Error Alert -->
          @if (error()) {
            <div
              role="alert"
              class="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 rounded-xl flex items-start gap-2.5 text-xs"
            >
              <ng-icon
                name="heroExclamationTriangle"
                class="text-base text-red-600 dark:text-red-400 shrink-0 mt-0.5"
              ></ng-icon>
              <div class="min-w-0 flex-1">
                <p class="font-semibold">{{ 'qeaImport.failed' | translate }}</p>
                <p class="text-[11px] text-red-600 dark:text-red-300 mt-0.5 break-words">{{ error() }}</p>
              </div>
            </div>
          }

          <!-- Success Alert -->
          @if (imported()) {
            <div
              role="status"
              class="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200 rounded-xl flex items-center gap-3 text-xs"
            >
              <div
                class="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0"
              >
                <ng-icon name="heroCheck" class="text-base font-bold"></ng-icon>
              </div>
              <div>
                <p class="font-bold text-emerald-900 dark:text-emerald-100">
                  {{ 'qeaImport.importSuccessTitle' | translate }}
                </p>
                <p class="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                  {{ 'qeaImport.success' | translate }}
                </p>
              </div>
            </div>
          }

          <!-- Diagrams Checklist -->
          @if (diagrams().length > 0) {
            <div class="space-y-2 pt-1">
              <div class="flex items-center justify-between gap-2 px-0.5">
                <div class="flex items-center gap-2">
                  <h3 class="font-semibold text-xs text-slate-800 dark:text-slate-100">
                    {{ 'qeaImport.detectedDiagrams' | translate }}
                  </h3>
                  <span
                    class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                  >
                    {{ compatibleCount() }} {{ 'qeaImport.compatibleCount' | translate }}
                  </span>
                </div>

                @if (selectableIds().length) {
                  <button
                    type="button"
                    [disabled]="busy() || imported()"
                    (click)="toggleAll()"
                    class="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline cursor-pointer flex items-center gap-1 disabled:opacity-40"
                  >
                    <ng-icon [name]="allSelected() ? 'heroXMark' : 'heroCheck'" class="text-xs"></ng-icon>
                    <span>
                      {{
                        (allSelected()
                          ? 'qeaImport.deselectAll'
                          : compatibleCount() > 100
                            ? 'qeaImport.selectFirstBatch'
                            : 'qeaImport.selectAll'
                        ) | translate
                      }}
                    </span>
                  </button>
                }
              </div>

              <div class="space-y-2 max-h-60 sm:max-h-64 overflow-y-auto pr-1">
                @for (diagram of diagrams(); track diagram.id) {
                  <label
                    class="flex items-start gap-3 p-3 rounded-xl border transition-all select-none"
                    [class]="
                      selected().includes(diagram.id)
                        ? 'bg-blue-50/60 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 shadow-xs cursor-pointer'
                        : diagram.supported
                          ? 'bg-white dark:bg-[#0E1326] border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer'
                          : 'bg-slate-50/60 dark:bg-slate-900/30 border-slate-200/50 dark:border-slate-800/50 opacity-60 cursor-not-allowed'
                    "
                  >
                    <input
                      type="checkbox"
                      [disabled]="busy() || imported() || !diagram.supported"
                      [checked]="selected().includes(diagram.id)"
                      (change)="toggle(diagram.id)"
                      class="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 dark:bg-slate-800 mt-0.5 cursor-pointer disabled:cursor-not-allowed shrink-0"
                    />
                    <div class="flex-1 min-w-0 space-y-1">
                      <div class="flex items-center justify-between gap-2">
                        <strong class="font-semibold text-xs text-slate-800 dark:text-slate-100 truncate">
                          {{ diagram.name }}
                        </strong>
                        <span
                          class="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wide border shrink-0 font-medium"
                          [class]="
                            getDiagramTypeStyle(diagram.type).bg +
                            ' ' +
                            getDiagramTypeStyle(diagram.type).text +
                            ' ' +
                            getDiagramTypeStyle(diagram.type).border
                          "
                        >
                          {{ diagram.type }}
                        </span>
                      </div>
                      <div class="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        @if (diagram.packageName) {
                          <span class="truncate max-w-[140px]">
                            <span class="text-slate-400 dark:text-slate-500">{{ 'qeaImport.package' | translate }}:</span>
                            {{ diagram.packageName }}
                          </span>
                          <span>·</span>
                        }
                        <span>{{ diagram.nodeCount }} {{ 'qeaImport.nodes' | translate }}</span>
                        <span>·</span>
                        <span>{{ diagram.connectionCount }} {{ 'qeaImport.connections' | translate }}</span>
                      </div>
                      @if (!diagram.supported) {
                        <p class="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1 mt-1 font-medium">
                          <ng-icon name="heroExclamationTriangle" class="text-xs"></ng-icon>
                          {{ 'qeaImport.unsupported' | translate }}
                        </p>
                      }
                      @for (warning of diagram.warnings; track $index) {
                        <p class="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1">
                          <ng-icon name="heroExclamationTriangle" class="text-xs"></ng-icon>
                          {{ warning }}
                        </p>
                      }
                    </div>
                  </label>
                }
              </div>

              <!-- Limitations Notice -->
              <div
                class="p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80 rounded-xl flex items-start gap-2.5 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed"
              >
                <ng-icon name="heroInformationCircle" class="text-sm text-slate-400 dark:text-slate-500 shrink-0 mt-0.5"></ng-icon>
                <p>{{ 'qeaImport.limitations' | translate }}</p>
              </div>
            </div>
          }
        </div>

        <!-- Modal Footer -->
        <footer
          class="border-t border-slate-100 dark:border-slate-800 px-5 py-3.5 bg-slate-50/50 dark:bg-[#0E1326] flex items-center justify-between gap-3 shrink-0"
        >
          <div>
            @if (selected().length > 0) {
              <span class="text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-blue-500"></span>
                {{ selected().length }} {{ 'qeaImport.selectedCount' | translate }}
              </span>
            }
          </div>

          <div class="flex items-center gap-2.5">
            <button
              type="button"
              [disabled]="busy()"
              (click)="dismiss()"
              class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 transition-colors cursor-pointer disabled:opacity-40"
            >
              {{ 'qeaImport.close' | translate }}
            </button>
            <button
              type="button"
              [disabled]="busy() || imported() || !selected().length || selected().length > 100"
              (click)="confirm()"
              class="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer shadow-blue-500/10"
            >
              @if (busy()) {
                <ng-icon name="heroArrowPath" class="text-xs animate-spin"></ng-icon>
              } @else {
                <ng-icon name="heroArrowDownTray" class="text-xs"></ng-icon>
              }
              <span>{{ 'qeaImport.confirm' | translate }} ({{ selected().length }})</span>
            </button>
          </div>
        </footer>
      </div>
    </dialog>
  `,
  styles: [
    `
      :host {
        display: contents;
      }
      dialog.qea-dialog {
        padding: 0;
        border: 0;
        background: transparent;
        max-width: min(680px, 95vw);
        width: 100%;
        max-height: 90vh;
        margin: auto;
        overflow: visible;
        outline: none;
      }
      dialog.qea-dialog::backdrop {
        background: rgba(15, 23, 42, 0.65);
        backdrop-filter: blur(4px);
      }
    `,
  ],
})
export class QeaImportDialogComponent {
  readonly projectId = input.required<string>();
  readonly closed = output<void>();
  readonly busy = signal(false);
  readonly error = signal('');
  readonly imported = signal(false);
  readonly diagrams = signal<QeaDiagramPreview[]>([]);
  readonly selected = signal<number[]>([]);
  readonly isDragging = signal(false);
  readonly selectedFile = signal<File | null>(null);

  readonly compatibleCount = computed(
    () => this.diagrams().filter((diagram) => diagram.supported).length,
  );
  readonly selectableIds = computed(() =>
    this.diagrams()
      .filter((diagram) => diagram.supported)
      .slice(0, 100)
      .map((diagram) => diagram.id),
  );
  readonly allSelected = computed(
    () =>
      this.selectableIds().length > 0 &&
      this.selectableIds().every((id) => this.selected().includes(id)),
  );
  readonly formattedFileSize = computed(() => {
    const f = this.selectedFile();
    if (!f) return '';
    const bytes = f.size;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  });

  private file: File | null = null;
  private readonly exchange = inject(XmiService);
  private readonly catalog = inject(DiagramService);

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  /** Abre el diálogo modal nativo para aislar el foco y las teclas del lienzo. */
  constructor() {
    afterNextRender(() => {
      const el = this.dialog()?.nativeElement;
      if (el && typeof el.showModal === 'function' && !el.open) {
        el.showModal();
      }
    });
  }

  /** Permite cerrar cuando no hay una operación en curso. */
  dismiss(): void {
    if (!this.busy()) this.closed.emit();
  }

  /** Cierra al hacer clic en el backdrop fuera del modal. */
  onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog()?.nativeElement) {
      this.dismiss();
    }
  }

  /** Procesa el archivo seleccionado y consulta la previsualización de diagramas. */
  async processFile(file: File): Promise<void> {
    if (this.busy() || this.imported()) return;
    this.file = null;
    this.selectedFile.set(file);
    this.diagrams.set([]);
    this.selected.set([]);
    this.error.set('');
    if (file.size > 30 * 1024 * 1024) {
      this.error.set('30 MiB');
      return;
    }
    this.busy.set(true);
    try {
      this.diagrams.set(await firstValueFrom(this.exchange.previewQea(file)));
      this.file = file;
    } catch (error) {
      this.showError(error);
    } finally {
      this.busy.set(false);
    }
  }

  /** Maneja la selección desde el input file nativo. */
  async selectFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (file) {
      await this.processFile(file);
    }
  }

  /** Soporte drag & drop: al arrastrar sobre la zona. */
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.busy() && !this.imported()) {
      this.isDragging.set(true);
    }
  }

  /** Soporte drag & drop: al salir de la zona. */
  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  /** Soporte drag & drop: al soltar el archivo. */
  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
    if (this.busy() || this.imported()) return;
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      await this.processFile(file);
    }
  }

  /** Limpia el archivo cargado para permitir elegir otro. */
  clearFile(fileInput?: HTMLInputElement): void {
    if (this.busy() || this.imported()) return;
    this.file = null;
    this.selectedFile.set(null);
    this.diagrams.set([]);
    this.selected.set([]);
    this.error.set('');
    if (fileInput) {
      fileInput.value = '';
    }
  }

  /** Selecciona los diagramas compatibles del lote o limpia la selección completa. */
  toggleAll(): void {
    if (this.busy() || this.imported()) return;
    this.selected.set(this.allSelected() ? [] : [...this.selectableIds()]);
  }

  /** Cambia la selección explícita sin importar automáticamente los diagramas. */
  toggle(id: number): void {
    if (this.busy() || this.imported() || !this.diagrams().some((d) => d.id === id && d.supported))
      return;
    this.selected.update((ids) =>
      ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id],
    );
  }

  /** Confirma copias nuevas y actualiza el explorador sin reemplazar el lienzo activo. */
  async confirm(): Promise<void> {
    if (
      !this.file ||
      this.busy() ||
      this.imported() ||
      !this.selected().length ||
      this.selected().length > 100
    )
      return;
    this.busy.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.exchange.importQea(this.file, this.projectId(), this.selected()));
      this.imported.set(true);
      await firstValueFrom(this.catalog.loadDiagramsByProject(this.projectId()));
    } catch (error) {
      this.showError(error);
    } finally {
      this.busy.set(false);
    }
  }

  /** Retorna estilos de Tailwind acordes al tipo de diagrama para las etiquetas visuales. */
  getDiagramTypeStyle(type: string): { bg: string; text: string; border: string } {
    const t = (type || '').toLowerCase();
    if (t.includes('class') || t.includes('logical')) {
      return {
        bg: 'bg-blue-500/10 dark:bg-blue-500/20',
        text: 'text-blue-600 dark:text-blue-400',
        border: 'border-blue-500/30',
      };
    }
    if (t.includes('seq')) {
      return {
        bg: 'bg-purple-500/10 dark:bg-purple-500/20',
        text: 'text-purple-600 dark:text-purple-400',
        border: 'border-purple-500/30',
      };
    }
    if (t.includes('comm') || t.includes('collab')) {
      return {
        bg: 'bg-amber-500/10 dark:bg-amber-500/20',
        text: 'text-amber-600 dark:text-amber-400',
        border: 'border-amber-500/30',
      };
    }
    if (t.includes('use') || t.includes('case')) {
      return {
        bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
        text: 'text-emerald-600 dark:text-emerald-400',
        border: 'border-emerald-500/30',
      };
    }
    if (t.includes('pack')) {
      return {
        bg: 'bg-cyan-500/10 dark:bg-cyan-500/20',
        text: 'text-cyan-600 dark:text-cyan-400',
        border: 'border-cyan-500/30',
      };
    }
    return {
      bg: 'bg-slate-500/10 dark:bg-slate-500/20',
      text: 'text-slate-600 dark:text-slate-400',
      border: 'border-slate-500/30',
    };
  }

  /** Conserva el diagnóstico HTTP sin exponer el contenido binario del archivo. */
  private showError(error: unknown): void {
    const response = error as {
      error?: { message?: string | string[]; error?: { message?: string } };
      message?: string;
    };
    const message =
      response?.error?.error?.message ?? response?.error?.message ?? response?.message;
    this.error.set(Array.isArray(message) ? message.join('; ') : message || 'HTTP error');
  }
}
