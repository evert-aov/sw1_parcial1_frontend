import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * UML 2.5 Robustness Control SVG Component
 * Represents a controller/mediator element handling business logic and coordination.
 * Standard Robustness Diagram notation (circle with a directional arrowhead at the top).
 */
@Component({
  selector: 'app-control-svg',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      overflow: visible;
    }
  `],
  host: {
    '[style.width]': 'computedWidth',
    '[style.height]': 'computedHeight',
    '[style.display]': "width === '100%' ? 'flex' : 'inline-flex'",
    'class': 'shrink-0'
  },
  template: `
    <svg
      [attr.viewBox]="showLabel && label ? '2 0 44 60' : '2 0 44 44'"
      [attr.width]="width"
      [attr.height]="height"
      [style.width]="computedWidth"
      [style.height]="computedHeight"
      fill="none"
      [class]="className || (isCustomSize ? '' : 'w-full h-full')"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg">
      <!-- Círculo principal del Control (mismo radio que Entity: r=18) -->
      <circle
        cx="24"
        cy="24"
        r="18"
        [attr.fill]="fillColor"
        [style.fill]="fillColor"
        [attr.stroke]="strokeColor"
        [style.stroke]="strokeColor"
        [attr.stroke-width]="strokeWidth"
      />
      <!-- Flecha angular superior indicando control cíclico / coordinación -->
      <polyline
        points="31,1.8 21,6.4 29,12.5"
        [attr.stroke]="strokeColor"
        [style.stroke]="strokeColor"
        [attr.stroke-width]="strokeWidth"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <!-- Etiqueta opcional -->
      @if (showLabel && label) {
        <text
          x="24"
          y="58"
          text-anchor="middle"
          [attr.fill]="labelColor || strokeColor"
          font-family="system-ui, -apple-system, sans-serif"
          font-size="8.5"
          font-weight="600">
          {{ label }}
        </text>
      }
    </svg>
  `
})
export class ControlSvgComponent {
  @Input() width: number | string = '100%';
  @Input() height: number | string = '100%';
  @Input() fillColor: string = '#D2EEF3';
  @Input() strokeColor: string = '#241C18';
  @Input() strokeWidth: number = 1.5;
  @Input() label?: string;
  @Input() showLabel: boolean = false;
  @Input() labelColor?: string;
  @Input() className: string = '';

  /** Determina si el nodo de control tiene dimensiones personalizadas explícitas. */
  get isCustomSize(): boolean {
    return this.width !== '100%' || this.height !== '100%';
  }

  /** Ancho calculado con sufijo de unidad CSS para la etiqueta SVG. */
  get computedWidth(): string {
    if (typeof this.width === 'number') return `${this.width}px`;
    return this.width;
  }

  /** Altura calculada con sufijo de unidad CSS para la etiqueta SVG. */
  get computedHeight(): string {
    if (typeof this.height === 'number') return `${this.height}px`;
    return this.height;
  }
}
