import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * UML 2.5 Robustness Entity SVG Component
 * Represents persistent data, domain records, or entity information.
 * Standard Robustness Diagram notation (circle resting on a flat bottom tangent baseline).
 */
@Component({
  selector: 'app-entity-svg',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.viewBox]="showLabel && label ? '4 2 48 54' : '6 4 44 40'"
      [attr.width]="width"
      [attr.height]="height"
      fill="none"
      [class]="className"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg">
      <!-- Círculo principal de la Entidad -->
      <circle
        cx="28"
        cy="24"
        r="18"
        [attr.fill]="fillColor"
        [attr.stroke]="strokeColor"
        [attr.stroke-width]="strokeWidth"
      />
      <!-- Línea base tangente horizontal inferior -->
      <line
        x1="8"
        y1="42"
        x2="48"
        y2="42"
        [attr.stroke]="strokeColor"
        [attr.stroke-width]="strokeWidth"
        stroke-linecap="round"
      />

      <!-- Etiqueta opcional -->
      @if (showLabel && label) {
        <text
          x="28"
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
export class EntitySvgComponent {
  @Input() width: number | string = '100%';
  @Input() height: number | string = '100%';
  @Input() fillColor: string = '#D2EEF3';
  @Input() strokeColor: string = '#241C18';
  @Input() strokeWidth: number = 1.5;
  @Input() label?: string;
  @Input() showLabel: boolean = false;
  @Input() labelColor?: string;
  @Input() className: string = 'w-full h-full';
}
