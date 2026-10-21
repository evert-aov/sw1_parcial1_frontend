import { DirectorySvgComponent } from '../../plugin-sdk/ui/uml-svg/directory-svg.component';
import { DiagramType, UmlClassNode, UmlStereotype } from '../../core/models/diagram.model';
import { NodePlugin } from '../../core/plugins/node-plugin.contract';
import { calcPos } from '../../plugin-sdk/node-creation';
import { UmlPackageNodeComponent } from './uml-package-node.component';

const dynamicWidth = (node: UmlClassNode): number =>
  Math.max(
    180,
    Math.round(
      Math.max(
        (node.name?.split('\n')[0]?.trim() || 'Paquete').length,
        (node.attributes?.[0]?.name || node.name?.split('\n').slice(1).join('\n').trim() || '')
          .length,
      ) *
        7.5 +
        40,
    ),
  );
const width = (node: UmlClassNode): number =>
  Math.max(120, node.customWidth || node.width || dynamicWidth(node));
const height = (node: UmlClassNode): number => node.customHeight || node.height || 120;

export const packagePlugin: NodePlugin = {
  metadata: {
    id: 'uml.package',
    version: '1.0.0',
    apiVersion: 1,
    category: 'node',
    labelKey: 'plugins.nodes.package',
  },
  nodeTypes: ['package'],

  renderer: UmlPackageNodeComponent,
  defaultColor: '#FAF1EC',
  geometry: {
    width,
    height,
    dynamicWidth,
    minWidth: 120,
    minHeight: 70,
    bottomOffset: -6,
    zIndex: [3, 4],
    cssClass: 'f-node-package',
    transparent: true,
    lockY: false,
    externalLabel: false,
  },
  tools: [
    {
      id: 'package',
      labelKey: 'plugins.nodes.package',
      icon: DirectorySvgComponent,
      diagramTypes: [
        DiagramType.PACKAGE,
        DiagramType.LAYERED,
        DiagramType.COMPONENT,
        DiagramType.DEPLOYMENT,
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
   * Fabrica una nueva instancia del nodo Paquete (Package) UML con su pestaña superior característica.
   * @param context Contexto de creación (posición, offset de scroll, tipo de diagrama).
   * @returns Nuevo nodo Paquete UML.
   */
  create(context) {
    const { nodes, diagramType: currentType, position, stereotype, scroll } = context;

    const pos = calcPos(position, 100, 60, scroll);
    const count = nodes.filter((n) => n.nodeType === 'package').length + 1;
    return {
      id: `package_${crypto.randomUUID()}`,
      name: `Paquete_${count}`,
      nodeType: 'package',
      position: pos,
      width: 200,
      height: 120,
      color: '#FAF1EC',
      attributes: [{ name: `Contenido Paquete ${count}`, type: 'package' }],
      methods: [],
    };
  },
};
