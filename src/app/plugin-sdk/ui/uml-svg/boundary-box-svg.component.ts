import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * UML 2.5 Grouping Boundary / Recuadro Agrupador SVG Component
 * Represents a single boundary frame / grouping box in deployment diagrams.
 */
@Component({
  selector: 'app-boundary-box-svg',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.viewBox]="mode === 'icon' ? '0 0 32 28' : '0 0 100 80'"
      [attr.width]="width"
      [attr.height]="height"
      fill="none"
      [class]="className"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg">
      @if (mode === 'icon') {
        <!-- Modo Icono: Un solo recuadro limpio con borde -->
        <rect
          x="2"
          y="2"
          width="28"
          height="24"
          [attr.fill]="fillColor"
          [attr.stroke]="strokeColor"
          [attr.stroke-width]="strokeWidth"
          stroke-linejoin="round"
        />
      } @else {
        <!-- Modo Completo / Ilustrativo -->
        <rect
          x="2"
          y="2"
          width="96"
          height="76"
          [attr.fill]="fillColor"
          [attr.stroke]="strokeColor"
          [attr.stroke-width]="strokeWidth"
          stroke-linejoin="round"
        />
        @if (label || name) {
          <text
            x="8"
            y="16"
            [attr.fill]="textColor || strokeColor"
            font-family="system-ui, -apple-system, sans-serif"
            font-size="9"
            font-weight="bold">
            {{ label || name }}
          </text>
        }
      }
    </svg>
  `
})
export class BoundaryBoxSvgComponent {
  @Input() width: number | string = '100%';
  @Input() height: number | string = '100%';
  @Input() fillColor: string = 'transparent';
  @Input() strokeColor: string = '#1E293B';
  @Input() strokeWidth: number = 1.5;
  @Input() textColor: string = '#241C18';
  @Input() name: string = '';
  @Input() label: string = '';
  @Input() mode: 'icon' | 'full' = 'icon';
  @Input() className: string = 'w-full h-full';
}
