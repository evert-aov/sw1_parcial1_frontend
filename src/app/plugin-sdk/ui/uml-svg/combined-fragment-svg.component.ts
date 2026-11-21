import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Componente SVG para representar el icono y miniatura de un Fragmento Combinado UML 2.5 (`alt`, `opt`, `loop`).
 */
@Component({
  selector: 'app-combined-fragment-svg',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      viewBox="0 0 48 38"
      [attr.width]="width"
      [attr.height]="height"
      fill="none"
      [class]="className"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
    >
      <!-- Marco principal del fragmento -->
      <rect
        x="4"
        y="4"
        width="40"
        height="30"
        [attr.fill]="fillColor"
        [attr.stroke]="strokeColor"
        [attr.stroke-width]="strokeWidth"
      />
      <!-- Pestaña pentagonal del operador (alt) -->
      <path
        d="M 4 4 L 21 4 L 21 11 L 17 15 L 4 15 Z"
        fill="#E2E8F0"
        [attr.stroke]="strokeColor"
        [attr.stroke-width]="strokeWidth"
        stroke-linejoin="round"
      />
      <!-- Texto del operador -->
      <text
        x="7"
        y="12"
        font-size="7"
        font-weight="700"
        font-family="ui-sans-serif, system-ui, sans-serif"
        [attr.fill]="strokeColor"
      >alt</text>
      <!-- Separador discontinuo entre operandos -->
      <line
        x1="4"
        y1="21"
        x2="44"
        y2="21"
        [attr.stroke]="strokeColor"
        stroke-width="1.3"
        stroke-dasharray="3,2.5"
      />
      <!-- Indicadores de guarda -->
      <line x1="25" y1="11" x2="39" y2="11" [attr.stroke]="strokeColor" stroke-width="1.2" opacity="0.55" />
      <line x1="8" y1="27" x2="20" y2="27" [attr.stroke]="strokeColor" stroke-width="1.2" opacity="0.55" />
    </svg>
  `,
})
export class CombinedFragmentSvgComponent {
  @Input() width: number | string = '100%';
  @Input() height: number | string = '100%';
  @Input() fillColor: string = '#FFFFFF';
  @Input() strokeColor: string = '#475569';
  @Input() strokeWidth: number = 1.6;
  @Input() className: string = 'w-full h-full';
}
