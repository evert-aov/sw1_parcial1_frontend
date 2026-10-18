import { Injectable, NgZone } from '@angular/core';
import Konva from 'konva';
import {
  DiagramType,
  UmlClassNode,
  UmlConnection,
} from '../../../../../../core/models/diagram.model';
import {
  createUmlRelationshipKonvaGroup,
  getPointToRelationshipDistance,
} from '../konva/nodes';
import { toKonvaNode, toKonvaRelationship } from '../konva/konva-adapter.util';
import { UmlNode } from '../konva/models/uml.model';
import { DiagramSequenceActivationService } from '../../../services/diagram-sequence-activation.service';

export interface RelDrawAnimationState {
  startTime: number;
  duration: number;
  delay: number;
}

/**
 * Servicio encargado de la renderización, animación interactiva a 60 FPS,
 * detección de colisiones de cursor y previsualización en vivo de relaciones UML en Konva.
 */
@Injectable({
  providedIn: 'root',
})
export class CanvasRelationshipManagerService {
  private readonly konvaRelGroupMap = new Map<string, Konva.Group>();
  private readonly relAnimStates = new Map<string, RelDrawAnimationState>();
  private readonly relProgressMap = new Map<string, number>();
  private hoveredRelId: string | null = null;
  private animFrameId: number | null = null;
  private lastFrameTime = 0;
  private flowPhase = 0;
  private previewLineGroup: Konva.Group | null = null;

  /**
   * Inicializa el grupo de preview elástico dentro de la capa UI de Konva.
   *
   * @param uiLayer Capa UI de Konva donde se insertará la línea de previsualización.
   * @returns Grupo Konva.Group creado para el preview.
   */
  initPreviewGroup(uiLayer: Konva.Layer): Konva.Group {
    if (this.previewLineGroup) {
      this.previewLineGroup.destroy();
    }
    this.previewLineGroup = new Konva.Group({ listening: false });
    uiLayer.add(this.previewLineGroup);
    return this.previewLineGroup;
  }

  /**
   * Inicia el bucle de animación optimizado a 60 FPS con requestAnimationFrame
   * para dibujar progresivamente las conexiones del diagrama.
   *
   * @param onFrameRedraw Callback invocado en cada fotograma que requiera redibujar relLayer.
   */
  startRelationshipAnimationLoop(onFrameRedraw: () => void): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.lastFrameTime = performance.now();

    const step = (timestamp: number) => {
      if (!this.lastFrameTime) this.lastFrameTime = timestamp;
      this.lastFrameTime = timestamp;

      let needsRedraw = false;

      for (const [relId, animState] of this.relAnimStates.entries()) {
        const elapsed = timestamp - animState.startTime - animState.delay;
        if (elapsed < 0) {
          this.relProgressMap.set(relId, 0);
          needsRedraw = true;
        } else if (elapsed < animState.duration) {
          const t = Math.max(0, Math.min(1, elapsed / animState.duration));
          const eased = 1 - Math.pow(1 - t, 3);
          this.relProgressMap.set(relId, eased);
          needsRedraw = true;
        } else {
          this.relProgressMap.set(relId, 1);
          this.relAnimStates.delete(relId);
          needsRedraw = true;
        }
      }

      if (needsRedraw) {
        onFrameRedraw();
      }

      if (this.relAnimStates.size > 0) {
        this.animFrameId = requestAnimationFrame(step);
      } else {
        this.animFrameId = null;
        this.lastFrameTime = 0;
      }
    };

    this.animFrameId = requestAnimationFrame(step);
  }

  /**
   * Cancela el bucle de animación de relaciones a 60 FPS y libera el frame pendiente.
   */
  cancelAnimation(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.lastFrameTime = 0;
  }

  /**
   * Programa la animación de entrada escalonada para todas las conexiones del diagrama.
   *
   * @param connections Lista de conexiones a animar.
   * @param staggered Si es true, añade un retraso incremental de 90ms entre cada relación.
   */
  triggerAllRelationshipsDrawAnimation(connections: UmlConnection[], staggered = true): void {
    const now = performance.now();
    this.relAnimStates.clear();
    this.relProgressMap.clear();

    connections.forEach((conn, index) => {
      this.relProgressMap.set(conn.id, 0);
      this.relAnimStates.set(conn.id, {
        startTime: now,
        duration: 680,
        delay: staggered ? index * 90 : 0,
      });
    });
  }

  /**
   * Dibuja una línea de preview interactiva (flecha discontinua esmeralda) desde el nodo origen hacia el cursor.
   *
   * @param sourceId Identificador del nodo origen de la conexión en curso.
   * @param cursorX Posición horizontal actual del cursor en el lienzo.
   * @param cursorY Posición vertical actual del cursor en el lienzo.
   * @param nodes Lista de nodos del diagrama.
   * @param activeDiagramType Tipo de diagrama activo.
   * @param uiLayer Capa Konva donde reside el grupo de preview.
   */
  drawLiveConnectionPreview(
    sourceId: string,
    cursorX: number,
    cursorY: number,
    nodes: UmlClassNode[],
    activeDiagramType: DiagramType,
    uiLayer?: Konva.Layer | null,
  ): void {
    if (!this.previewLineGroup || !uiLayer) return;
    const srcNode = nodes.find((n) => n.id === sourceId);
    if (!srcNode) return;

    this.previewLineGroup.destroyChildren();

    const isSeq = activeDiagramType === DiagramType.SEQUENCE;
    const startX = srcNode.position.x + (srcNode.width || 120) / 2;
    const startY = isSeq ? cursorY : srcNode.position.y + (srcNode.height || 100) / 2;

    const previewArrow = new Konva.Arrow({
      points: [startX, startY, cursorX, cursorY],
      stroke: '#059669',
      fill: '#059669',
      strokeWidth: 2,
      dash: [6, 4],
      pointerLength: 10,
      pointerWidth: 8,
      listening: false,
    });

    const originCircle = new Konva.Circle({
      x: startX,
      y: startY,
      radius: 5,
      fill: '#059669',
      listening: false,
    });

    this.previewLineGroup.add(originCircle, previewArrow);
    uiLayer.batchDraw();
  }

  /**
   * Elimina la línea de previsualización en vivo de la capa UI.
   *
   * @param uiLayer Capa Konva de interfaz de usuario.
   */
  clearLivePreviewLine(uiLayer?: Konva.Layer | null): void {
    if (!this.previewLineGroup || !uiLayer) return;
    this.previewLineGroup.destroyChildren();
    uiLayer.batchDraw();
  }

  /**
   * Actualiza el efecto halo de resaltado sobre la relación bajo el puntero del ratón.
   *
   * @param relId ID de la relación sobre la que está el puntero, o null para deseleccionar.
   * @param selectedConnIds Conjunto de IDs de conexiones seleccionadas.
   * @param relLayer Capa Konva donde se dibujan las relaciones.
   */
  setHoveredRelationship(
    relId: string | null,
    selectedConnIds: Set<string>,
    relLayer?: Konva.Layer | null,
  ): void {
    if (this.hoveredRelId === relId) return;

    if (this.hoveredRelId && !selectedConnIds.has(this.hoveredRelId)) {
      const prevGroup = this.konvaRelGroupMap.get(this.hoveredRelId);
      prevGroup?.find('.hover-halo').forEach((h) => h.opacity(0));
    }

    this.hoveredRelId = relId;

    if (relId) {
      const nextGroup = this.konvaRelGroupMap.get(relId);
      nextGroup?.find('.hover-halo').forEach((h) => h.opacity(1));
    }

    relLayer?.batchDraw();
  }

  /**
   * Encuentra la conexión más cercana a un punto específico del lienzo dentro de un umbral magnético de proximidad.
   *
   * @param canvasX Coordenada X dentro del lienzo.
   * @param canvasY Coordenada Y dentro del lienzo.
   * @param nodes Lista de nodos del diagrama.
   * @param connections Lista de conexiones del diagrama.
   * @param nodeGroupsMap Mapa de grupos Konva para obtener coordenadas reactivas en vivo.
   * @param activeDiagramType Tipo de diagrama activo.
   * @param sequenceActivationService Servicio de activación para diagramas de secuencia.
   * @param maxDistancePx Distancia máxima en píxeles para considerar el clic sobre la relación (por defecto 28px).
   * @returns La conexión más cercana si está dentro del umbral o null.
   */
  findClosestRelationshipAtCanvasPoint(params: {
    canvasX: number;
    canvasY: number;
    nodes: UmlClassNode[];
    connections: UmlConnection[];
    nodeGroupsMap: Map<string, Konva.Group>;
    activeDiagramType: DiagramType;
    sequenceActivationService: DiagramSequenceActivationService;
    maxDistancePx?: number;
  }): UmlConnection | null {
    const { canvasX, canvasY, nodes, connections, nodeGroupsMap, activeDiagramType, sequenceActivationService, maxDistancePx = 28 } = params;

    const nodeMap = new Map<string, UmlNode>();
    for (const rawNode of nodes) {
      if (!rawNode.isAnchor) {
        const liveG = nodeGroupsMap.get(rawNode.id);
        const kNode = toKonvaNode(rawNode, activeDiagramType, connections, sequenceActivationService);
        if (liveG) {
          kNode.x = Math.round(liveG.x());
          kNode.y = Math.round(liveG.y());
        }
        nodeMap.set(rawNode.id, kNode);
      }
    }

    let closestConn: UmlConnection | null = null;
    let bestDist = maxDistancePx;

    for (const rawConn of connections) {
      const isLegacyAnchorDashed =
        rawConn.id.includes('assoc_dashed') ||
        (rawConn.sourceNodeId && nodes.some((n) => n.id === rawConn.sourceNodeId && n.isAnchor));
      if (isLegacyAnchorDashed) continue;

      if (rawConn.id.includes('_assoc_main')) {
        const srcId = rawConn.sourceNodeId || rawConn.sourceId.replace(/_(top|right|bottom|left|slot_\d+)$/, '');
        const tgtId = rawConn.targetNodeId || rawConn.targetId.replace(/_(top|right|bottom|left|slot_\d+)$/, '');
        const hasOtherConn = connections.some(
          (c) =>
            c.id !== rawConn.id &&
            !c.id.includes('assoc_dashed') &&
            ((c.sourceNodeId === srcId && c.targetNodeId === tgtId) ||
              (c.sourceId?.startsWith(srcId) && c.targetId?.startsWith(tgtId)) ||
              (c.sourceNodeId === tgtId && c.targetNodeId === srcId) ||
              (c.sourceId?.startsWith(tgtId) && c.targetId?.startsWith(srcId)))
        );
        if (hasOtherConn) continue;
      }

      const kRel = toKonvaRelationship(rawConn, activeDiagramType, nodes, connections);
      const src = nodeMap.get(kRel.sourceId);
      const tgt = nodeMap.get(kRel.targetId);
      if (!src || !tgt) continue;

      const assocNode = kRel.associationClassNodeId ? nodeMap.get(kRel.associationClassNodeId) ?? null : null;
      const d = getPointToRelationshipDistance({ x: canvasX, y: canvasY }, kRel, src, tgt, assocNode);

      if (d <= bestDist) {
        bestDist = d;
        closestConn = rawConn;
      }
    }

    return closestConn;
  }

  /**
   * Renderiza todas las conexiones del diagrama sobre la capa relLayer.
   *
   * @param params Parámetros completos de renderizado y suscripciones de eventos interactivos.
   */
  renderRelationshipsOnly(params: {
    relLayer: Konva.Layer | null;
    stage: Konva.Stage | null;
    nodes: UmlClassNode[];
    connections: UmlConnection[];
    nodeGroupsMap: Map<string, Konva.Group>;
    selectedConnIds: Set<string>;
    activeDiagramType: DiagramType;
    sequenceActivationService: DiagramSequenceActivationService;
    isReadOnly: boolean;
    ngZone: NgZone;
    events: {
      onConnectionClick: (connId: string, event: MouseEvent) => void;
      onConnectionDblClick: (conn: UmlConnection, event: MouseEvent) => void;
      onConnectionContextMenu: (conn: UmlConnection, event: MouseEvent) => void;
      onSequenceMessageMove: (connId: string, targetSlot: number) => void;
    };
  }): void {
    const { relLayer, stage, nodes, connections, nodeGroupsMap, selectedConnIds, activeDiagramType, sequenceActivationService, isReadOnly, ngZone, events } = params;
    if (!relLayer) return;

    relLayer.destroyChildren();
    this.konvaRelGroupMap.clear();

    const nodeMap = new Map<string, UmlNode>();
    for (const rawNode of nodes) {
      if (!rawNode.isAnchor) {
        const liveG = nodeGroupsMap.get(rawNode.id);
        const kNode = toKonvaNode(rawNode, activeDiagramType, connections, sequenceActivationService);
        if (liveG) {
          kNode.x = Math.round(liveG.x());
          kNode.y = Math.round(liveG.y());
        }
        nodeMap.set(rawNode.id, kNode);
      }
    }

    const isSequenceDiag = activeDiagramType === DiagramType.SEQUENCE;

    for (const rawConn of connections) {
      const isLegacyAnchorDashed =
        rawConn.id.includes('assoc_dashed') ||
        (rawConn.sourceNodeId && nodes.some((n) => n.id === rawConn.sourceNodeId && n.isAnchor));
      if (isLegacyAnchorDashed) continue;

      if (rawConn.id.includes('_assoc_main')) {
        const srcId = rawConn.sourceNodeId || rawConn.sourceId.replace(/_(top|right|bottom|left|slot_\d+)$/, '');
        const tgtId = rawConn.targetNodeId || rawConn.targetId.replace(/_(top|right|bottom|left|slot_\d+)$/, '');
        const hasOtherConn = connections.some(
          (c) =>
            c.id !== rawConn.id &&
            !c.id.includes('assoc_dashed') &&
            ((c.sourceNodeId === srcId && c.targetNodeId === tgtId) ||
              (c.sourceId?.startsWith(srcId) && c.targetId?.startsWith(tgtId)) ||
              (c.sourceNodeId === tgtId && c.targetNodeId === srcId) ||
              (c.sourceId?.startsWith(tgtId) && c.targetId?.startsWith(srcId)))
        );
        if (hasOtherConn) continue;
      }

      const kRel = toKonvaRelationship(rawConn, activeDiagramType, nodes, connections);
      const src = nodeMap.get(kRel.sourceId);
      const tgt = nodeMap.get(kRel.targetId);
      if (!src || !tgt) continue;

      const assocNode = kRel.associationClassNodeId ? nodeMap.get(kRel.associationClassNodeId) ?? null : null;
      const isSelected = selectedConnIds.has(rawConn.id);
      const progress = this.relProgressMap.get(rawConn.id) ?? 1;

      const relGroup = createUmlRelationshipKonvaGroup(
        kRel,
        src,
        tgt,
        isSelected,
        progress,
        this.flowPhase,
        assocNode,
      );

      this.konvaRelGroupMap.set(rawConn.id, relGroup);

      if (this.hoveredRelId === rawConn.id && !isSelected) {
        relGroup.find('.hover-halo').forEach((h: Konva.Node) => (h as any).opacity(1));
      }

      relGroup.on('mouseenter', () => {
        this.setHoveredRelationship(rawConn.id, selectedConnIds, relLayer);
        if (stage?.container()) {
          stage.container().style.cursor = 'pointer';
        }
      });

      relGroup.on('mouseleave', () => {
        if (this.hoveredRelId === rawConn.id) {
          this.setHoveredRelationship(null, selectedConnIds, relLayer);
          if (stage?.container()) {
            stage.container().style.cursor = 'default';
          }
        }
      });

      const isSeqConn = isSequenceDiag || ['sync_message', 'return_message'].includes(kRel.type);
      if (isSeqConn && !isReadOnly) {
        relGroup.draggable(true);
        relGroup.dragBoundFunc((pos: Konva.Vector2d) => ({
          x: relGroup.absolutePosition().x,
          y: pos.y,
        }));

        relGroup.on('dragend', () => {
          const deltaY = relGroup.y();
          relGroup.y(0);
          const origY = kRel.yOffset || 160;
          const finalY = origY + deltaY;
          const targetSlot = Math.max(0, Math.round((finalY - 160) / 50));

          ngZone.run(() => {
            events.onSequenceMessageMove(rawConn.id, targetSlot);
          });
        });
      }

      relGroup.on('mousedown touchstart', (e: Konva.KonvaEventObject<MouseEvent>) => {
        e.cancelBubble = true;
        ngZone.run(() => {
          events.onConnectionClick(rawConn.id, e.evt as MouseEvent);
        });
      });

      relGroup.on('dblclick dbltap', (e: Konva.KonvaEventObject<MouseEvent>) => {
        e.cancelBubble = true;
        ngZone.run(() => {
          events.onConnectionDblClick(rawConn, e.evt as MouseEvent);
        });
      });

      relGroup.on('contextmenu', (e: Konva.KonvaEventObject<MouseEvent>) => {
        e.evt.preventDefault();
        e.cancelBubble = true;
        ngZone.run(() => {
          events.onConnectionContextMenu(rawConn, e.evt as MouseEvent);
        });
      });

      relLayer.add(relGroup);
    }

    relLayer.batchDraw();
  }

  /**
   * Libera recursos, detiene el bucle de animación y limpia colecciones de relaciones.
   */
  destroy(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.konvaRelGroupMap.clear();
    this.relAnimStates.clear();
    this.relProgressMap.clear();
    this.previewLineGroup = null;
    this.hoveredRelId = null;
  }
}
