import { Type, InputSignal, OutputEmitterRef } from '@angular/core';
import {
  DiagramType,
  UmlClassNode,
  UmlConnection,
  UmlRelationshipType,
} from '../models/diagram.model';
import { PluginDefinition } from './plugin.contract';

export interface NodeCreationContext {
  nodes: UmlClassNode[];
  diagramType: DiagramType;
  position?: { x: number; y: number };
  stereotype?: string | null;
  scroll?: { scrollLeft: number; scrollTop: number };
}
export interface NodeRenderContext {
  node: UmlClassNode;
  connections: UmlConnection[];
  isSelected: boolean;
  isNeighbor: boolean;
  isLocked: boolean;
  isReadOnly: boolean;
  activeDiagramType: DiagramType;
  selectedRelationType: UmlRelationshipType | null;
  renamingNodeId: string | null;
}
export interface NodeTool {
  readonly id: string;
  readonly labelKey: string;
  readonly diagramTypes: readonly DiagramType[];
  readonly stereotype?: string;
  readonly icon?: Type<unknown>;
}
export interface NodeGeometry {
  width(node: UmlClassNode, activeDiagramType?: DiagramType): number;
  height(node: UmlClassNode, activeDiagramType?: DiagramType): number;
  dynamicWidth(node: UmlClassNode): number;
  readonly minWidth: number;
  readonly minHeight: number;
  readonly bottomOffset: number;
  readonly zIndex: readonly [number, number];
  readonly cssClass: string;
  readonly transparent: boolean;
  readonly fixedHeaderHeight?: number;
  readonly lockY?: boolean | ((node: UmlClassNode, activeDiagramType?: DiagramType) => boolean);
  readonly externalLabel?: boolean;
  readonly isResizable?: (node: UmlClassNode, activeDiagramType?: DiagramType) => boolean;
}
export interface NodeRenderer {
  readonly node: InputSignal<UmlClassNode>;
  readonly nodeClick?: OutputEmitterRef<MouseEvent>;
  readonly deleteNode?: OutputEmitterRef<MouseEvent>;
  readonly tableClick?: OutputEmitterRef<MouseEvent>;
  readonly labelDblClick?: OutputEmitterRef<MouseEvent>;
  readonly commitRename?: OutputEmitterRef<string>;
  readonly cancelRename?: OutputEmitterRef<void>;
}
export interface NodePlugin extends PluginDefinition {
  readonly nodeTypes: readonly string[];
  readonly stereotypeAliases?: readonly string[];
  readonly renderer: Type<NodeRenderer>;
  readonly geometry: NodeGeometry;
  readonly tools: readonly NodeTool[];
  readonly defaultColor: string;
  readonly resolveColor?: (node: Pick<UmlClassNode, 'nodeType' | 'stereotype'>) => string;
  create(context: NodeCreationContext): UmlClassNode;
  inputs(context: NodeRenderContext): Record<string, unknown>;
}
export function isNodePlugin(plugin: PluginDefinition): plugin is NodePlugin {
  return plugin.metadata.category === 'node' && 'nodeTypes' in plugin && 'renderer' in plugin;
}
