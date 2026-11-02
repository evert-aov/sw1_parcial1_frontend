import { TableSvgComponent } from '../../plugin-sdk/ui/uml-svg/table-svg.component';
import { DiagramType, UmlClassNode, UmlStereotype } from '../../core/models/diagram.model';
import { NodePlugin } from '../../core/plugins/node-plugin.contract';
import { calcPos } from '../../plugin-sdk/node-creation';
import { UmlClassNodeComponent } from './uml-class-node.component';
import { calculateClassDynamicWidth } from './class-metrics';

const dynamicWidth = (node: UmlClassNode): number => calculateClassDynamicWidth(node);
const width = (node: UmlClassNode): number =>
  Math.max(dynamicWidth(node), node.isCustomSize ? node.customWidth || 0 : 0);
const height = (node: UmlClassNode): number =>
  node.customHeight ||
  (node.isCustomSize ? node.height : 0) ||
  (node.stereotype ? 44 : 34) +
    (node.attributes?.length ? node.attributes.length * 22 + 12 : 0) +
    (node.methods?.length ? node.methods.length * 22 + 12 : 0);

export const classPlugin: NodePlugin = {
  metadata: {
    id: 'uml.class',
    version: '1.0.0',
    apiVersion: 1,
    category: 'node',
    labelKey: 'plugins.nodes.class',
  },
  nodeTypes: ['class'],

  renderer: UmlClassNodeComponent,
  defaultColor: '#FDFAF3',
  resolveColor: (node) =>
    ['UI', 'Entity.', 'Controller.', 'boundary', 'control', 'entity'].includes(
      node.stereotype || '',
    )
      ? '#DDF4F5'
      : '#FDFAF3',
  geometry: {
    width,
    height,
    dynamicWidth,
    minWidth: 90,
    minHeight: 34,
    bottomOffset: -6,
    zIndex: [20, 25],
    cssClass: 'f-node-class',
    transparent: false,
    lockY: false,
    externalLabel: false,
  },
  tools: [
    {
      id: 'class',
      labelKey: 'plugins.nodes.class',
      icon: TableSvgComponent,
      diagramTypes: [DiagramType.CLASS, DiagramType.CLASS_ANALYSIS],
    },
    {
      id: 'class-UI',
      labelKey: 'plugins.nodes.UI',
      stereotype: 'UI',
      icon: TableSvgComponent,
      diagramTypes: [DiagramType.CLASS_ANALYSIS],
    },
    {
      id: 'class-Controller.',
      labelKey: 'plugins.nodes.Controller',
      stereotype: 'Controller.',
      icon: TableSvgComponent,
      diagramTypes: [DiagramType.CLASS_ANALYSIS],
    },
    {
      id: 'class-Entity.',
      labelKey: 'plugins.nodes.Entity',
      stereotype: 'Entity.',
      icon: TableSvgComponent,
      diagramTypes: [DiagramType.CLASS_ANALYSIS],
    },
  ],
  inputs: (context) => ({ ...context }),
  /**
   * Crea una nueva instancia de nodo Clase UML o entidad de análisis con sus atributos y métodos iniciales.
   * @param context Contexto de creación (posición, offset de scroll, tipo de diagrama, estereotipo).
   * @returns Nuevo nodo de clase UML.
   */
  create(context) {
    const { nodes, diagramType: currentType, position, stereotype, scroll } = context;

    const defaultWidth = 220;
    const defaultHeight = stereotype ? 120 : undefined;
    const pos = calcPos(position, defaultWidth / 2, defaultHeight ? defaultHeight / 2 : 40, scroll);

    const count = nodes.filter((n) => !n.isAnchor).length + 1;
    let namePrefix = 'Tabla_';
    if (stereotype === UmlStereotype.UI || stereotype === 'UI') {
      namePrefix = 'UI_';
    } else if (stereotype === UmlStereotype.CONTROLLER_DOT || stereotype === 'Controller.') {
      namePrefix = 'Controller_';
    } else if (stereotype === UmlStereotype.ENTITY_DOT || stereotype === 'Entity.') {
      namePrefix = 'Entity_';
    } else if (currentType === DiagramType.CLASS_ANALYSIS) {
      namePrefix = 'Clase_';
    }

    let initialStereotype: UmlStereotype | string | null = (stereotype as UmlStereotype) || null;
    if (currentType === DiagramType.CLASS) {
      initialStereotype = null;
    } else if (initialStereotype && (initialStereotype as string).toLowerCase() === 'class') {
      initialStereotype = null;
    }

    return {
      id: `class_${crypto.randomUUID()}`,
      name: `${namePrefix}${count}`,
      nodeType: 'class',
      position: pos,
      width: defaultWidth,
      height: defaultHeight,
      color: '#FDFAF3',
      attributes: [],
      methods: [],
      stereotype: initialStereotype,
    };
  },
};
