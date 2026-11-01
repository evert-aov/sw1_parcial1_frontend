import { BoundaryBoxSvgComponent } from '../../plugin-sdk/ui/uml-svg/boundary-box-svg.component';
import { DiagramType, UmlClassNode, UmlStereotype } from '../../core/models/diagram.model';
import { NodePlugin } from '../../core/plugins/node-plugin.contract';
import { calcPos } from '../../plugin-sdk/node-creation';
import { UmlPackageNodeComponent } from './uml-package-node.component';

const dynamicWidth = (node: UmlClassNode): number => 280;
const width = (node: UmlClassNode): number => Math.max(120, node.customWidth || node.width || 280);
const height = (node: UmlClassNode): number => node.customHeight || node.height || 200;

export const boundary_boxPlugin: NodePlugin = {
  metadata: {
    id: 'uml.boundary_box',
    version: '1.0.0',
    apiVersion: 1,
    category: 'node',
    labelKey: 'plugins.nodes.boundary_box',
  },
  nodeTypes: ['boundary_box'],

  renderer: UmlPackageNodeComponent,
  defaultColor: '#FAF1EC',
  geometry: {
    width,
    height,
    dynamicWidth,
    minWidth: 120,
    minHeight: 80,
    bottomOffset: -6,
    zIndex: [1, 2],
    cssClass: 'f-node-boundary-box',
    transparent: true,
    lockY: false,
    externalLabel: false,
  },
  tools: [
    {
      id: 'boundary_box',
      labelKey: 'plugins.nodes.boundary_box',
      icon: BoundaryBoxSvgComponent,
      diagramTypes: [
        DiagramType.USE_CASE,
        DiagramType.COMPONENT,
        DiagramType.DEPLOYMENT,
        DiagramType.LAYERED,
        DiagramType.COMMUNICATION,
      ],
    },
  ],
  inputs: (context) => ({
    ...context,
    packageTabTitle: context.node.stereotype
      ? `«${context.node.stereotype}»`
      : context.node.name || 'Package',
    packageBodyText: context.node.name || 'Package',
  }),
  /**
   * Crea una nueva caja de contorno (Boundary Box / Agrupación / Capa) con soporte de anidación.
   * @param context Contexto de creación (posición, offset de scroll, tipo de diagrama).
   * @returns Nuevo nodo Boundary Box configurado.
   */
  create(context) {
    const { nodes, diagramType: currentType, position, stereotype, scroll } = context;

    const isCommunication = currentType === DiagramType.COMMUNICATION;
    const isLayered = currentType === DiagramType.LAYERED;
    const isComponent = currentType === DiagramType.COMPONENT;
    const defaultWidth = isCommunication ? 520 : isLayered || isComponent ? 420 : 280;
    const defaultHeight = isCommunication ? 360 : isLayered || isComponent ? 220 : 200;
    const defaultName = isCommunication ? 'sd Interacción' : isLayered ? 'Capa' : isComponent ? 'Agrupación' : '.';
    const pos = calcPos(position, defaultWidth / 2, defaultHeight / 2, scroll);

    return {
      id: `boundary_box_${crypto.randomUUID()}`,
      name: defaultName,
      nodeType: 'boundary_box',
      stereotype: null,
      position: pos,
      width: defaultWidth,
      height: defaultHeight,
      customWidth: defaultWidth,
      customHeight: defaultHeight,
      isCustomSize: true,
      color: '#FAF1EC',
      attributes: [],
      methods: [],
    };
  },
};
