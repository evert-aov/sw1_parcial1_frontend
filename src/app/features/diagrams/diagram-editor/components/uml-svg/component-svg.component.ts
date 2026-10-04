import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * UML 2.5 Component SVG Component
 * Represents a modular software component according to OMG UML 2.5 specifications.
 * Features the standard component rectangle with 2 protruding tabs on the left border.
 */
@Component({
  selector: 'app-component-svg',
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
      [attr.viewBox]="mode === 'glyph' ? '0 0 22 20' : (mode === 'icon' ? '0 0 32 24' : '0 0 120 60')"
      [attr.width]="width"
      [attr.height]="height"
      [style.width]="computedWidth"
      [style.height]="computedHeight"
      fill="none"
      [class]="className || (isCustomSize ? '' : 'w-full h-full')"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg">
      @if (mode === 'glyph') {
        <!-- Glifo clásico de Componente UML en esquina superior (rectángulo + 2 pestañas) -->
        <rect x="5" y="1" width="16" height="18" [attr.fill]="fillColor" [attr.stroke]="strokeColor" [attr.stroke-width]="strokeWidth" />
        <rect x="1" y="4" width="8" height="4.5" [attr.fill]="fillColor" [attr.stroke]="strokeColor" [attr.stroke-width]="strokeWidth" />
        <rect x="1" y="11.5" width="8" height="4.5" [attr.fill]="fillColor" [attr.stroke]="strokeColor" [attr.stroke-width]="strokeWidth" />
      } @else if (mode === 'icon') {
        <!-- Modo Icono para Toolbox / Paleta -->
        <!-- Rectángulo base del componente -->
        <rect x="2" y="2" width="28" height="20" rx="1" [attr.fill]="fillColor" [attr.stroke]="strokeColor" [attr.stroke-width]="strokeWidth" />
        <!-- Glifo UML en miniatura en la esquina superior derecha -->
        <rect x="22" y="4" width="6" height="7" [attr.fill]="fillColor" [attr.stroke]="strokeColor" stroke-width="1" />
        <rect x="20.5" y="5" width="3" height="1.8" [attr.fill]="fillColor" [attr.stroke]="strokeColor" stroke-width="0.8" />
        <rect x="20.5" y="7.8" width="3" height="1.8" [attr.fill]="fillColor" [attr.stroke]="strokeColor" stroke-width="0.8" />
        <!-- Línea representativa de texto -->
        <line x1="6" y1="12" x2="18" y2="12" [attr.stroke]="strokeColor" stroke-width="1.2" stroke-linecap="round" opacity="0.6" />
      } @else {
        <!-- Modo Completo con texto/etiqueta -->
        <rect x="2" y="2" width="116" height="56" rx="1" [attr.fill]="fillColor" [attr.stroke]="strokeColor" [attr.stroke-width]="strokeWidth" />
        <!-- Glifo en esquina -->
        <rect x="98" y="6" width="16" height="18" [attr.fill]="fillColor" [attr.stroke]="strokeColor" stroke-width="1.2" />
        <rect x="94" y="9" width="8" height="4.5" [attr.fill]="fillColor" [attr.stroke]="strokeColor" stroke-width="1.2" />
        <rect x="94" y="16.5" width="8" height="4.5" [attr.fill]="fillColor" [attr.stroke]="strokeColor" stroke-width="1.2" />
        @if (label || name) {
          <text
            x="14"
            y="34"
            [attr.fill]="textColor || strokeColor"
            font-family="system-ui, -apple-system, sans-serif"
            font-size="11"
            font-weight="600">
            {{ label || name }}
          </text>
        }
      }
    </svg>
  `
})
export class ComponentSvgComponent {
  @Input() width: number | string = '100%';
  @Input() height: number | string = '100%';
  @Input() mode: 'glyph' | 'icon' | 'full' = 'glyph';
  @Input() fillColor: string = '#F8E5E5';
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
