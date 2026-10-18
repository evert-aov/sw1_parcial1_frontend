import { effect, untracked } from '@angular/core';
import type { DiagramCanvasComponent } from './diagram-canvas.component';

/**
 * Registra y configura los 7 efectos reactivos (Angular Signals) que sincronizan el lienzo Konva con el estado de la aplicación.
 * Debe ser invocado dentro del contexto de inyección del constructor de DiagramCanvasComponent.
 *
 * @param canvas Instancia del componente DiagramCanvasComponent a enlazar.
 */
export function setupDiagramCanvasEffects(canvas: DiagramCanvasComponent): void {
  // 1. Sincronizar estructura de nodos y conexiones
  effect(() => {
    const nodes = canvas.nodes();
    canvas.connections();
    canvas.activeDiagramType();

    if (!canvas.getStage() || !canvas.getNodeLayer()) return;
    if (canvas.getIsDraggingNode()) return;

    const currentSig = canvas.computeStructureSignature();
    if (currentSig !== canvas.getLastRenderedSignature()) {
      canvas.setLastRenderedSignature(currentSig);
      canvas.renderFullDiagram(false);
    } else {
      canvas.getNodeInteraction().syncNodePositionsAndColors(
        nodes,
        canvas.getNodeGroupsMap(),
        canvas.getLastLocalMoveTimestamps()
      );
      canvas.renderRelationshipsOnly();
      canvas.syncTransformer();
      canvas.getFrameLayer()?.batchDraw();
      canvas.getNodeLayer()?.batchDraw();
      canvas.getStage()?.batchDraw();
    }
  });

  // 2. Sincronizar selección visual
  effect(() => {
    canvas.selectedNodeIds();
    canvas.selectedConnIds();

    if (!canvas.getStage() || !canvas.getNodeLayer()) return;
    if (canvas.getIsDraggingNode()) return;

    canvas.syncTransformer();
    canvas.renderRelationshipsOnly();
    const selectedIds = new Set([...canvas.selectedNodeIds(), ...canvas.getSelectedNodeIdsInternal()]);
    canvas.getNodeInteraction().updateNodesSelectionAppearance({
      nodeGroupsMap: canvas.getNodeGroupsMap(),
      selectedNodeIds: selectedIds,
      pendingSourceNodeId: canvas.pendingSourceNodeId(),
      frameLayer: canvas.getFrameLayer(),
      nodeLayer: canvas.getNodeLayer(),
    });
  });

  // 3. Sincronizar interactividad según tipo de relación activo
  effect(() => {
    const relType = canvas.selectedRelationType();
    if (!canvas.getStage() || !canvas.getNodeLayer()) return;

    const canDrag = !canvas.isReadOnly() && relType === null;
    for (const [id, group] of canvas.getNodeGroupsMap().entries()) {
      const isLocked = canvas.isNodeLockedByOther(id);
      group.draggable(canDrag && !isLocked);
    }
  });

  // 4. Sincronizar dimensiones y escala del stage
  effect(() => {
    canvas.scaledBoardWidth();
    canvas.scaledBoardHeight();
    canvas.zoomLevel();
    untracked(() => {
      canvas.updateStageDimensions();
    });
  });

  // 5. Sincronizar visibilidad de la cuadrícula
  effect(() => {
    canvas.showGrid();
    untracked(() => {
      canvas.drawGrid();
    });
  });

  // 6. Sincronizar y restaurar vista cuando cambia el diagrama
  effect(() => {
    const dId = canvas.diagramId();
    if (!dId || !canvas.getStage()) return;
    untracked(() => {
      canvas.restoreViewportScroll(dId);
    });
  });

  // 7. Sincronizar estado de guías inteligentes
  effect(() => {
    if (!canvas.smartGuidesEnabled()) {
      canvas.clearSmartGuides();
    }
  });
}
