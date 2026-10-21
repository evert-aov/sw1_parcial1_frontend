import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * UML 2.5 Robustness Boundary SVG Component
 * Represents a boundary/interface element (user interface, system border, API).
 * Standard Robustness Diagram notation (circle connected to vertical boundary line).
 */
@Component({
  selector: 'app-boundary-svg',
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
      [attr.viewBox]="showLabel && label ? '1 4 44 56' : '1 4 44 40'"
      [attr.width]="width"
      [attr.height]="height"
      [style.width]="computedWidth"
      [style.height]="computedHeight"
      fill="none"
      [class]="className || (isCustomSize ? '' : 'w-full h-full')"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg">
      <!-- Línea vertical del borde/frontera -->
      <line
        x1="3"
        y1="8"
        x2="3"
        y2="40"
        [attr.stroke]="strokeColor"
        [style.stroke]="strokeColor"
        [attr.stroke-width]="strokeWidth"
        stroke-linecap="round"
      />
      <!-- Enlace horizontal entre la línea y el círculo -->
      <line
        x1="3"
        y1="24"
        x2="7"
        y2="24"
        [attr.stroke]="strokeColor"
        [style.stroke]="strokeColor"
        [attr.stroke-width]="strokeWidth"
      />
      <!-- Círculo principal del Boundary (mismo radio que Entity: r=18) -->
      <circle
        cx="25"
        cy="24"
        r="18"
        [attr.fill]="fillColor"
        [style.fill]="fillColor"
        [attr.stroke]="strokeColor"
        [style.stroke]="strokeColor"
        [attr.stroke-width]="strokeWidth"
      />

      <!-- Etiqueta opcional -->
      @if (showLabel && label) {
        <text
          x="25"
          y="54"
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
export class BoundarySvgComponent {
  @Input() width: number | string = '100%';
  @Input() height: number | string = '100%';
  @Input() fillColor: string = '#D2EEF3';
  @Input() strokeColor: string = '#241C18';
  @Input() strokeWidth: number = 1.5;
  @Input() label?: string;
  @Input() showLabel: boolean = false;
  @Input() labelColor?: string;
  @Input() className: string = '';

  /** Determina si el nodo frontera tiene dimensiones personalizadas explícitas. */
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
