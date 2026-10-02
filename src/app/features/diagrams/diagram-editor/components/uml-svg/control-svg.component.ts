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
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.viewBox]="showLabel && label ? '4 0 48 58' : '8 2 40 46'"
      [attr.width]="width"
      [attr.height]="height"
      fill="none"
      [class]="className"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg">
      <!-- Círculo principal del Control -->
      <circle
        cx="28"
        cy="28"
        r="18"
        [attr.fill]="fillColor"
        [attr.stroke]="strokeColor"
        [attr.stroke-width]="strokeWidth"
      />
      <!-- Flecha angular superior indicando control cíclico / coordinación -->
      <polyline
        points="36,3.5 26,10.2 36,17"
        [attr.stroke]="strokeColor"
        [attr.stroke-width]="strokeWidth"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <!-- Etiqueta opcional -->
      @if (showLabel && label) {
        <text
          x="28"
          y="56"
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
  @Input() className: string = 'w-full h-full';
}
