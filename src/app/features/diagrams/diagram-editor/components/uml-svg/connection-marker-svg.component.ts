import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UmlRelationshipType } from '../../../../../core/models/diagram.model';

export interface UmlMarkerConfig {
  hasMarker: boolean;
  width: number;
  height: number;
  refX: number;
  refY: number;
  viewBox: string;
  type: 'start-all-states' | 'end-all-states';
}

/**
 * Helper to compute the Foblex Flow marker geometry and attributes for any UML 2.5 relationship.
 */
export function getUmlMarkerConfig(
  relationType: UmlRelationshipType | string | null | undefined,
  isStartDiamond: boolean = false
): UmlMarkerConfig {
  const type = relationType || 'association';

  switch (type) {
    case 'generalization':
    case 'realization':
      return {
        hasMarker: true,
        width: 16,
        height: 16,
        refX: 15,
        refY: 8,
        viewBox: '0 0 16 16',
        type: 'end-all-states'
      };

    case 'composition':
      return {
        hasMarker: true,
        width: 18,
        height: 14,
        refX: isStartDiamond ? 1 : 17,
        refY: 7,
        viewBox: '0 0 18 14',
        type: isStartDiamond ? 'start-all-states' : 'end-all-states'
      };

    case 'aggregation':
      return {
        hasMarker: true,
        width: 18,
        height: 14,
        refX: isStartDiamond ? 1 : 17,
        refY: 7,
        viewBox: '0 0 18 14',
        type: isStartDiamond ? 'start-all-states' : 'end-all-states'
      };

    case 'dependency':
    case 'include':
    case 'extend':
    case 'import':
    case 'access':
    case 'merge':
    case 'trace':
      return {
        hasMarker: true,
        width: 16,
        height: 16,
        refX: 14,
        refY: 8,
        viewBox: '0 0 16 16',
        type: 'end-all-states'
      };

    case 'sync':
    case 'self':
      return {
        hasMarker: true,
        width: 12,
        height: 12,
        refX: 11,
        refY: 6,
        viewBox: '0 0 12 12',
        type: 'end-all-states'
      };

    case 'reply':
      return {
        hasMarker: true,
        width: 12,
        height: 12,
        refX: 11,
        refY: 6,
        viewBox: '0 0 12 12',
        type: 'end-all-states'
      };

    case 'async':
    case 'create':
      return {
        hasMarker: true,
        width: 12,
        height: 12,
        refX: 11,
        refY: 6,
        viewBox: '0 0 12 12',
        type: 'end-all-states'
      };

    default:
      return {
        hasMarker: false,
        width: 0,
        height: 0,
        refX: 0,
        refY: 0,
        viewBox: '0 0 0 0',
        type: 'end-all-states'
      };
  }
}

/**
 * UML 2.5 Connection Marker SVG Component
 * Attaches directly onto <svg fMarker appUmlMarker ...> to render the correct marker shape
 * according to OMG UML 2.5 specifications.
 */
@Component({
  selector: 'svg[fMarker][appUmlMarker]',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (relationType === 'generalization' || relationType === 'realization') {
      <!-- Triángulo hueco UML 2.5 (Herencia / Realización) -->
      <svg:polygon points="1,1 15,8 1,15" class="uml-marker-hollow" />
    } @else if (relationType === 'composition') {
      <!-- Rombo relleno UML 2.5 (Composición) -->
      <svg:polygon points="1,7 9,1 17,7 9,13" class="uml-marker-filled" />
    } @else if (relationType === 'aggregation') {
      <!-- Rombo hueco UML 2.5 (Agregación) -->
      <svg:polygon points="1,7 9,1 17,7 9,13" class="uml-marker-hollow" />
    } @else if (relationType === 'dependency' || relationType === 'include' || relationType === 'extend' || relationType === 'import' || relationType === 'access' || relationType === 'merge' || relationType === 'trace') {
      <!-- Flecha abierta simple (Dependencia / Estereotipos) -->
      <svg:polyline points="2,2 14,8 2,14" class="uml-marker-open" />
    } @else if (relationType === 'sync' || relationType === 'self' || isSequencePlain) {
      <!-- Flecha triangular sólida rellena (Llamada síncrona / Self) -->
      <svg:polygon
        points="1,2 11,6 1,10"
        [style.fill]="customColor || undefined"
        [style.stroke]="customColor || undefined"
        [ngClass]="{
          'fill-[#2D3748] dark:fill-slate-200 stroke-[#2D3748] dark:stroke-slate-200': !customColor
        }"
        stroke-width="1"
      />
    } @else if (relationType === 'reply') {
      <!-- Flecha abierta de retorno (Mensaje reply) -->
      <svg:polyline
        points="2,2 11,6 2,10"
        fill="none"
        [style.stroke]="customColor || undefined"
        [ngClass]="{
          'stroke-[#2D3748] dark:stroke-slate-200': !customColor
        }"
        stroke-width="1.4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    } @else if (relationType === 'async' || relationType === 'create') {
      <!-- Flecha abierta de interacción (Mensaje asíncrono / Create) -->
      <svg:polyline
        points="2,2 11,6 2,10"
        fill="none"
        [style.stroke]="customColor || undefined"
        [ngClass]="{
          'stroke-[#2D3748] dark:stroke-slate-200': !customColor
        }"
        stroke-width="1.4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    }
  `
})
export class ConnectionMarkerSvgComponent {
  @Input() relationType: UmlRelationshipType | string | null = null;
  @Input() customColor: string | null = null;
  @Input() isSequencePlain: boolean = false;
}
