import { ActorSvgComponent } from '../../plugin-sdk/ui/uml-svg/actor-svg.component';
import { DiagramType, UmlClassNode, UmlStereotype } from '../../core/models/diagram.model';
import { NodePlugin } from '../../core/plugins/node-plugin.contract';
import { calcPos } from '../../plugin-sdk/node-creation';
import { UmlActorNodeComponent } from './uml-actor-node.component';

const dynamicWidth = (node: UmlClassNode, activeDiagramType?: DiagramType): number => {
  if (activeDiagramType === DiagramType.SEQUENCE) return 65;
  return Math.max(50, node.customWidth || (node.isCustomSize ? node.width : 0) || 65);
};
const width = (node: UmlClassNode, activeDiagramType?: DiagramType): number => {
  if (activeDiagramType === DiagramType.SEQUENCE) return 65;
  return Math.max(50, node.customWidth || (node.isCustomSize ? node.width : 0) || 65);
};
const height = (node: UmlClassNode, activeDiagramType?: DiagramType): number => {
  if (activeDiagramType === DiagramType.SEQUENCE) return 65;
  return Math.max(50, node.customHeight || (node.isCustomSize ? node.height : 0) || 65);
};
const isResizable = (_node: UmlClassNode, activeDiagramType?: DiagramType): boolean => {
  return activeDiagramType !== DiagramType.SEQUENCE;
};

export const actorPlugin: NodePlugin = {
  metadata: {
    id: 'uml.actor',
    version: '1.0.0',
    apiVersion: 1,
    category: 'node',
    labelKey: 'plugins.nodes.actor',
  },
  nodeTypes: ['actor'],

  renderer: UmlActorNodeComponent,
  defaultColor: '#FEF2DD',
  geometry: {
    width,
    height,
    dynamicWidth,
    isResizable,
    minWidth: 50,
    minHeight: 50,
    bottomOffset: -44,
    zIndex: [20, 25],
    cssClass: 'f-node-actor',
    transparent: true,
    lockY: (_node, activeDiagramType) => activeDiagramType === DiagramType.SEQUENCE,
    externalLabel: true,
  },
  tools: [
    {
      id: 'actor',
      labelKey: 'plugins.nodes.actor',
      icon: ActorSvgComponent,
      diagramTypes: [
        DiagramType.USE_CASE,
        DiagramType.CLASS_ANALYSIS,
        DiagramType.SEQUENCE,
        DiagramType.COMMUNICATION,
      ],
    },
  ],
  inputs: (context) => ({ ...context }),
  /**
   * Fabrica una nueva instancia del nodo Actor UML con sus coordenadas y atributos por defecto.
   * @param context Contexto de creación (nodos actuales, tipo de diagrama, posición, etc.).
   * @returns Nuevo nodo Actor configurado.
   */
  create(context) {
    const { nodes, diagramType: currentType, position, stereotype, scroll } = context;

    const isSequence = currentType === DiagramType.SEQUENCE;
    let pos = calcPos(position, 32, 47, scroll);

    if (isSequence) {
      pos.y = 50;
      if (!position) {
        const topNodes = nodes.filter(
          (n) => (n.nodeType === 'lifeline' || n.nodeType === 'actor') && !n.isAnchor,
        );
        if (topNodes.length > 0) {
          const maxRight = Math.max(
            ...topNodes.map((n) => (n.position?.x || 0) + (n.width || 120)),
          );
          pos.x = maxRight + 60;
        } else {
          pos.x = 80;
        }
      }
    }

    const count = nodes.filter((n) => n.nodeType === 'actor').length + 1;
    return {
      id: `actor_${crypto.randomUUID()}`,
      name: isSequence ? `actor_${count}` : `Actor_${count}`,
      nodeType: 'actor',
      position: pos,
      width: 65,
      height: 65,
      color: '#FEF2DD',
      attributes: [],
      methods: [],
      activations: [],
    };
  },
};
