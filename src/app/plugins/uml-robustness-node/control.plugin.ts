import { ControlSvgComponent } from '../../plugin-sdk/ui/uml-svg/control-svg.component';
import { DiagramType, UmlClassNode, UmlStereotype } from '../../core/models/diagram.model';
import { NodePlugin } from '../../core/plugins/node-plugin.contract';
import { calcPos } from '../../plugin-sdk/node-creation';
import { UmlRobustnessNodeComponent } from './uml-robustness-node.component';

const dynamicWidth = (node: UmlClassNode): number => 70;
const width = (node: UmlClassNode): number =>
  Math.max(50, node.customWidth || (node.isCustomSize ? node.width : 0) || 70);
const height = (node: UmlClassNode): number => node.customHeight || node.height || 70;

export const controlPlugin: NodePlugin = {
  metadata: {
    id: 'uml.control',
    version: '1.0.0',
    apiVersion: 1,
    category: 'node',
    labelKey: 'plugins.nodes.control',
  },
  nodeTypes: ['control'],

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
    cssClass: 'f-node-control',
    transparent: true,
    lockY: false,
    externalLabel: true,
  },
  tools: [
    {
      id: 'control',
      labelKey: 'plugins.nodes.control',
      icon: ControlSvgComponent,
      diagramTypes: [DiagramType.COMMUNICATION],
    },
  ],
  inputs: (context) => ({ ...context }),
  /**
   * Fabrica una nueva instancia del nodo Control de robustez para diagramas de comunicación.
   * @param context Contexto de creación (posición, offset de scroll, tipo de diagrama).
   * @returns Nuevo nodo Control configurado.
   */
  create(context) {
    const { nodes, diagramType: currentType, position, stereotype, scroll } = context;

    const pos = calcPos(position, 35, 35, scroll);
    const count = nodes.filter((n) => n.nodeType === 'control').length + 1;
    return {
      id: `control_${crypto.randomUUID()}`,
      name: `Control_${count}`,
      nodeType: 'control',
      stereotype: UmlStereotype.CONTROL,
      position: pos,
      width: 70,
      height: 70,
      color: '#DDF4F5',
      attributes: [],
      methods: [],
    };
  },
};
