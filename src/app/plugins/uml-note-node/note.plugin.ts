import { NoteSvgComponent } from '../../plugin-sdk/ui/uml-svg/note-svg.component';
import { DiagramType, UmlClassNode } from '../../core/models/diagram.model';
import { NodePlugin } from '../../core/plugins/node-plugin.contract';
import { calcPos } from '../../plugin-sdk/node-creation';
import { UmlNoteNodeComponent } from './uml-note-node.component';

const ALL_DIAGRAM_TYPES = Object.values(DiagramType);

const dynamicWidth = (node: UmlClassNode): number => {
  const longestLine = Math.max(
    18,
    ...(node.name || '')
      .split('\n')
      .map((line) => line.trim().length),
  );
  return Math.min(320, Math.max(185, Math.round(longestLine * 6.8 + 36)));
};

const width = (node: UmlClassNode): number =>
  Math.max(140, node.customWidth || node.width || dynamicWidth(node));

const height = (node: UmlClassNode): number => node.customHeight || node.height || 115;

export const notePlugin: NodePlugin = {
  metadata: {
    id: 'uml.note',
    version: '1.0.0',
    apiVersion: 1,
    category: 'node',
    labelKey: 'plugins.nodes.note',
  },
  nodeTypes: ['note'],
  renderer: UmlNoteNodeComponent,
  defaultColor: '#FEF9C3',
  geometry: {
    width,
    height,
    dynamicWidth,
    minWidth: 140,
    minHeight: 85,
    bottomOffset: -4,
    zIndex: [6, 7],
    cssClass: 'f-node-note',
    transparent: true,
    lockY: false,
    externalLabel: false,
  },
  tools: [
    {
      id: 'note',
      labelKey: 'plugins.nodes.note',
      icon: NoteSvgComponent,
      diagramTypes: ALL_DIAGRAM_TYPES,
    },
  ],
  inputs: (context) => ({ ...context }),
  /**
   * Crea una nueva Nota Flotante colaborativa en cualquier tipo de diagrama UML.
   * No participa en la generación de código ni en la inferencia de entidades SQL/JPA.
   */
  create(context) {
    const { nodes, position, scroll } = context;
    const pos = calcPos(position, 98, 58, scroll);
    const count = nodes.filter((n) => n.nodeType === 'note').length + 1;
    return {
      id: `note_${crypto.randomUUID()}`,
      name: `Nota ${count}: escribe un comentario para el equipo...`,
      nodeType: 'note',
      position: pos,
      width: 195,
      height: 115,
      color: '#FEF9C3',
      attributes: [],
      methods: [],
    };
  },
};
