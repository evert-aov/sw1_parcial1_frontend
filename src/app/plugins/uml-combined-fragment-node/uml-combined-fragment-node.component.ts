import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroTrash } from '@ng-icons/heroicons/outline';
import { UmlClassNode } from '../../core/models/diagram.model';
import { TranslatePipe } from '../../core/i18n/index';
import {
  normalizeFragmentDividers,
  parseCombinedFragment,
  serializeCombinedFragment,
} from '../../plugin-sdk/combined-fragment.util';

/**
 * Renderizador de Fragmento Combinado UML 2.5 (`alt`, `opt`, `loop`, etc.) estilo Enterprise Architect.
 * Incluye borde con sombra inferior-derecha, pestaña pentagonal verde suave, guardas alineadas
 * y líneas divisorias horizontales discontinuas arrastrables verticalmente.
 */
@Component({
  selector: 'app-uml-combined-fragment-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, NgIconComponent, TranslatePipe],
  providers: [provideIcons({ heroTrash })],
  templateUrl: './uml-combined-fragment-node.component.html',
  host: {
    class: 'w-full h-full flex flex-col flex-1 min-h-0 min-w-0',
  },
})
export class UmlCombinedFragmentNodeComponent {
  @ViewChild('fragmentFrame') fragmentFrameRef?: ElementRef<HTMLElement>;

  readonly node = input.required<UmlClassNode>();
  readonly isSelected = input(false);
  readonly isLocked = input(false);
  readonly isReadOnly = input(false);
  readonly renamingNodeId = input<string | null>(null);

  readonly nodeClick = output<MouseEvent>();
  readonly deleteNode = output<MouseEvent>();
  readonly commitRename = output<string>();

  /** Posiciones temporales de los divisores (%) mientras el usuario arrastra una línea `---`. */
  readonly draggingDividers = signal<number[] | null>(null);
  readonly activeDividerIndex = signal<number | null>(null);

  /** Datos estructurados del fragmento (operador, guardas y divisores). */
  readonly fragment = computed(() => parseCombinedFragment(this.node()?.name));

  /** Divisores efectivos en porcentaje (prioriza el estado en vivo durante el arrastre). */
  readonly effectiveDividers = computed(() => {
    const live = this.draggingDividers();
    const frag = this.fragment();
    if (live && live.length === frag.dividers.length) {
      return live;
    }
    return frag.dividers;
  });

  /** Relleno interior transparente o tinte muy sutil si el usuario asignó un color personalizado. */
  readonly backgroundColor = computed(() => {
    const raw = (this.node()?.color || '').trim();
    if (!raw || raw.toUpperCase() === '#FFFFFF' || raw.toUpperCase() === '#FDFAF3') {
      return 'transparent';
    }
    if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
      const r = parseInt(raw.slice(1, 3), 16);
      const g = parseInt(raw.slice(3, 5), 16);
      const b = parseInt(raw.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, 0.14)`;
    }
    return raw;
  });

  /** Calcula la posición superior (%) de un operando según los divisores actuales. */
  getOperandTopPct(index: number): number {
    if (index <= 0) return 0;
    return this.effectiveDividers()[index - 1] ?? 0;
  }

  /** Calcula la altura (%) de un operando según los divisores actuales. */
  getOperandHeightPct(index: number): number {
    const dividers = this.effectiveDividers();
    const start = index <= 0 ? 0 : (dividers[index - 1] ?? 0);
    const end = index >= dividers.length ? 100 : (dividers[index] ?? 100);
    return Math.max(8, end - start);
  }

  /** Selecciona el fragmento combinado al hacer clic sobre su marco o pestaña. */
  onContainerClick(event: MouseEvent): void {
    this.nodeClick.emit(event);
  }

  /** Solicita la eliminación del fragmento combinado sin propagar el clic al lienzo. */
  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.deleteNode.emit(event);
  }

  /**
   * Inicia el arrastre vertical de una línea divisoria discontinua (`---`) entre operandos.
   * Bloquea el arrastre del nodo padre y persiste la nueva posición al soltar.
   */
  onDividerPointerDown(event: PointerEvent, dividerIndex: number): void {
    if (this.isLocked() || this.isReadOnly()) return;
    event.stopPropagation();
    event.preventDefault();

    const frameEl = this.fragmentFrameRef?.nativeElement;
    if (!frameEl) return;

    const frag = this.fragment();
    const baseDividers = [...frag.dividers];
    let latestDividers = [...baseDividers];

    this.activeDividerIndex.set(dividerIndex);
    this.draggingDividers.set(latestDividers);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const rect = frameEl.getBoundingClientRect();
      if (rect.height <= 0) return;

      const rawPct = ((moveEvent.clientY - rect.top) / rect.height) * 100;
      const minGap = 10;
      const minPct = dividerIndex === 0 ? 18 : latestDividers[dividerIndex - 1] + minGap;
      const maxPct =
        dividerIndex === latestDividers.length - 1
          ? 88
          : latestDividers[dividerIndex + 1] - minGap;

      const clamped = Math.round(Math.min(maxPct, Math.max(minPct, rawPct)) * 10) / 10;
      latestDividers = latestDividers.map((v, idx) => (idx === dividerIndex ? clamped : v));
      this.draggingDividers.set(latestDividers);
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      const finalDividers = normalizeFragmentDividers(latestDividers, frag.operands.length);
      this.activeDividerIndex.set(null);
      this.draggingDividers.set(null);

      const changed = finalDividers.some((val, idx) => Math.abs(val - baseDividers[idx]) >= 0.1);
      if (changed) {
        this.commitRename.emit(
          serializeCombinedFragment(frag.operator, frag.operands, finalDividers),
        );
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }
}
