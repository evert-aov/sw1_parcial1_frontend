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
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.viewBox]="showLabel && label ? '0 8 58 48' : '6 10 48 36'"
      [attr.width]="width"
      [attr.height]="height"
      fill="none"
      [class]="className"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg">
      <!-- Línea vertical del borde/frontera -->
      <line
        x1="8"
        y1="12"
        x2="8"
        y2="44"
        [attr.stroke]="strokeColor"
        [attr.stroke-width]="strokeWidth"
        stroke-linecap="round"
      />
      <!-- Enlace horizontal entre la línea y el círculo -->
      <line
        x1="8"
        y1="28"
        x2="20"
        y2="28"
        [attr.stroke]="strokeColor"
        [attr.stroke-width]="strokeWidth"
      />
      <!-- Círculo principal del Boundary -->
      <circle
        cx="36"
        cy="28"
        r="16"
        [attr.fill]="fillColor"
        [attr.stroke]="strokeColor"
        [attr.stroke-width]="strokeWidth"
      />

      <!-- Etiqueta opcional -->
      @if (showLabel && label) {
        <text
          x="30"
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
  @Input() className: string = 'w-full h-full';
}
