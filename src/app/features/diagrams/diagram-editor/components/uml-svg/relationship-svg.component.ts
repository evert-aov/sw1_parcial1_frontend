import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export type UmlRelationType =
  | 'association'
  | 'direct_association'
  | 'generalization'
  | 'realization'
  | 'composition'
  | 'aggregation'
  | 'dependency'
  | 'association_class'
  | 'import'
  | 'access'
  | 'merge'
  | 'trace'
  | 'include'
  | 'extend'
  | 'sync'
  | 'reply'
  | 'async'
  | 'create'
  | 'self';

/**
 * UML 2.5 Relationship SVG Component
 * Represents all canonical UML 2.5 relationship types and connector markers:
 * - Association, Direct Association, Generalization, Realization, Composition, Aggregation, Dependency
 * - Package Imports/Access/Merge/Trace
 * - Use Case Include/Extend
 * - Sequence Messages: Sync, Reply, Async, Create, Self
 *
 * Supports 3 modes:
 * - 'icon': Compact horizontal thumbnail for toolbars, dropdowns, and palettes.
 * - 'preview': Full illustrative sample with line, markers, stereotype, and multiplicity.
 * - 'marker': Pure SVG marker element for standalone marker usage.
 */
@Component({
  selector: 'app-relationship-svg',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (mode === 'icon') {
      <!-- Modo Icono Horizontal (Toolbox / Paleta) -->
      <svg
        viewBox="0 0 46 16"
        [attr.width]="width"
        [attr.height]="height"
        fill="none"
        [class]="className"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg">
        
        <!-- Marcador en Origen (Rombo de Composición o Agregación) -->
        @if (type === 'composition' && diamondPosition === 'start') {
          <polygon points="1,8 6,4 11,8 6,12" [attr.fill]="strokeColor" [attr.stroke]="strokeColor" stroke-width="1.2" />
        } @else if (type === 'aggregation' && diamondPosition === 'start') {
          <polygon points="1,8 6,4 11,8 6,12" [attr.fill]="markerBgColor" [attr.stroke]="strokeColor" stroke-width="1.2" />
        }

        <!-- Línea Central -->
        <line
          [attr.x1]="getLineStartX()"
          y1="8"
          [attr.x2]="getLineEndX()"
          y2="8"
          [attr.stroke]="strokeColor"
          [attr.stroke-width]="strokeWidth"
          [attr.stroke-dasharray]="isDashed ? '3,2' : null"
        />

        <!-- Marcador en Destino -->
        @if (type === 'generalization' || type === 'realization') {
          <!-- Triángulo hueco UML -->
          <polygon points="36,4 44,8 36,12" [attr.fill]="markerBgColor" [attr.stroke]="strokeColor" stroke-width="1.2" />
        } @else if (type === 'composition' && diamondPosition !== 'start') {
          <!-- Rombo relleno negro -->
          <polygon points="35,8 40,4 45,8 40,12" [attr.fill]="strokeColor" [attr.stroke]="strokeColor" stroke-width="1.2" />
        } @else if (type === 'aggregation' && diamondPosition !== 'start') {
          <!-- Rombo hueco blanco -->
          <polygon points="35,8 40,4 45,8 40,12" [attr.fill]="markerBgColor" [attr.stroke]="strokeColor" stroke-width="1.2" />
        } @else if (type === 'dependency' || type === 'direct_association' || type === 'include' || type === 'extend' || type === 'import' || type === 'access' || type === 'merge' || type === 'trace') {
          <!-- Flecha abierta (stick) -->
          <polyline points="38,4 44,8 38,12" fill="none" [attr.stroke]="strokeColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
        } @else if (type === 'sync') {
          <!-- Flecha triangular sólida rellena -->
          <polygon points="36,4 44,8 36,12" [attr.fill]="strokeColor" [attr.stroke]="strokeColor" stroke-width="1" />
        } @else if (type === 'reply' || type === 'async' || type === 'create') {
          <!-- Flecha abierta para mensajes asíncronos y retorno -->
          <polyline points="38,4 44,8 38,12" fill="none" [attr.stroke]="strokeColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
        } @else if (type === 'self') {
          <!-- Bucle reflexivo -->
          <path d="M 28 8 C 28 2, 42 2, 42 8 C 42 14, 34 14, 34 10" fill="none" [attr.stroke]="strokeColor" stroke-width="1.2" />
          <polygon points="32,10 36,7 36,13" [attr.fill]="strokeColor" />
        }
      </svg>
    } @else if (mode === 'preview') {
      <!-- Modo Previsualización Completa con Etiquetas -->
      <svg
        viewBox="0 0 160 48"
        [attr.width]="width"
        [attr.height]="height"
        fill="none"
        [class]="className"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg">
        
        <!-- Multiplicidad origen -->
        @if (sourceMultiplicity) {
          <text x="12" y="16" [attr.fill]="strokeColor" font-family="monospace, sans-serif" font-size="8.5">
            {{ sourceMultiplicity }}
          </text>
        }

        <!-- Rombo origen -->
        @if (type === 'composition' && diamondPosition === 'start') {
          <polygon points="8,24 16,19 24,24 16,29" [attr.fill]="strokeColor" [attr.stroke]="strokeColor" stroke-width="1.2" />
        } @else if (type === 'aggregation' && diamondPosition === 'start') {
          <polygon points="8,24 16,19 24,24 16,29" [attr.fill]="markerBgColor" [attr.stroke]="strokeColor" stroke-width="1.2" />
        }

        <!-- Línea de conexión -->
        <line
          [attr.x1]="getPreviewLineStartX()"
          y1="24"
          [attr.x2]="getPreviewLineEndX()"
          y2="24"
          [attr.stroke]="strokeColor"
          [attr.stroke-width]="strokeWidth"
          [attr.stroke-dasharray]="isDashed ? '4,3' : null"
        />

        <!-- Nombre / Estereotipo en el centro -->
        @if (name || stereotypeText) {
          <text x="80" y="18" text-anchor="middle" [attr.fill]="strokeColor" font-family="system-ui, -apple-system, sans-serif" font-size="9" font-weight="600">
            {{ stereotypeText ? '«' + stereotypeText + '» ' : '' }}{{ name }}
          </text>
        }

        <!-- Marcador destino -->
        @if (type === 'generalization' || type === 'realization') {
          <polygon points="144,17 156,24 144,31" [attr.fill]="markerBgColor" [attr.stroke]="strokeColor" stroke-width="1.4" />
        } @else if (type === 'composition' && diamondPosition !== 'start') {
          <polygon points="138,24 146,19 154,24 146,29" [attr.fill]="strokeColor" [attr.stroke]="strokeColor" stroke-width="1.2" />
        } @else if (type === 'aggregation' && diamondPosition !== 'start') {
          <polygon points="138,24 146,19 154,24 146,29" [attr.fill]="markerBgColor" [attr.stroke]="strokeColor" stroke-width="1.2" />
        } @else if (type === 'dependency' || type === 'direct_association' || type === 'include' || type === 'extend' || type === 'import' || type === 'access' || type === 'merge' || type === 'trace') {
          <polyline points="146,18 156,24 146,30" fill="none" [attr.stroke]="strokeColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        } @else if (type === 'sync') {
          <polygon points="144,18 156,24 144,30" [attr.fill]="strokeColor" [attr.stroke]="strokeColor" stroke-width="1" />
        } @else if (type === 'reply' || type === 'async' || type === 'create') {
          <polyline points="146,18 156,24 146,30" fill="none" [attr.stroke]="strokeColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        }

        <!-- Multiplicidad destino -->
        @if (targetMultiplicity) {
          <text x="140" y="38" text-anchor="end" [attr.fill]="strokeColor" font-family="monospace, sans-serif" font-size="8.5">
            {{ targetMultiplicity }}
          </text>
        }
      </svg>
    } @else {
      <!-- Modo Marcador Individual Puro (SVG Marker standalone) -->
      <svg
        [attr.viewBox]="getMarkerBox()"
        [attr.width]="width"
        [attr.height]="height"
        fill="none"
        [class]="className"
        xmlns="http://www.w3.org/2000/svg">
        @if (type === 'generalization' || type === 'realization') {
          <polygon points="1,1 15,8 1,15" [attr.fill]="markerBgColor" [attr.stroke]="strokeColor" stroke-width="1.5" />
        } @else if (type === 'composition') {
          <polygon points="1,7 9,1 17,7 9,13" [attr.fill]="strokeColor" [attr.stroke]="strokeColor" stroke-width="1" />
        } @else if (type === 'aggregation') {
          <polygon points="1,7 9,1 17,7 9,13" [attr.fill]="markerBgColor" [attr.stroke]="strokeColor" stroke-width="1" />
        } @else if (type === 'dependency' || type === 'direct_association' || type === 'include' || type === 'extend' || type === 'import' || type === 'access' || type === 'merge' || type === 'trace') {
          <polyline points="2,2 14,8 2,14" fill="none" [attr.stroke]="strokeColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        } @else if (type === 'sync') {
          <polygon points="1,2 11,6 1,10" [attr.fill]="strokeColor" [attr.stroke]="strokeColor" stroke-width="1" />
        } @else if (type === 'reply' || type === 'async' || type === 'create') {
          <polyline points="2,2 11,6 2,10" fill="none" [attr.stroke]="strokeColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
        }
      </svg>
    }
  `
})
export class RelationshipSvgComponent {
  @Input() type: UmlRelationType = 'association';
  @Input() width: number | string = '100%';
  @Input() height: number | string = '100%';
  @Input() strokeColor: string = '#241C18';
  @Input() markerBgColor: string = '#FFFFFF';
  @Input() strokeWidth: number = 1.5;
  @Input() diamondPosition: 'start' | 'end' = 'start';
  @Input() name: string = '';
  @Input() stereotype?: string;
  @Input() sourceMultiplicity?: string;
  @Input() targetMultiplicity?: string;
  @Input() mode: 'icon' | 'preview' | 'marker' = 'icon';
  @Input() className: string = 'w-full h-full';

  get isDashed(): boolean {
    return (
      this.type === 'realization' ||
      this.type === 'dependency' ||
      this.type === 'include' ||
      this.type === 'extend' ||
      this.type === 'import' ||
      this.type === 'access' ||
      this.type === 'merge' ||
      this.type === 'trace' ||
      this.type === 'reply'
    );
  }

  get stereotypeText(): string {
    if (this.stereotype) return this.stereotype;
    if (this.type === 'include') return 'include';
    if (this.type === 'extend') return 'extend';
    if (this.type === 'import') return 'import';
    if (this.type === 'access') return 'access';
    if (this.type === 'merge') return 'merge';
    if (this.type === 'trace') return 'trace';
    return '';
  }

  getLineStartX(): number {
    if ((this.type === 'composition' || this.type === 'aggregation') && this.diamondPosition === 'start') {
      return 11;
    }
    return 2;
  }

  getLineEndX(): number {
    if (this.type === 'generalization' || this.type === 'realization') return 36;
    if ((this.type === 'composition' || this.type === 'aggregation') && this.diamondPosition !== 'start') return 35;
    if (this.type === 'dependency' || this.type === 'direct_association' || this.type === 'include' || this.type === 'extend' || this.type === 'import' || this.type === 'access' || this.type === 'merge' || this.type === 'trace') return 40;
    if (this.type === 'sync') return 36;
    if (this.type === 'reply' || this.type === 'async' || this.type === 'create') return 40;
    if (this.type === 'self') return 28;
    return 44;
  }

  getPreviewLineStartX(): number {
    if ((this.type === 'composition' || this.type === 'aggregation') && this.diamondPosition === 'start') {
      return 24;
    }
    return 8;
  }

  getPreviewLineEndX(): number {
    if (this.type === 'generalization' || this.type === 'realization') return 144;
    if ((this.type === 'composition' || this.type === 'aggregation') && this.diamondPosition !== 'start') return 138;
    if (this.type === 'dependency' || this.type === 'direct_association' || this.type === 'include' || this.type === 'extend' || this.type === 'import' || this.type === 'access' || this.type === 'merge' || this.type === 'trace') return 148;
    if (this.type === 'sync') return 144;
    if (this.type === 'reply' || this.type === 'async' || this.type === 'create') return 148;
    return 152;
  }

  getMarkerBox(): string {
    if (this.type === 'composition' || this.type === 'aggregation') return '0 0 18 14';
    if (this.type === 'sync' || this.type === 'reply' || this.type === 'async' || this.type === 'create') return '0 0 12 12';
    return '0 0 16 16';
  }
}
