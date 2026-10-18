import { DropNodePayload } from '../../services/diagram-node-operations.service';
export { AutofocusInputDirective } from '../../directives/autofocus-input.directive';

export type DiagramDropPayload = DropNodePayload;

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
