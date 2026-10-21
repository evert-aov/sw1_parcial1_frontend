import { BoundarySvgComponent } from '../../plugin-sdk/ui/uml-svg/boundary-svg.component';
import { DiagramType, UmlClassNode, UmlStereotype } from '../../core/models/diagram.model';
import { NodePlugin } from '../../core/plugins/node-plugin.contract';
import { calcPos } from '../../plugin-sdk/node-creation';
import { UmlRobustnessNodeComponent } from './uml-robustness-node.component';

const dynamicWidth = (node: UmlClassNode): number => 70;
const width = (node: UmlClassNode): number =>
  Math.max(50, node.customWidth || (node.isCustomSize ? node.width : 0) || 70);
const height = (node: UmlClassNode): number => node.customHeight || node.height || 70;

export const boundaryPlugin: NodePlugin = {
  metadata: {
    id: 'uml.boundary',
    version: '1.0.0',
    apiVersion: 1,
    category: 'node',
    labelKey: 'plugins.nodes.boundary',
  },
  nodeTypes: ['boundary'],

  renderer: UmlRobustnessNodeComponent,
  defaultColor: '#DDF4F5',
  geometry: {
    width,
    height,
    dynamicWidth,
    minWidth: 50,
    minHeight: 50,
    bottomOffset: -20,
    zIndex: [20, 25],
    cssClass: 'f-node-boundary',
    transparent: true,
    lockY: false,
    externalLabel: true,
  },
  tools: [
    {
      id: 'boundary',
      labelKey: 'plugins.nodes.boundary',
      icon: BoundarySvgComponent,
      diagramTypes: [DiagramType.COMMUNICATION],
    },
  ],
  inputs: (context) => ({ ...context }),
  /**
   * Fabrica una nueva instancia del nodo Frontera (Boundary) de robustez para diagramas de comunicación.
   * @param context Contexto de creación (posición, offset de scroll, tipo de diagrama).
   * @returns Nuevo nodo Boundary configurado.
   */
  create(context) {
    const { nodes, diagramType: currentType, position, stereotype, scroll } = context;

    const pos = calcPos(position, 35, 35, scroll);
    const count = nodes.filter((n) => n.nodeType === 'boundary').length + 1;
    return {
      id: `boundary_${crypto.randomUUID()}`,
      name: `Boundary_${count}`,
      nodeType: 'boundary',
      stereotype: UmlStereotype.BOUNDARY,
      position: pos,
      width: 70,
      height: 70,
      color: '#DDF4F5',
      attributes: [],
      methods: [],
    };
  },
};
