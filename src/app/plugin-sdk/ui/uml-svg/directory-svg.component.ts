import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * UML 2.5 Package / Directory SVG Component
 * Represents a package or directory namespace grouping UML elements.
 * Features the canonical top-left tab (folder tab) and main body container.
 */
@Component({
  selector: 'app-directory-svg, app-package-svg',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.viewBox]="mode === 'icon' ? '0 0 48 38' : '0 0 160 110'"
      [attr.width]="width"
      [attr.height]="height"
      fill="none"
      [class]="className"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg">
      @if (mode === 'icon') {
        <!-- Modo Icono Compacto (Toolbox / Sidebar) -->
        <!-- Pestaña superior izquierda -->
        <path
          d="M 4 8 L 18 8 L 22 13 L 4 13 Z"
          [attr.fill]="fillColor"
          [attr.stroke]="strokeColor"
          [attr.stroke-width]="strokeWidth"
          stroke-linejoin="round"
        />
        <!-- Cuerpo principal del paquete -->
        <rect
          x="4"
          y="13"
          width="40"
          height="21"
          [attr.fill]="fillColor"
          [attr.stroke]="strokeColor"
          [attr.stroke-width]="strokeWidth"
          stroke-linejoin="round"
        />
      } @else {
        <!-- Modo Nodo Completo UML 2.5 -->
        <!-- Pestaña superior izquierda (Tab) -->
        <polygon
          points="4,6 64,6 72,24 4,24"
          [attr.fill]="fillColor"
          [attr.stroke]="strokeColor"
          [attr.stroke-width]="strokeWidth"
          stroke-linejoin="round"
        />
        <!-- Texto de la pestaña -->
        <text
          x="10"
          y="18"
          [attr.fill]="textColor || strokeColor"
          font-family="system-ui, -apple-system, sans-serif"
          font-size="10"
          font-weight="bold">
          {{ tabTitle || name || 'Package' }}
        </text>

        <!-- Cuerpo principal del paquete (Main Body) -->
        <rect
          x="4"
          y="24"
          width="152"
          height="80"
          [attr.fill]="fillColor"
          [attr.stroke]="strokeColor"
          [attr.stroke-width]="strokeWidth"
          stroke-linejoin="round"
        />

        <!-- Contenido / Texto dentro del cuerpo -->
        @if (bodyText) {
          <text
            x="12"
            y="42"
            [attr.fill]="textColor || strokeColor"
            font-family="system-ui, -apple-system, sans-serif"
            font-size="10"
            font-weight="normal">
            {{ bodyText }}
          </text>
        }
      }
    </svg>
  `
})
export class DirectorySvgComponent {
  @Input() width: number | string = '100%';
  @Input() height: number | string = '100%';
  @Input() fillColor: string = '#FAF1EC';
  @Input() strokeColor: string = '#796354';
  @Input() strokeWidth: number = 1.5;
  @Input() textColor: string = '#241C18';
  @Input() name: string = 'Package';
  @Input() tabTitle?: string;
  @Input() bodyText?: string;
  @Input() mode: 'icon' | 'node' = 'icon';
  @Input() className: string = 'w-full h-full';
}

/** Alias export for UML Package */
export const PackageSvgComponent = DirectorySvgComponent;
