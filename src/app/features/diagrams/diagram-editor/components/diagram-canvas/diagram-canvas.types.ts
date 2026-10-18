import { DropNodePayload } from '../../services/diagram-node-operations.service';
export { AutofocusInputDirective } from '../../directives/autofocus-input.directive';

export type DiagramDropPayload = DropNodePayload;

/** Transformación de vista expuesta por el adaptador de compatibilidad del lienzo. */
export interface CanvasViewTransform {
  scale: number;
  position: { x: number; y: number };
  scaledPosition: { x: number; y: number };
}

/** Adaptador de compatibilidad `canvas` (escala, reseteo y redibujado) sobre el escenario Konva. */
export interface CanvasTransformAdapter {
  readonly transform: CanvasViewTransform;
  resetScale: () => void;
  setScale: (scale: number) => void;
  redraw: () => void;
}

export interface NodeResizeRect {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

export interface CanvasCreateConnectionEvent {
  fOutputId: string;
  fInputId: string;
  [key: string]: unknown;
}

export interface CanvasReassignConnectionEvent {
  connectionId: string;
  newSourceId?: string;
  newTargetId?: string;
  [key: string]: unknown;
}

export interface CanvasMoveNodesEvent {
  nodeIds: string[];
  [key: string]: unknown;
}

export interface CanvasSelectionChangeEvent {
  nodes: string[];
  connections: string[];
}
