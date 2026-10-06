import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * UML 2.5 Use Case SVG Component
 * Represents an action or service provided by the system to an actor.
 * Standard OMG UML 2.5 horizontal ellipse notation.
 */
@Component({
  selector: 'app-use-case-svg',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.width]': 'computedWidth',
    '[style.height]': 'computedHeight',
    '[style.display]': "width === '100%' ? 'flex' : 'inline-flex'",
    'class': 'shrink-0 items-center justify-center'
  },
  template: `
    <svg
      viewBox="0 0 90 54"
      [attr.width]="width"
      [attr.height]="height"
      [style.width]="computedWidth"
      [style.height]="computedHeight"
      fill="none"
      [class]="className || (isCustomSize ? '' : 'w-full h-full')"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg">
      <!-- Elipse principal del Caso de Uso -->
      <ellipse
        cx="45"
        cy="27"
        rx="42"
        ry="24"
        [attr.fill]="fillColor"
        [attr.stroke]="strokeColor"
        [attr.stroke-width]="strokeWidth"
      />

      <!-- Texto / Nombre del Caso de Uso -->
      @if (label || name) {
        <text
          x="45"
          y="30"
          text-anchor="middle"
          [attr.fill]="textColor || strokeColor"
          font-family="system-ui, -apple-system, sans-serif"
          font-size="9.5"
          font-weight="600">
          {{ label || name }}
        </text>
      }
    </svg>
  `
})
export class UseCaseSvgComponent {
  @Input() width: number | string = '100%';
  @Input() height: number | string = '100%';
  @Input() fillColor: string = '#FEF2DD';
  @Input() strokeColor: string = '#796354';
  @Input() strokeWidth: number = 1.5;
  @Input() textColor: string = '#241C18';
  @Input() label: string = '';
  @Input() name: string = '';
  @Input() className: string = '';

  get isCustomSize(): boolean {
    return this.width !== '100%' || this.height !== '100%';
  }

  get computedWidth(): string {
    if (typeof this.width === 'number') return `${this.width}px`;
    return this.width;
  }

  get computedHeight(): string {
    if (typeof this.height === 'number') return `${this.height}px`;
    return this.height;
  }
}
