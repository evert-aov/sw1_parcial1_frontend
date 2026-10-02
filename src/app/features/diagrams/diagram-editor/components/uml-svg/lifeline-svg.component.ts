import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * UML 2.5 Lifeline SVG Component
 * Represents an individual participant in a Sequence Diagram interaction.
 * Comprises a header box, a vertical dashed timeline, and activation bars.
 */
@Component({
  selector: 'app-lifeline-svg',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.viewBox]="mode === 'icon' ? '0 0 40 48' : '0 0 80 120'"
      [attr.width]="width"
      [attr.height]="height"
      fill="none"
      [class]="className"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg">
      @if (mode === 'icon') {
        <!-- Modo Icono Compacto -->
        <!-- Cabecera -->
        <rect
          x="6"
          y="4"
          width="28"
          height="14"
          rx="1"
          [attr.fill]="fillColor"
          [attr.stroke]="strokeColor"
          [attr.stroke-width]="strokeWidth"
        />
        <!-- Línea vertical discontinua -->
        <line
          x1="20"
          y1="18"
          x2="20"
          y2="46"
          [attr.stroke]="strokeColor"
          stroke-width="1.2"
          stroke-dasharray="3,2"
        />
        <!-- Barra de activación mini -->
        <rect
          x="18"
          y="24"
          width="4"
          height="14"
          [attr.fill]="fillColor"
          [attr.stroke]="strokeColor"
          stroke-width="1"
        />
      } @else {
        <!-- Modo Nodo / Preview UML 2.5 -->
        <!-- Cabecera -->
        <rect
          x="10"
          y="6"
          width="60"
          height="24"
          rx="2"
          [attr.fill]="fillColor"
          [attr.stroke]="strokeColor"
          [attr.stroke-width]="strokeWidth"
        />
        <!-- Nombre de la Línea de Vida -->
        <text
          x="40"
          y="21"
          text-anchor="middle"
          [attr.fill]="textColor || strokeColor"
          font-family="system-ui, -apple-system, sans-serif"
          font-size="9"
          font-weight="bold"
          text-decoration="underline">
          {{ name || 'Lifeline' }}
        </text>

        <!-- Línea vertical discontinua -->
        <line
          x1="40"
          y1="30"
          x2="40"
          y2="116"
          [attr.stroke]="strokeColor"
          [attr.stroke-width]="strokeWidth"
          stroke-dasharray="6,4"
        />

        <!-- Barra de Activación (Execution Focus) -->
        <rect
          x="36"
          y="48"
          width="8"
          height="44"
          [attr.fill]="fillColor"
          [attr.stroke]="strokeColor"
          stroke-width="1"
        />
      }
    </svg>
  `
})
export class LifelineSvgComponent {
  @Input() width: number | string = '100%';
  @Input() height: number | string = '100%';
  @Input() fillColor: string = '#D2EEF3';
  @Input() strokeColor: string = '#796354';
  @Input() strokeWidth: number = 1.5;
  @Input() textColor: string = '#241C18';
  @Input() name: string = 'Lifeline';
  @Input() mode: 'icon' | 'node' = 'icon';
  @Input() className: string = 'w-full h-full';
}
