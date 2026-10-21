import { ComponentSvgComponent } from '../../plugin-sdk/ui/uml-svg/component-svg.component';
import { DiagramType, UmlClassNode, UmlStereotype } from '../../core/models/diagram.model';
import { NodePlugin } from '../../core/plugins/node-plugin.contract';
import { calcPos } from '../../plugin-sdk/node-creation';
import { UmlComponentNodeComponent } from './uml-component-node.component';

const dynamicWidth = (node: UmlClassNode): number =>
  Math.max(180, Math.round((node.name || '').length * 8.5 + 50));
const width = (node: UmlClassNode): number =>
  Math.max(140, node.customWidth || node.width || dynamicWidth(node));
const height = (node: UmlClassNode): number => node.customHeight || node.height || 70;

export const componentPlugin: NodePlugin = {
  metadata: {
    id: 'uml.component',
    version: '1.0.0',
    apiVersion: 1,
    category: 'node',
    labelKey: 'plugins.nodes.component',
  },
  nodeTypes: ['component'],
  stereotypeAliases: ['component'],
  renderer: UmlComponentNodeComponent,
  defaultColor: '#FAF1EC',
  geometry: {
    width,
    height,
    dynamicWidth,
    minWidth: 140,
    minHeight: 50,
    bottomOffset: -6,
    zIndex: [15, 18],
    cssClass: 'f-node-component',
    transparent: true,
    lockY: false,
    externalLabel: false,
  },
  tools: [
    {
      id: 'component',
      labelKey: 'plugins.nodes.component',
      icon: ComponentSvgComponent,
      diagramTypes: [DiagramType.COMPONENT, DiagramType.DEPLOYMENT, DiagramType.LAYERED],
    },
  ],
  inputs: (context) => ({ ...context }),
  /**
   * Crea una nueva instancia de nodo Componente UML con sus dimensiones base y estilo visual.
   * @param context Contexto de creación (posición, offset de scroll, tipo de diagrama).
   * @returns Nuevo nodo Componente UML.
   */
  create(context) {
    const { nodes, diagramType: currentType, position, stereotype, scroll } = context;

    const pos = calcPos(position, 95, 35, scroll);
    const count = nodes.filter((n) => n.nodeType === 'component').length + 1;
    return {
      id: `component_${crypto.randomUUID()}`,
      name: `Component_${count}`,
      nodeType: 'component',
      stereotype: 'file',
      position: pos,
      width: 190,
      height: 70,
      customWidth: 190,
      customHeight: 70,
      isCustomSize: true,
      color: '#FAF1EC',
      attributes: [],
      methods: [],
    };
  },
};
