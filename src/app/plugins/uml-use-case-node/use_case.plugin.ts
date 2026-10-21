import { UseCaseSvgComponent } from '../../plugin-sdk/ui/uml-svg/use-case-svg.component';
import { DiagramType, UmlClassNode, UmlStereotype } from '../../core/models/diagram.model';
import { NodePlugin } from '../../core/plugins/node-plugin.contract';
import { calcPos } from '../../plugin-sdk/node-creation';
import { UmlUseCaseNodeComponent } from './uml-use-case-node.component';

const dynamicWidth = (node: UmlClassNode): number =>
  Math.min(260, Math.max(140, Math.round((node.name || '').length * 7.5 + 40)));
const width = (node: UmlClassNode): number =>
  Math.max(dynamicWidth(node), node.customWidth || (node.isCustomSize ? node.width : 0) || 0);
const height = (node: UmlClassNode): number =>
  node.customHeight ||
  (node.isCustomSize ? node.height : 0) ||
  Math.max(
    60,
    45 +
      (Math.max(
        1,
        Math.ceil(
          (node.name || '').length / Math.max(8, Math.floor(Math.max(50, width(node) - 24) / 6.8)),
        ),
      ) -
        1) *
        18,
  );

export const use_casePlugin: NodePlugin = {
  metadata: {
    id: 'uml.use_case',
    version: '1.0.0',
    apiVersion: 1,
    category: 'node',
    labelKey: 'plugins.nodes.use_case',
  },
  nodeTypes: ['use_case'],

  renderer: UmlUseCaseNodeComponent,
  defaultColor: '#E5F2FE',
  geometry: {
    width,
    height,
    dynamicWidth,
    minWidth: 80,
    minHeight: 45,
    bottomOffset: -6,
    zIndex: [20, 25],
    cssClass: 'f-node-use-case',
    transparent: true,
    lockY: false,
    externalLabel: false,
  },
  tools: [
    {
      id: 'use_case',
      labelKey: 'plugins.nodes.use_case',
      icon: UseCaseSvgComponent,
      diagramTypes: [DiagramType.USE_CASE],
    },
  ],
  inputs: (context) => ({ ...context }),
  /**
   * Fabrica una nueva instancia del nodo Caso de Uso UML con su geometría elíptica inicial.
   * @param context Contexto de creación (posición, offset de scroll, tipo de diagrama).
   * @returns Nuevo nodo Caso de Uso UML.
   */
  create(context) {
    const { nodes, diagramType: currentType, position, stereotype, scroll } = context;

    const pos = calcPos(position, 70, 30, scroll);
    const count = nodes.filter((n) => n.nodeType === 'use_case').length + 1;
    return {
      id: `use_case_${crypto.randomUUID()}`,
      name: `CasoDeUso_${count}`,
      nodeType: 'use_case',
      position: pos,
      width: 140,
      height: 60,
      color: '#E5F2FE',
      attributes: [],
      methods: [],
    };
  },
};
