import { LifelineSvgComponent } from '../../plugin-sdk/ui/uml-svg/lifeline-svg.component';
import { DiagramType, UmlClassNode, UmlStereotype } from '../../core/models/diagram.model';
import { NodePlugin } from '../../core/plugins/node-plugin.contract';
import { calcPos } from '../../plugin-sdk/node-creation';
import { UmlLifelineNodeComponent } from './uml-lifeline-node.component';

const dynamicWidth = (node: UmlClassNode): number =>
  Math.max(160, Math.round((node.name || '').length * 8.5 + 44));
const width = (node: UmlClassNode): number =>
  Math.max(dynamicWidth(node), node.customWidth || node.width || 0);
const height = (node: UmlClassNode): number => 60;

export const lifelinePlugin: NodePlugin = {
  metadata: {
    id: 'uml.lifeline',
    version: '1.0.0',
    apiVersion: 1,
    category: 'node',
    labelKey: 'plugins.nodes.lifeline',
  },
  nodeTypes: ['lifeline'],

  renderer: UmlLifelineNodeComponent,
  defaultColor: '#DDF4F5',
  geometry: {
    width,
    height,
    dynamicWidth,
    minWidth: 100,
    minHeight: 40,
    bottomOffset: -6,
    zIndex: [20, 25],
    cssClass: 'f-node-lifeline',
    transparent: true,
    lockY: false,
    externalLabel: false,
    fixedHeaderHeight: 60,
  },
  tools: [
    {
      id: 'lifeline',
      labelKey: 'plugins.nodes.lifeline',
      icon: LifelineSvgComponent,
      diagramTypes: [DiagramType.SEQUENCE, DiagramType.COMMUNICATION],
    },
  ],
  inputs: (context) => ({ ...context }),
  /**
   * Fabrica una nueva línea de vida (Lifeline) alineada en la cabecera superior del diagrama de secuencia.
   * @param context Contexto de creación (posición, offset de scroll, tipo de diagrama).
   * @returns Nuevo nodo Línea de Vida inicializado.
   */
  create(context) {
    const { nodes, diagramType: currentType, position, stereotype, scroll } = context;

    const isSequence = currentType === DiagramType.SEQUENCE;
    let pos = calcPos(position, 80, 24, scroll);

    if (isSequence) {
      pos.y = 50;
      if (!position) {
        const topNodes = nodes.filter(
          (n) => (n.nodeType === 'lifeline' || n.nodeType === 'actor') && !n.isAnchor,
        );
        if (topNodes.length > 0) {
          const maxRight = Math.max(
            ...topNodes.map((n) => (n.position?.x || 0) + (n.width || 140)),
          );
          pos.x = maxRight + 60;
        } else {
          pos.x = 80;
        }
      }
    }

    const count = nodes.filter((n) => n.nodeType === 'lifeline').length + 1;
    const defaultName = isSequence ? `lifeline_${count}` : `:Objeto_${count}`;

    return {
      id: `lifeline_${crypto.randomUUID()}`,
      name: defaultName,
      nodeType: 'lifeline',
      position: pos,
      width: 160,
      height: 60,
      color: '#DDF4F5',
      attributes: [],
      methods: [],
      activations: [],
    };
  },
};
