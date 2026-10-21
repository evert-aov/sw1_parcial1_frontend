import { DeploymentNodeSvgComponent } from '../../plugin-sdk/ui/uml-svg/deployment-node-svg.component';
import { DiagramType, UmlClassNode, UmlStereotype } from '../../core/models/diagram.model';
import { NodePlugin } from '../../core/plugins/node-plugin.contract';
import { calcPos } from '../../plugin-sdk/node-creation';
import { UmlDeploymentNodeComponent } from './uml-deployment-node.component';

const dynamicWidth = (node: UmlClassNode): number =>
  Math.max(230, Math.round((node.name || '').length * 8.5 + 50));
const width = (node: UmlClassNode): number =>
  Math.max(160, node.customWidth || node.width || dynamicWidth(node));
const height = (node: UmlClassNode): number => node.customHeight || node.height || 160;

export const executionEnvironmentPlugin: NodePlugin = {
  metadata: {
    id: 'uml.executionEnvironment',
    version: '1.0.0',
    apiVersion: 1,
    category: 'node',
    labelKey: 'plugins.nodes.executionEnvironment',
  },
  nodeTypes: ['executionEnvironment', 'execution-environment'],
  stereotypeAliases: ['executionEnvironment', 'execution-environment'],
  renderer: UmlDeploymentNodeComponent,
  defaultColor: '#CDE5F5',
  geometry: {
    width,
    height,
    dynamicWidth,
    minWidth: 160,
    minHeight: 90,
    bottomOffset: -6,
    zIndex: [10, 12],
    cssClass: 'f-node-deployment',
    transparent: true,
    lockY: false,
    externalLabel: false,
  },
  tools: [
    {
      id: 'executionEnvironment',
      labelKey: 'plugins.nodes.executionEnvironment',
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
      top: '#E0F2FE',
      right: '#BAE6FD',
      front: context.node.color || '#F0F9FF',
      border: '#0284C7',
    },
  }),
  /**
   * Crea un nuevo nodo de Entorno de Ejecución (Execution Environment) para diagramas de despliegue.
   * @param context Contexto de creación (posición, offset de scroll, tipo de diagrama).
   * @returns Nuevo nodo de Entorno de Ejecución.
   */
  create(context) {
    const { nodes, diagramType: currentType, position, stereotype, scroll } = context;

    const pos = calcPos(position, 120, 80, scroll);
    const count = nodes.filter((n) => n.nodeType === 'executionEnvironment').length + 1;
    return {
      id: `exec_env_${crypto.randomUUID()}`,
      name: `Servidor_${count}`,
      nodeType: 'executionEnvironment',
      stereotype: 'executionEnvironment',
      position: pos,
      width: 240,
      height: 160,
      customWidth: 240,
      customHeight: 160,
      isCustomSize: true,
      color: '#CDE5F5',
      attributes: [],
      methods: [],
    };
  },
};
