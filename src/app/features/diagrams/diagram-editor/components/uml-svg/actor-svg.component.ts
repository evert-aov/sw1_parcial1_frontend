import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * UML 2.5 Actor SVG Component
 * Represents a human or external entity interacting with the system.
 * Standard stick-figure notation according to OMG UML 2.5 specifications.
 */
@Component({
  selector: 'app-actor-svg',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.viewBox]="showLabel && label ? '0 0 48 78' : '5 1 38 64'"
      [attr.width]="width"
      [attr.height]="height"
      fill="none"
      [class]="className"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg">
      <!-- Cabeza circular estándar UML 2.5 -->
      <path
        d="M 24 2 A 10 10 0 0 1 24 22 A 10 10 0 0 1 24 2 Z"
        [attr.fill]="fillColor"
        [attr.stroke]="strokeColor"
        [attr.stroke-width]="strokeWidth"
      />
      <!-- Columna / Tronco -->
      <line
        x1="24"
        y1="22"
        x2="24"
        y2="43"
        [attr.stroke]="strokeColor"
        [attr.stroke-width]="strokeWidth"
      />
      <!-- Brazos horizontales -->
      <line
        x1="7"
        y1="31"
        x2="41"
        y2="31"
        [attr.stroke]="strokeColor"
        [attr.stroke-width]="strokeWidth"
        stroke-linecap="round"
      />
      <!-- Piernas -->
      <line
        x1="24"
        y1="43"
        x2="10"
        y2="63"
        [attr.stroke]="strokeColor"
        [attr.stroke-width]="strokeWidth"
        stroke-linecap="round"
      />
      <line
        x1="24"
        y1="43"
        x2="38"
        y2="63"
        [attr.stroke]="strokeColor"
        [attr.stroke-width]="strokeWidth"
        stroke-linecap="round"
      />

      <!-- Etiqueta opcional bajo el actor -->
      @if (showLabel && label) {
        <text
          x="24"
          y="74"
          text-anchor="middle"
          [attr.fill]="labelColor || strokeColor"
          font-family="system-ui, -apple-system, sans-serif"
          font-size="9"
          font-weight="600">
          {{ label }}
        </text>
      }
    </svg>
  `
})
export class ActorSvgComponent {
  @Input() width: number | string = '100%';
  @Input() height: number | string = '100%';
  @Input() fillColor: string = '#FFFDDD';
  @Input() strokeColor: string = '#241C18';
  @Input() strokeWidth: number = 1.5;
  @Input() label?: string;
  @Input() showLabel: boolean = false;
  @Input() labelColor?: string;
  @Input() className: string = 'w-full h-full';
}
