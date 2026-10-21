import { DeploymentNodeSvgComponent } from '../../plugin-sdk/ui/uml-svg/deployment-node-svg.component';
import { DiagramType, UmlClassNode, UmlStereotype } from '../../core/models/diagram.model';
import { NodePlugin } from '../../core/plugins/node-plugin.contract';
import { calcPos } from '../../plugin-sdk/node-creation';
import { UmlDeploymentNodeComponent } from './uml-deployment-node.component';

const dynamicWidth = (node: UmlClassNode): number =>
  Math.max(230, Math.round((node.name || '').length * 8.5 + 50));
const width = (node: UmlClassNode): number =>
  Math.max(160, node.customWidth || node.width || dynamicWidth(node));
const height = (node: UmlClassNode): number => node.customHeight || node.height || 140;

export const devicePlugin: NodePlugin = {
  metadata: {
    id: 'uml.device',
    version: '1.0.0',
    apiVersion: 1,
    category: 'node',
    labelKey: 'plugins.nodes.device',
  },
  nodeTypes: ['device'],
  stereotypeAliases: ['device'],
  renderer: UmlDeploymentNodeComponent,
  defaultColor: '#F3FAF7',
  geometry: {
    width,
    height,
    dynamicWidth,
    minWidth: 160,
    minHeight: 90,
    bottomOffset: -6,
    zIndex: [5, 7],
    cssClass: 'f-node-deployment',
    transparent: true,
    lockY: false,
    externalLabel: false,
  },
  tools: [
    {
      id: 'device',
      labelKey: 'plugins.nodes.device',
      icon: DeploymentNodeSvgComponent,
      diagramTypes: [DiagramType.DEPLOYMENT],
    },
  ],
  inputs: (context) => ({
    ...context,
    nodeWidth: width(context.node),
    nodeHeight: height(context.node),
    frontWidth: Math.max(100, width(context.node) - 14),
    frontHeight: Math.max(70, height(context.node) - 14),
    colors: {
      top: '#EFE2D3',
      right: '#DFCBB7',
      front: context.node.color || '#FDFAF3',
      border: '#796354',
    },
  }),
  /**
   * Fabrica una nueva instancia del nodo Dispositivo (Device) en diagramas de despliegue.
   * @param context Contexto de creación (posición, offset de scroll, tipo de diagrama).
   * @returns Nuevo nodo Dispositivo de despliegue.
   */
  create(context) {
    const { nodes, diagramType: currentType, position, stereotype, scroll } = context;

    const pos = calcPos(position, 115, 70, scroll);
    const count = nodes.filter((n) => n.nodeType === 'device').length + 1;
    return {
      id: `device_${crypto.randomUUID()}`,
      name: `Dispositivo_${count}`,
      nodeType: 'device',
      stereotype: 'device',
      position: pos,
      width: 230,
      height: 140,
      customWidth: 230,
      customHeight: 140,
      isCustomSize: true,
      color: '#F3FAF7',
      attributes: [],
      methods: [],
    };
  },
};
