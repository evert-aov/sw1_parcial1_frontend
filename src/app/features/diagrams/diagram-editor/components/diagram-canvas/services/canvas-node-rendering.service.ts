import { Injectable } from '@angular/core';
import Konva from 'konva';
import { UmlClassNode } from '../../../../../../core/models/diagram.model';
import { UmlNode } from '../konva/models/uml.model';
import { hasNodeRenderer, resolveNodeRenderer } from '../konva/nodes/node-renderer.registry';
import {
  getNodeZWeight as resolveNodeZWeight,
  isContainerNode as resolveIsContainerNode,
} from '../konva/node-classification.util';

/**
 * Servicio encargado de la renderización, estilización y jerarquía Z de figuras Konva para nodos UML.
 */
@Injectable({
  providedIn: 'root',
})
export class CanvasNodeRenderingService {
  /**
   * Instancia el grupo Konva según el tipo de nodo UML.
   *
   * @param node Modelo Konva del nodo.
   * @param isSelected Estado de selección inicial.
   * @returns Grupo Konva construido.
   */
  buildNodeGroup(node: UmlNode, isSelected: boolean): Konva.Group {
    return resolveNodeRenderer(node.type).create(node, isSelected);
  }

  /**
   * Aplica dinámicamente el color personalizado a las figuras internas de un nodo Konva.
   *
   * @param group Grupo Konva del nodo.
   * @param rawNode Modelo de datos del nodo.
   */
  applyLiveGroupColor(group: Konva.Group, rawNode: UmlClassNode): void {
    const color = rawNode.color;
    if (!color) return;

    const bgRect = group.findOne<Konva.Rect>('.bg-rect');
    if (bgRect && bgRect.fill() !== color) bgRect.fill(color);

    const ucEllipse = group.findOne<Konva.Ellipse>('.uc-ellipse');
    if (ucEllipse && ucEllipse.fill() !== color) ucEllipse.fill(color);

    const actorHead = group.findOne<Konva.Circle>('.actor-part');
    if (actorHead && actorHead.fill() !== color) actorHead.fill(color);

    const compBody = group.findOne<Konva.Rect>('.comp-part');
    if (compBody) compBody.fill(color);

    const pkgFolderParts = group.find<Konva.Rect>('.pkg-folder-part');
    pkgFolderParts.forEach((part) => {
      if (part.fill() !== color) part.fill(color);
    });

    const actParts = group.find<Konva.Shape>('.act-part');
    actParts.forEach((part) => {
      if (part instanceof Konva.Rect && part.cornerRadius() === 12) part.fill(color);
      else if (part instanceof Konva.Line && part.closed()) part.fill(color);
    });

    const lifelineBox = group.findOne<Konva.Rect>('.lifeline-part');
    if (lifelineBox && lifelineBox.fill() !== color) lifelineBox.fill(color);

    const deployBox = group.findOne<Konva.Rect>('.deploy-main');
    if (deployBox && deployBox.fill() !== color) deployBox.fill(color);

    const layerBg = group.findOne<Konva.Rect>('.layer-bg');
    if (layerBg && layerBg.fill() !== color) layerBg.fill(color);

    const notePart = group.findOne<Konva.Shape>('.note-part');
    if (notePart && notePart.fill() !== color) {
      notePart.fill(color);
    }
  }

  /**
   * Redimensiona los elementos visuales internos de un nodo Konva según su tipo UML.
   *
   * @param group Grupo Konva del nodo a redimensionar.
   * @param node Modelo Konva del nodo.
   * @param newW Nuevo ancho en píxeles.
   * @param newH Nuevo alto en píxeles.
   */
  applyFluidNodeResize(group: Konva.Group, node: UmlNode, newW: number, newH: number): void {
    if (!hasNodeRenderer(node.type)) return;
    resolveNodeRenderer(node.type).resize(group, node, newW, newH, true);
  }

  /**
   * Actualiza el trazo visual de selección sobre los nodos en pantalla.
   *
   * @param params Mapa de nodos, IDs seleccionados, nodo origen pendiente y capas Konva.
   */
  updateNodesSelectionAppearance(params: {
    nodeGroupsMap: Map<string, Konva.Group>;
    selectedNodeIds: Set<string>;
    pendingSourceNodeId: string | null;
    frameLayer?: Konva.Layer | null;
    nodeLayer?: Konva.Layer | null;
  }): void {
    const { nodeGroupsMap, selectedNodeIds, pendingSourceNodeId, frameLayer, nodeLayer } = params;

    for (const [id, group] of nodeGroupsMap.entries()) {
      const isSelected = selectedNodeIds.has(id) || id === pendingSourceNodeId;

      const bgRect = group.findOne<Konva.Rect>('.bg-rect');
      if (bgRect) {
        bgRect.stroke(isSelected ? '#059669' : '#78716C');
        bgRect.strokeWidth(isSelected ? 2 : 1.3);
      }

      const ellipse = group.findOne<Konva.Ellipse>('.uc-ellipse');
      if (ellipse) {
        ellipse.stroke(isSelected ? '#059669' : '#78716C');
        ellipse.strokeWidth(isSelected ? 2.2 : 1.6);
      }

      const hitRect = group.findOne<Konva.Rect>('.hit-rect');
      if (hitRect) {
        hitRect.stroke(isSelected ? '#10B981' : 'transparent');
        hitRect.strokeWidth(isSelected ? 1 : 0);
      }
    }
    frameLayer?.batchDraw();
    nodeLayer?.batchDraw();
  }

  /**
   * Determina si un nodo actúa como contenedor estructural de fondo.
   *
   * @param node Nodo UML a evaluar.
   * @returns True si el nodo es un contenedor estructural.
   */
  isContainerNode(node?: UmlClassNode | UmlNode | null): boolean {
    return resolveIsContainerNode(node);
  }

  /**
   * Obtiene el peso de ordenamiento de profundidad Z para un nodo.
   *
   * @param node Nodo UML a evaluar.
   * @returns Peso numérico en el eje Z (0: fondo, 100: tope).
   */
  getNodeZWeight(node: UmlClassNode | UmlNode): number {
    return resolveNodeZWeight(node);
  }

  /**
   * Asegura que los contenedores de fondo y los componentes mantengan el orden Z correcto.
   *
   * @param nodeLayer Capa Konva de nodos estándar.
   * @param frameLayer Capa Konva de contenedores estructurales de fondo.
   * @param nodeGroupsMap Mapa de grupos Konva por ID de nodo.
   * @param nodes Lista de nodos del diagrama.
   */
  enforceZOrdering(
    nodeLayer: Konva.Layer | null,
    frameLayer: Konva.Layer | null,
    nodeGroupsMap: Map<string, Konva.Group>,
    nodes: UmlClassNode[],
  ): void {
    if (!nodeLayer || !frameLayer) return;

    for (const [id, grp] of nodeGroupsMap.entries()) {
      const n = nodes.find((x) => x.id === id);
      if (!n || !this.isContainerNode(n)) continue;
      const w = this.getNodeZWeight(n);
      if (w === 0) {
        grp.moveToBottom();
      }
    }

    for (const [id, grp] of nodeGroupsMap.entries()) {
      const n = nodes.find((x) => x.id === id);
      if (!n || this.isContainerNode(n)) continue;
      const t = (n?.nodeType || '').toLowerCase();
      if (t === 'component' || t === 'artifact') {
        grp.moveToTop();
      }
    }
  }

  /**
   * Resuelve el nodo destino real considerando la contención geométrica interna.
   *
   * @param clickedNode Nodo sobre el cual se hizo clic.
   * @param stage Escenario Konva.Stage.
   * @param nodes Lista de nodos del diagrama.
   * @param nodeGroupsMap Mapa de grupos Konva.
   * @returns El nodo hijo contenido si el clic apuntaba a su interior, o clickedNode.
   */
  resolveTargetNodeAtPointer(
    clickedNode: UmlClassNode,
    stage: Konva.Stage | null,
    nodes: UmlClassNode[],
    nodeGroupsMap: Map<string, Konva.Group>,
  ): UmlClassNode {
    if (!this.isContainerNode(clickedNode)) {
      return clickedNode;
    }

    const pointer = stage?.getPointerPosition();
    if (!pointer) return clickedNode;

    const transform = stage?.getAbsoluteTransform().copy().invert();
    const canvasPos = transform ? transform.point(pointer) : pointer;
    const px = Math.round(canvasPos.x);
    const py = Math.round(canvasPos.y);

    const candidates = nodes.filter((n) => {
      if (n.id === clickedNode.id || n.isAnchor) return false;
      const group = nodeGroupsMap.get(n.id);
      const nx = group ? group.x() : (n.position?.x ?? 0);
      const ny = group ? group.y() : (n.position?.y ?? 0);
      const nw = group ? group.width() : n.width || 200;
      const nh = group ? group.height() : n.height || 100;
      return px >= nx && px <= nx + nw && py >= ny && py <= ny + nh;
    });

    if (candidates.length > 0) {
      candidates.sort((a, b) => this.getNodeZWeight(b) - this.getNodeZWeight(a));
      return candidates[0];
    }

    return clickedNode;
  }
}
