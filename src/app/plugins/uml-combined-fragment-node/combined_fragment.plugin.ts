import { CombinedFragmentSvgComponent } from '../../plugin-sdk/ui/uml-svg/combined-fragment-svg.component';
import { DiagramType, UmlClassNode } from '../../core/models/diagram.model';
import { NodePlugin } from '../../core/plugins/node-plugin.contract';
import { calcPos } from '../../plugin-sdk/node-creation';
import { UmlCombinedFragmentNodeComponent } from './uml-combined-fragment-node.component';

const dynamicWidth = (_node: UmlClassNode): number => 340;
const width = (node: UmlClassNode): number => Math.max(180, node.customWidth || node.width || 340);
const height = (node: UmlClassNode): number => Math.max(100, node.customHeight || node.height || 190);

export const combinedFragmentPlugin: NodePlugin = {
  metadata: {
    id: 'uml.combined_fragment',
    version: '1.0.0',
    apiVersion: 1,
    category: 'node',
    labelKey: 'plugins.nodes.combined_fragment',
  },
  nodeTypes: ['combined_fragment'],
  renderer: UmlCombinedFragmentNodeComponent,
  defaultColor: '#FFFFFF',
  geometry: {
    width,
    height,
    dynamicWidth,
    minWidth: 180,
    minHeight: 100,
    bottomOffset: -6,
    zIndex: [35, 40],
    cssClass: 'f-node-combined-fragment',
    transparent: true,
    lockY: false,
    externalLabel: false,
  },
  tools: [
    {
      id: 'combined_fragment',
      labelKey: 'plugins.nodes.combined_fragment',
      icon: CombinedFragmentSvgComponent,
      diagramTypes: [DiagramType.SEQUENCE],
    },
  ],
  inputs: (context) => ({ ...context }),
  /**
   * Crea un nuevo Fragmento Combinado UML 2.5 (`alt`) con dos operandos por defecto (`[condición]` y `[else]`)
   * en un diagrama de secuencia.
   */
  create(context) {
    const { position, scroll } = context;
    const defaultWidth = 340;
    const defaultHeight = 190;
    const pos = position
      ? calcPos(position, defaultWidth / 2, defaultHeight / 2, scroll)
      : { x: 140 + (scroll?.scrollLeft || 0), y: 175 + (scroll?.scrollTop || 0) };

    return {
      id: `combined_fragment_${crypto.randomUUID()}`,
      name: 'alt\n[condición]\n---\n[else]',
      nodeType: 'combined_fragment',
      stereotype: null,
      position: pos,
      width: defaultWidth,
      height: defaultHeight,
      customWidth: defaultWidth,
      customHeight: defaultHeight,
      isCustomSize: true,
      color: '#FFFFFF',
      attributes: [],
      methods: [],
    };
  },
};
