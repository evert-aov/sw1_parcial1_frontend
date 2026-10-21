import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface UmlAttributeItem {
  name: string;
  type?: string;
  isPk?: boolean;
  isFk?: boolean;
  visibility?: '+' | '-' | '#' | '~';
}

export interface UmlMethodItem {
  name: string;
  returnType?: string;
  parameters?: string;
  visibility?: '+' | '-' | '#' | '~';
}

/**
 * UML 2.5 Table / Class SVG Component
 * Represents a Database Table or UML Class element with standard 3-compartment layout:
 * 1. Name & Stereotype compartment (<<table>> or Class Name)
 * 2. Attributes / Columns compartment
 * 3. Operations / Methods compartment
 */
@Component({
  selector: 'app-table-svg, app-class-svg',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.viewBox]="mode === 'icon' ? '0 0 48 40' : ('0 0 ' + fullWidth + ' ' + fullHeight)"
      [attr.width]="width"
      [attr.height]="height"
      fill="none"
      [class]="className"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg">
      @if (mode === 'icon') {
        <!-- Modo Icono Compacto (Toolbox / Sidebar / Paleta) -->
        <!-- Contenedor exterior -->
        <rect
          x="3"
          y="3"
          width="42"
          height="34"
          rx="1"
          [attr.fill]="fillColor"
          [attr.stroke]="strokeColor"
          [attr.stroke-width]="strokeWidth"
        />
        <!-- Separador de cabecera -->
        <line
          x1="3"
          y1="13"
          x2="45"
          y2="13"
          [attr.stroke]="strokeColor"
          [attr.stroke-width]="strokeWidth"
        />
        <!-- Separador de métodos/atributos -->
        <line
          x1="3"
          y1="25"
          x2="45"
          y2="25"
          [attr.stroke]="strokeColor"
          [attr.stroke-width]="strokeWidth"
        />
        <!-- Líneas decorativas internas -->
        <line x1="8" y1="8" x2="22" y2="8" [attr.stroke]="strokeColor" stroke-width="1.5" stroke-linecap="round" />
        <line x1="8" y1="18" x2="36" y2="18" [attr.stroke]="strokeColor" stroke-width="1" stroke-linecap="round" opacity="0.6" />
        <line x1="8" y1="21" x2="28" y2="21" [attr.stroke]="strokeColor" stroke-width="1" stroke-linecap="round" opacity="0.6" />
        <line x1="8" y1="30" x2="32" y2="30" [attr.stroke]="strokeColor" stroke-width="1" stroke-linecap="round" opacity="0.6" />
      } @else {
        <!-- Modo Nodo Completo UML 2.5 -->
        <!-- Fondo y Contorno Principal -->
        <rect
          x="1"
          y="1"
          [attr.width]="fullWidth - 2"
          [attr.height]="fullHeight - 2"
          [attr.fill]="fillColor"
          [attr.stroke]="strokeColor"
          [attr.stroke-width]="strokeWidth"
        />

        <!-- Compartimento 1: Cabecera (Nombre + Estereotipo) -->
        @if (stereotype) {
          <text
            [attr.x]="fullWidth / 2"
            y="14"
            text-anchor="middle"
            [attr.fill]="textColor"
            font-family="system-ui, -apple-system, sans-serif"
            font-size="8.5"
            font-style="italic">
            «{{ stereotype }}»
          </text>
        }
        <text
          [attr.x]="fullWidth / 2"
          [attr.y]="stereotype ? 28 : 20"
          text-anchor="middle"
          [attr.fill]="textColor"
          font-family="system-ui, -apple-system, sans-serif"
          font-size="11.5"
          font-weight="bold">
          {{ name }}
        </text>

        <!-- Divisor 1 -->
        <line
          x1="1"
          [attr.y1]="headerHeight"
          [attr.x2]="fullWidth - 1"
          [attr.y2]="headerHeight"
          [attr.stroke]="strokeColor"
          [attr.stroke-width]="strokeWidth"
        />

        <!-- Compartimento 2: Atributos / Columnas -->
        @for (attr of attributes; track attr.name + $index) {
          <text
            x="8"
            [attr.y]="headerHeight + 14 + ($index * 14)"
            [attr.fill]="textColor"
            font-family="monospace, sans-serif"
            font-size="9.5">
            {{ attr.visibility || '+' }} {{ attr.name }}{{ attr.type ? ': ' + attr.type : '' }}{{ attr.isPk ? ' [PK]' : '' }}{{ attr.isFk ? ' [FK]' : '' }}
          </text>
        }

        <!-- Divisor 2 -->
        @if (methods && methods.length > 0) {
          <line
            x1="1"
            [attr.y1]="headerHeight + attributesHeight"
            [attr.x2]="fullWidth - 1"
            [attr.y2]="headerHeight + attributesHeight"
            [attr.stroke]="strokeColor"
            [attr.stroke-width]="strokeWidth"
          />

          <!-- Compartimento 3: Métodos / Operaciones -->
          @for (m of methods; track m.name + $index) {
            <text
              x="8"
              [attr.y]="headerHeight + attributesHeight + 14 + ($index * 14)"
              [attr.fill]="textColor"
              font-family="monospace, sans-serif"
              font-size="9.5">
              {{ m.visibility || '+' }} {{ m.name }}({{ m.parameters || '' }}){{ m.returnType ? ': ' + m.returnType : '' }}
            </text>
          }
        }
      }
    </svg>
  `
})
export class TableSvgComponent {
  @Input() width: number | string = '100%';
  @Input() height: number | string = '100%';
  @Input() fillColor: string = '#FDFAF3';
  @Input() strokeColor: string = '#796354';
  @Input() strokeWidth: number = 1.5;
  @Input() textColor: string = '#241C18';
  @Input() name: string = 'Table';
  @Input() stereotype?: string = 'table';
  @Input() attributes: UmlAttributeItem[] = [];
  @Input() methods: UmlMethodItem[] = [];
  @Input() mode: 'icon' | 'node' = 'icon';
  @Input() className: string = 'w-full h-full';

  /** Altura en píxeles del compartimento de cabecera que aloja el nombre y estereotipo. */
  get headerHeight(): number {
    return this.stereotype ? 34 : 26;
  }

  /** Altura en píxeles del compartimento de atributos de la clase o entidad. */
  get attributesHeight(): number {
    return Math.max(22, (this.attributes?.length || 0) * 14 + 8);
  }

  /** Altura en píxeles del compartimento de métodos u operaciones. */
  get methodsHeight(): number {
    return (this.methods?.length || 0) > 0 ? (this.methods.length * 14 + 8) : 0;
  }

  /** Ancho base predeterminado de renderizado para el elemento SVG. */
  get fullWidth(): number {
    return 160;
  }

  /** Altura total calculada sumando cabecera, atributos y métodos. */
  get fullHeight(): number {
    return this.headerHeight + this.attributesHeight + this.methodsHeight;
  }
}

/** Alias export for UML Class */
export const ClassSvgComponent = TableSvgComponent;
