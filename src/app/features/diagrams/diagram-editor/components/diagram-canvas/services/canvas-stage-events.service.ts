import { Injectable, NgZone, inject } from '@angular/core';
import Konva from 'konva';
import {
  DiagramType,
  UmlClassNode,
  UmlConnection,
  UmlRelationshipType,
} from '../../../../../../core/models/diagram.model';
import { DiagramSequenceActivationService } from '../../../services/diagram-sequence-activation.service';
import { CanvasRelationshipManagerService } from './canvas-relationship-manager.service';

/**
 * Callbacks emitidos por los eventos interactivos del escenario Konva.
 */
export interface StageEventsCallbacks {
  onConnectionClick: (connId: string, event: MouseEvent) => void;
  onConnectionDblClick: (conn: UmlConnection, event: MouseEvent) => void;
  onConnectionContextMenu: (conn: UmlConnection, event: MouseEvent) => void;
  onCanvasBackgroundClick: (event?: MouseEvent) => void;
  onCanvasMouseDown: (event: MouseEvent) => void;
  onCanvasMouseMove: (event: MouseEvent) => void;
  onCanvasContextMenu: (event: { event: MouseEvent; canvasPos: { x: number; y: number } }) => void;
  onSelectionChange: (event: { nodeIds: string[]; connectionIds: string[] }) => void;
  onSelect: (nodeIds: string[], connIds: string[]) => void;
  onClearSelection: () => void;
  onLivePreview: (sourceId: string, x: number, y: number) => void;
  onClearLivePreview: () => void;
}

/**
 * Contexto necesario para enlazar los eventos globales del escenario Konva.
 */
export interface StageEventsContext {
  stage: Konva.Stage | null;
  bgRect: Konva.Rect | null;
  uiLayer: Konva.Layer | null;
  nodeLayer: Konva.Layer | null;
  relLayer: Konva.Layer | null;
  nodeGroupsMap: Map<string, Konva.Group>;
  nodes: () => UmlClassNode[];
  connections: () => UmlConnection[];
  activeDiagramType: () => DiagramType;
  selectedRelationType: () => UmlRelationshipType | null;
  pendingSourceNodeId: () => string | null;
  setPendingSourceNodeId: (id: string | null) => void;
  isReadOnly: () => boolean;
  isDraggingNode: () => boolean;
  selectedConnIds: () => string[];
  sequenceActivationService: DiagramSequenceActivationService;
  relationshipManager: CanvasRelationshipManagerService;
  ngZone: NgZone;
  callbacks: StageEventsCallbacks;
}

/**
 * Servicio especializado en la gestión de eventos del escenario Konva (CanvasStageEventsService).
 *
 * Administra:
 * - Selección rectangular por recuadro (Marquee Selection) con detección geométrica AABB.
 * - Clics sobre el fondo, menú contextual y eventos de puntero globales del escenario.
 * - Despacho de interacciones sobre conexiones en el lienzo.
 */
@Injectable({
  providedIn: 'root',
})
export class CanvasStageEventsService {
  private marqueeRect: Konva.Rect | null = null;
  private isMarqueeSelecting = false;
  private marqueeStartPos = { x: 0, y: 0 };
  private lastMarqueeSelectionKey = '';
  private onWindowMouseUpHandler?: () => void;

  /**
   * Inicializa y registra el rectángulo de selección múltiple (Marquee) en la capa UI de Konva.
   *
   * @param uiLayer Capa Konva donde se renderizará el recuadro interactivo.
   * @returns Instancia de Konva.Rect creada.
   */
  initMarqueeRect(uiLayer: Konva.Layer): Konva.Rect {
    this.marqueeRect = new Konva.Rect({
      name: 'marquee-rect',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      visible: false,
      stroke: '#2563EB',
      strokeWidth: 1.5,
      dash: [4, 4],
      fill: 'rgba(37, 99, 235, 0.12)',
      listening: false,
    });
    uiLayer.add(this.marqueeRect);
    return this.marqueeRect;
  }

  /**
   * Obtiene la referencia al rectángulo de selección Marquee activo.
   *
   * @returns Instancia de Konva.Rect o null si no ha sido inicializado.
   */
  getMarqueeRect(): Konva.Rect | null {
    return this.marqueeRect;
  }

  /**
   * Conecta los controladores de eventos globales del escenario Konva.
   *
   * @param ctx Contexto del escenario con referencias al Stage, capas, mapa de nodos y callbacks.
   * @returns Función de limpieza para desvincular observadores globales de ventana.
   */
  bindStageEvents(ctx: StageEventsContext): () => void {
    const stage = ctx.stage;
    if (!stage) return () => {};

    // Evita duplicar el listener global si bindStageEvents se invoca más de una vez.
    this.removeWindowMouseUpListener();

    const finishMarquee = () => {
      if (this.isMarqueeSelecting) {
        this.isMarqueeSelecting = false;
        this.lastMarqueeSelectionKey = '';
        if (this.marqueeRect) {
          this.marqueeRect.visible(false);
          ctx.uiLayer?.batchDraw();
        }
      }
    };

    // Los listeners Konva viven fuera de NgZone; solo se reentra con ngZone.run()
    // cuando ocurre un cambio real de estado (selección, clic, menú contextual...).
    ctx.ngZone.runOutsideAngular(() => {
      stage.on('mousedown touchstart', (e: Konva.KonvaEventObject<MouseEvent>) => {
        this.handleMouseDown(e, ctx);
      });

      stage.on('dblclick dbltap', (e: Konva.KonvaEventObject<MouseEvent>) => {
        this.handleDblClick(e, ctx);
      });

      stage.on('contextmenu', (e: Konva.KonvaEventObject<MouseEvent>) => {
        this.handleContextMenu(e, ctx);
      });

      stage.on('mousemove touchmove', (e: Konva.KonvaEventObject<MouseEvent>) => {
        this.handleMouseMove(e, ctx);
      });

      stage.on('mouseup touchend', finishMarquee);

      this.onWindowMouseUpHandler = finishMarquee;
      if (typeof window !== 'undefined') {
        window.addEventListener('mouseup', finishMarquee);
      }
    });

    return () => this.removeWindowMouseUpListener();
  }

  /**
   * Elimina el listener global de `mouseup` registrado por `bindStageEvents`.
   */
  private removeWindowMouseUpListener(): void {
    if (this.onWindowMouseUpHandler && typeof window !== 'undefined') {
      window.removeEventListener('mouseup', this.onWindowMouseUpHandler);
    }
    this.onWindowMouseUpHandler = undefined;
  }

  /**
   * Gestiona el evento de pulsación inicial del ratón o toque sobre el escenario.
   *
   * @param e Evento Konva de pulsación con datos del MouseEvent nativo.
   * @param ctx Contexto de ejecución del escenario.
   */
  private handleMouseDown(e: Konva.KonvaEventObject<MouseEvent>, ctx: StageEventsContext): void {
    const isTargetStage = e.target === ctx.stage || e.target === ctx.bgRect;
    if (!isTargetStage) return;

    const pointer = ctx.stage?.getPointerPosition() || { x: 0, y: 0 };
    const transform = ctx.stage?.getAbsoluteTransform().copy().invert();
    const canvasPos = transform ? transform.point(pointer) : pointer;
    const canvasX = Math.round(canvasPos.x);
    const canvasY = Math.round(canvasPos.y);

    const nearConn = ctx.relationshipManager.findClosestRelationshipAtCanvasPoint({
      canvasX,
      canvasY,
      nodes: ctx.nodes(),
      connections: ctx.connections(),
      nodeGroupsMap: ctx.nodeGroupsMap,
      activeDiagramType: ctx.activeDiagramType(),
      sequenceActivationService: ctx.sequenceActivationService,
      maxDistancePx: 28,
    });
    if (nearConn) {
      ctx.ngZone.run(() => {
        ctx.callbacks.onSelect([], [nearConn.id]);
        ctx.callbacks.onConnectionClick(nearConn.id, e.evt);
      });
      return;
    }

    const mouseEvt = e.evt;
    const isLeftClick = mouseEvt.button === 0 || mouseEvt.button === undefined;

    if (isLeftClick && !ctx.selectedRelationType() && !ctx.isReadOnly()) {
      this.isMarqueeSelecting = true;
      this.lastMarqueeSelectionKey = '';
      this.marqueeStartPos = { x: canvasX, y: canvasY };
      if (this.marqueeRect) {
        this.marqueeRect.position({ x: canvasX, y: canvasY });
        this.marqueeRect.size({ width: 0, height: 0 });
        this.marqueeRect.visible(false);
      }
      if (!mouseEvt.shiftKey && !mouseEvt.ctrlKey) {
        ctx.ngZone.run(() => {
          ctx.callbacks.onClearSelection();
        });
      }
    }

    ctx.ngZone.run(() => {
      ctx.setPendingSourceNodeId(null);
      ctx.callbacks.onClearLivePreview();
      if (!this.isMarqueeSelecting) {
        ctx.callbacks.onClearSelection();
      }
      ctx.callbacks.onCanvasBackgroundClick(e.evt);
      ctx.callbacks.onCanvasMouseDown(e.evt);
    });
  }

  /**
   * Gestiona el doble clic sobre el escenario para detectar conexiones cercanas.
   *
   * @param e Evento Konva de doble pulsación.
   * @param ctx Contexto de ejecución del escenario.
   */
  private handleDblClick(e: Konva.KonvaEventObject<MouseEvent>, ctx: StageEventsContext): void {
    const isTargetStage = e.target === ctx.stage || e.target === ctx.bgRect;
    if (!isTargetStage) return;

    const pointer = ctx.stage?.getPointerPosition() || { x: 0, y: 0 };
    const transform = ctx.stage?.getAbsoluteTransform().copy().invert();
    const canvasPos = transform ? transform.point(pointer) : pointer;

    const nearConn = ctx.relationshipManager.findClosestRelationshipAtCanvasPoint({
      canvasX: Math.round(canvasPos.x),
      canvasY: Math.round(canvasPos.y),
      nodes: ctx.nodes(),
      connections: ctx.connections(),
      nodeGroupsMap: ctx.nodeGroupsMap,
      activeDiagramType: ctx.activeDiagramType(),
      sequenceActivationService: ctx.sequenceActivationService,
      maxDistancePx: 28,
    });
    if (nearConn) {
      ctx.ngZone.run(() => {
        ctx.callbacks.onConnectionDblClick(nearConn, e.evt);
      });
    }
  }

  /**
   * Gestiona el clic derecho o menú contextual sobre el escenario.
   *
   * @param e Evento Konva de menú contextual.
   * @param ctx Contexto de ejecución del escenario.
   */
  private handleContextMenu(e: Konva.KonvaEventObject<MouseEvent>, ctx: StageEventsContext): void {
    e.evt.preventDefault();
    const isTargetStage = e.target === ctx.stage || e.target === ctx.bgRect;
    if (!isTargetStage) return;

    const pointer = ctx.stage?.getPointerPosition() || { x: 0, y: 0 };
    const transform = ctx.stage?.getAbsoluteTransform().copy().invert();
    const canvasPos = transform ? transform.point(pointer) : pointer;
    const canvasX = Math.round(canvasPos.x);
    const canvasY = Math.round(canvasPos.y);

    const nearConn = ctx.relationshipManager.findClosestRelationshipAtCanvasPoint({
      canvasX,
      canvasY,
      nodes: ctx.nodes(),
      connections: ctx.connections(),
      nodeGroupsMap: ctx.nodeGroupsMap,
      activeDiagramType: ctx.activeDiagramType(),
      sequenceActivationService: ctx.sequenceActivationService,
      maxDistancePx: 28,
    });
    if (nearConn) {
      ctx.ngZone.run(() => {
        ctx.callbacks.onSelect([], [nearConn.id]);
        ctx.callbacks.onConnectionContextMenu(nearConn, e.evt);
      });
      return;
    }

    ctx.ngZone.run(() => {
      ctx.callbacks.onCanvasContextMenu({
        event: e.evt,
        canvasPos: { x: canvasX, y: canvasY },
      });
    });
  }

  /**
   * Gestiona el movimiento del ratón sobre el escenario (recuadro marquee, previsualización de relación o hover).
   *
   * @param e Evento Konva de movimiento de ratón.
   * @param ctx Contexto de ejecución del escenario.
   */
  private handleMouseMove(e: Konva.KonvaEventObject<MouseEvent>, ctx: StageEventsContext): void {
    if (!ctx.stage) return;

    const pointer = ctx.stage.getPointerPosition() || { x: 0, y: 0 };
    const transform = ctx.stage.getAbsoluteTransform().copy().invert();
    const canvasPos = transform ? transform.point(pointer) : pointer;
    const canvasX = Math.round(canvasPos.x);
    const canvasY = Math.round(canvasPos.y);

    if (this.isMarqueeSelecting && this.marqueeRect) {
      const x = Math.min(this.marqueeStartPos.x, canvasX);
      const y = Math.min(this.marqueeStartPos.y, canvasY);
      const w = Math.abs(canvasX - this.marqueeStartPos.x);
      const h = Math.abs(canvasY - this.marqueeStartPos.y);

      this.marqueeRect.position({ x, y });
      this.marqueeRect.size({ width: w, height: h });
      this.marqueeRect.visible(w > 3 || h > 3);

      const intersectingIds: string[] = [];
      for (const [id, group] of ctx.nodeGroupsMap.entries()) {
        const gx = group.x();
        const gy = group.y();
        const gw = group.width() || 180;
        const gh = group.height() || 100;

        if (gx < x + w && gx + gw > x && gy < y + h && gy + gh > y) {
          intersectingIds.push(id);
        }
      }

      const selectionKey = intersectingIds.slice().sort().join('|');
      if (selectionKey !== this.lastMarqueeSelectionKey) {
        this.lastMarqueeSelectionKey = selectionKey;
        ctx.ngZone.run(() => {
          ctx.callbacks.onSelect(intersectingIds, []);
          ctx.callbacks.onSelectionChange({ nodeIds: intersectingIds, connectionIds: [] });
        });
      }
      ctx.uiLayer?.batchDraw();
    }

    const pendingSrcId = ctx.pendingSourceNodeId();
    if (pendingSrcId) {
      ctx.callbacks.onLivePreview(pendingSrcId, canvasPos.x, canvasPos.y);
    } else if (!ctx.isDraggingNode() && !this.isMarqueeSelecting) {
      const isOverNode = e.target?.getLayer() === ctx.nodeLayer;
      if (!isOverNode && !ctx.selectedRelationType() && ctx.connections().length > 0) {
        const now = performance.now();
        if (now - this.lastHoverCheckTime >= 40) {
          this.lastHoverCheckTime = now;
          const nearConn = ctx.relationshipManager.findClosestRelationshipAtCanvasPoint({
            canvasX,
            canvasY,
            nodes: ctx.nodes(),
            connections: ctx.connections(),
            nodeGroupsMap: ctx.nodeGroupsMap,
            activeDiagramType: ctx.activeDiagramType(),
            sequenceActivationService: ctx.sequenceActivationService,
            maxDistancePx: 28,
          });
          ctx.relationshipManager.setHoveredRelationship(
            nearConn?.id ?? null,
            new Set(ctx.selectedConnIds()),
            ctx.relLayer,
          );
          if (ctx.stage.container()) {
            ctx.stage.container().style.cursor = nearConn ? 'pointer' : 'default';
          }
        }
      } else {
        ctx.relationshipManager.setHoveredRelationship(
          null,
          new Set(ctx.selectedConnIds()),
          ctx.relLayer,
        );
        if (ctx.stage.container()) {
          ctx.stage.container().style.cursor = 'default';
        }
      }
    }
  }

  private lastHoverCheckTime = 0;

  /**
   * Libera observadores de ventana y destruye el rectángulo Marquee.
   */
  destroy(): void {
    this.removeWindowMouseUpListener();
    if (this.marqueeRect) {
      this.marqueeRect.destroy();
      this.marqueeRect = null;
    }
  }
}
