import { UmlAttribute, UmlClassNode, UmlConnection } from '../../../../../../../core/models/diagram.model';

/**
 * Extrae la clave foránea adecuada para asociar a una entidad o clase según su clave primaria o nombre
 */
export function getEntityFk(node: UmlClassNode): { name: string; type: string } {
  const pkAttr = (node.attributes || []).find((a: UmlAttribute) =>
    /^(id|.*_id|.*id)$/i.test(a.name.trim()),
  ) || (node.attributes || [])[0];

  const pkType = pkAttr?.type || 'UUID';

  let base = node.name.trim();
  if (base.toLowerCase().endsWith('es') && base.length > 3) {
    base = base.slice(0, -2);
  } else if (base.toLowerCase().endsWith('s') && base.length > 2 && !base.toLowerCase().endsWith('ss')) {
    base = base.slice(0, -1);
  }
  const camelBase = base.charAt(0).toLowerCase() + base.slice(1);

  let fkName = `${camelBase}Id`;
  if (pkAttr && pkAttr.name.trim().toLowerCase() !== 'id') {
    fkName = pkAttr.name.trim();
  }

  return { name: fkName, type: pkType };
}

/**
 * Construye los elementos estructurales de una clase de asociación: nodo ancla invisible,
 * nodo de clase de asociación con llaves foráneas calculadas y conexiones principal y discontinua.
 */
export function buildAssociationClassElements(
  sourceNode: UmlClassNode,
  targetNode: UmlClassNode,
  timestamp = Date.now(),
): {
  anchorNode: UmlClassNode;
  assocNode: UmlClassNode;
  mainConnection: UmlConnection;
  dashedConnection: UmlConnection;
} {
  const anchorId = `anchor_${timestamp}`;
  const assocNodeId = `node_${timestamp}_assoc`;
  const assocName = `${sourceNode.name}_${targetNode.name}`;

  const anchorNode: UmlClassNode = {
    id: anchorId,
    name: '',
    position: {
      x: Math.round((sourceNode.position.x + targetNode.position.x) / 2),
      y: Math.round((sourceNode.position.y + targetNode.position.y) / 2),
    },
    width: 0,
    height: 0,
    attributes: [],
    methods: [],
    isAnchor: true,
  };

  const mainConnId = `conn_${timestamp}_assoc_main`;
  const mainConnection: UmlConnection = {
    id: mainConnId,
    sourceNodeId: sourceNode.id,
    targetNodeId: targetNode.id,
    sourceId: `${sourceNode.id}_right`,
    targetId: `${targetNode.id}_left`,
    type: 'association',
    lineStyle: 'straight',
    name: assocName,
    sourceMultiplicity: '',
    targetMultiplicity: '',
    assocAnchorNodeId: anchorId,
  };

  const sourceFk = getEntityFk(sourceNode);
  const targetFk = getEntityFk(targetNode);

  if (sourceFk.name.toLowerCase() === targetFk.name.toLowerCase()) {
    sourceFk.name = `${sourceNode.name.toLowerCase()}Id`;
    targetFk.name = `${targetNode.name.toLowerCase()}Id`;
  }

  const assocNode: UmlClassNode = {
    id: assocNodeId,
    name: assocName,
    position: {
      x: anchorNode.position.x - 110,
      y: anchorNode.position.y + 120,
    },
    width: 220,
    attributes: [sourceFk, targetFk],
    methods: [],
    assocMainConnId: mainConnId,
  };

  const dashedConnId = `conn_${timestamp}_assoc_dashed`;
  const dashedConnection: UmlConnection = {
    id: dashedConnId,
    sourceNodeId: anchorId,
    targetNodeId: assocNodeId,
    sourceId: anchorId,
    targetId: `${assocNodeId}_top`,
    type: 'association_class',
    lineStyle: 'straight',
    name: '«link»',
  };

  return { anchorNode, assocNode, mainConnection, dashedConnection };
}

/**
 * Crea una clase de asociación intermedia conectada a la línea entre source y target
 */
export function createAssociationClassBetween(
  sourceNode: UmlClassNode,
  targetNode: UmlClassNode,
  currentNodes: UmlClassNode[],
  currentConns: UmlConnection[],
): { nodes: UmlClassNode[]; connections: UmlConnection[] } {
  const { anchorNode, assocNode, mainConnection, dashedConnection } =
    buildAssociationClassElements(sourceNode, targetNode);

  return {
    nodes: [...currentNodes, anchorNode, assocNode],
    connections: [...currentConns, mainConnection, dashedConnection],
  };
}

/**
 * Verifica si un nodo es de tipo clase estándar o entidad
 */
export function isClassLikeNode(nodeType?: string): boolean {
  return !nodeType || nodeType === 'class' || nodeType === 'entity';
}
