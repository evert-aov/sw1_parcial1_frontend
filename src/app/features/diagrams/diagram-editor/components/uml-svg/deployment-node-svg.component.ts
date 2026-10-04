import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * UML 2.5 Deployment Node SVG Component
 * Represents a computational resource or physical device in 3D oblique / isometric projection.
 * Standard OMG UML 2.5 Node / Device notation.
 */
@Component({
  selector: 'app-deployment-node-svg',
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
    @if (mode === '3d-faces') {
      <!-- Caras 3D Superior y Lateral Derecha dinámicas para el lienzo (adaptadas al tamaño del nodo) -->
      <svg
        [attr.width]="nodeWidth"
        [attr.height]="nodeHeight"
        [style.width.px]="nodeWidth"
        [style.height.px]="nodeHeight"
        fill="none"
        class="overflow-visible pointer-events-none absolute inset-0"
        xmlns="http://www.w3.org/2000/svg">
        <!-- Cara Superior (Top Face) -->
        <polygon
          [attr.points]="topPoints"
          [attr.fill]="topColor || fillColor"
          [attr.stroke]="strokeColor"
          [attr.stroke-width]="strokeWidth"
          stroke-linejoin="round"
        />
        <!-- Cara Lateral Derecha (Right Face) -->
        <polygon
          [attr.points]="rightPoints"
          [attr.fill]="rightColor || fillColor"
          [attr.stroke]="strokeColor"
          [attr.stroke-width]="strokeWidth"
          stroke-linejoin="round"
        />
      </svg>
    } @else if (mode === 'icon') {
      <!-- Modo Icono 3D Compacto para Toolbox / Paleta / Explorador -->
      <svg
        viewBox="0 0 32 28"
        [attr.width]="width"
        [attr.height]="height"
        [style.width]="computedWidth"
        [style.height]="computedHeight"
        fill="none"
        [class]="className || (isCustomSize ? '' : 'w-full h-full')"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg">
        <!-- Cara Superior 3D -->
        <polygon
          points="2,8 7,2 29,2 24,8"
          [attr.fill]="topColor || '#E4F2FD'"
          [attr.stroke]="strokeColor"
          [attr.stroke-width]="strokeWidth"
          stroke-linejoin="round"
        />
        <!-- Cara Lateral Derecha 3D -->
        <polygon
          points="24,8 29,2 29,20 24,26"
          [attr.fill]="rightColor || '#AFD4EE'"
          [attr.stroke]="strokeColor"
          [attr.stroke-width]="strokeWidth"
          stroke-linejoin="round"
        />
        <!-- Cara Frontal 3D -->
        <rect
          x="2"
          y="8"
          width="22"
          height="18"
          [attr.fill]="fillColor"
          [attr.stroke]="strokeColor"
          [attr.stroke-width]="strokeWidth"
          stroke-linejoin="round"
        />
        <!-- Línea divisoria de cabecera -->
        <line x1="2" y1="13" x2="24" y2="13" [attr.stroke]="strokeColor" stroke-width="1" />
      </svg>
    } @else {
      <!-- Modo Completo Ilustrativo 3D -->
      <svg
        viewBox="0 0 100 80"
        [attr.width]="width"
        [attr.height]="height"
        [style.width]="computedWidth"
        [style.height]="computedHeight"
        fill="none"
        [class]="className || (isCustomSize ? '' : 'w-full h-full')"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg">
        <polygon
          points="2,14 14,2 98,2 86,14"
          [attr.fill]="topColor || '#E4F2FD'"
          [attr.stroke]="strokeColor"
          [attr.stroke-width]="strokeWidth"
          stroke-linejoin="round"
        />
        <polygon
          points="86,14 98,2 98,66 86,78"
          [attr.fill]="rightColor || '#AFD4EE'"
          [attr.stroke]="strokeColor"
          [attr.stroke-width]="strokeWidth"
          stroke-linejoin="round"
        />
        <rect
          x="2"
          y="14"
          width="84"
          height="64"
          [attr.fill]="fillColor"
          [attr.stroke]="strokeColor"
          [attr.stroke-width]="strokeWidth"
          stroke-linejoin="round"
        />
        <line x1="2" y1="28" x2="86" y2="28" [attr.stroke]="strokeColor" [attr.stroke-width]="strokeWidth" />
        @if (stereotype) {
          <text x="44" y="22" text-anchor="middle" [attr.fill]="textColor || strokeColor" font-size="7" font-style="italic">
            «{{ stereotype }}»
          </text>
        }
        @if (label || name) {
          <text x="44" y="38" text-anchor="middle" [attr.fill]="textColor || strokeColor" font-size="9" font-weight="bold">
            {{ label || name }}
          </text>
        }
      </svg>
    }
  `
})
export class DeploymentNodeSvgComponent {
  @Input() width: number | string = '100%';
  @Input() height: number | string = '100%';
  @Input() nodeWidth: number = 240;
  @Input() nodeHeight: number = 140;
  @Input() depth: number = 14;
  @Input() mode: 'icon' | '3d-faces' | 'full' = 'icon';
  @Input() fillColor: string = '#CDE6F7';
  @Input() topColor: string = '#E4F2FD';
  @Input() rightColor: string = '#AFD4EE';
  @Input() strokeColor: string = '#1E3A5F';
  @Input() strokeWidth: number = 1.5;
  @Input() textColor: string = '#241C18';
  @Input() stereotype: string = '';
  @Input() label: string = '';
  @Input() name: string = '';
  @Input() className: string = '';

  get topPoints(): string {
    const w = this.nodeWidth;
    const d = this.depth;
    return `0,${d} ${d},0 ${w},0 ${w - d},${d}`;
  }

  get rightPoints(): string {
    const w = this.nodeWidth;
    const h = this.nodeHeight;
    const d = this.depth;
    return `${w - d},${d} ${w},0 ${w},${h - d} ${w - d},${h}`;
  }

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
