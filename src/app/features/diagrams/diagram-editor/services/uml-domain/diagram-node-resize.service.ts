import { Injectable, ChangeDetectorRef } from '@angular/core';
import { UmlClassNode } from '../../../../../core/models/diagram.model';

export interface NodeResizeResult {
  node: UmlClassNode;
  width: number;
  height: number;
  position: { x: number; y: number };
}

@Injectable({ providedIn: 'root' })
export class DiagramNodeResizeService {
  /**
   * Determina las dimensiones mínimas para un nodo según su tipo de classifier UML.
   */
  getMinDimensions(node: UmlClassNode, dynamicNodeWidthFn?: (node: UmlClassNode) => number): { minW: number; minH: number } {
    let minW = 120;
    let minH = 60;
    if (node.nodeType === 'actor') {
      minW = 50;
      minH = 65;
    } else if (node.nodeType === 'use_case') {
      minW = 80;
      minH = 45;
    } else if (node.nodeType === 'package' || node.nodeType === 'boundary_box') {
      minW = 120;
      minH = 70;
    } else if (node.nodeType === 'boundary' || node.nodeType === 'control' || node.nodeType === 'entity') {
      minW = 50;
      minH = 50;
    } else if (node.nodeType === 'component') {
      minW = 140;
      minH = 50;
    } else if (node.nodeType === 'device' || node.nodeType === 'executionEnvironment' || node.nodeType === 'node') {
      minW = 160;
      minH = 90;
    } else if (dynamicNodeWidthFn) {
      minW = Math.max(90, dynamicNodeWidthFn(node));
    }
    return { minW, minH };
  }

  /**
   * Inicia el proceso de redimensión interactiva suave a 60 FPS mediante captura de puntero.
   */
  startResize(options: {
    event: PointerEvent;
    node: UmlClassNode;
    handleType: string;
    scale: number;
    initialWidth: number;
    initialHeight: number;
    dynamicNodeWidthFn?: (node: UmlClassNode) => number;
    cdr: ChangeDetectorRef;
    onRedraw: () => void;
    onComplete: (result: NodeResizeResult) => void;
  }): void {
    const {
      event,
      node,
      handleType,
      scale,
      initialWidth,
      initialHeight,
      dynamicNodeWidthFn,
      cdr,
      onRedraw,
      onComplete,
    } = options;

    event.preventDefault();
    event.stopPropagation();

    const targetEl = event.currentTarget as HTMLElement | null;
    if (targetEl && targetEl.setPointerCapture) {
      try {
        targetEl.setPointerCapture(event.pointerId);
      } catch (_) {}
    }

    const startX = event.clientX;
    const startY = event.clientY;
    const initialW = initialWidth;
    const initialH = initialHeight;
    const initialPosX = node.position ? node.position.x : 0;
    const initialPosY = node.position ? node.position.y : 0;

    const { minW, minH } = this.getMinDimensions(node, dynamicNodeWidthFn);

    let animationFrameId: number | null = null;
    let latestE: PointerEvent | null = null;

    const applyResize = () => {
      if (!latestE) return;
      const dx = (latestE.clientX - startX) / scale;
      const dy = (latestE.clientY - startY) / scale;

      let nextW = initialW;
      let nextH = initialH;
      let nextX = initialPosX;
      let nextY = initialPosY;

      if (handleType.includes('right')) {
        nextW = initialW + dx;
      } else if (handleType.includes('left')) {
        nextW = initialW - dx;
      }

      if (handleType.includes('bottom')) {
        nextH = initialH + dy;
      } else if (handleType.includes('top')) {
        nextH = initialH - dy;
      }

      const clampedW = Math.max(minW, Math.round(nextW));
      const clampedH = Math.max(minH, Math.round(nextH));

      if (handleType.includes('left')) {
        nextX = Math.round(initialPosX + (initialW - clampedW));
      }
      if (handleType.includes('top')) {
        nextY = Math.round(initialPosY + (initialH - clampedH));
      }

      node.customWidth = clampedW;
      node.customHeight = clampedH;
      node.isCustomSize = true;
      node.width = clampedW;
      node.height = clampedH;
      node.position = { x: nextX, y: nextY };

      cdr.detectChanges();
      onRedraw();
      animationFrameId = null;
    };

    const onPointerMove = (e: PointerEvent) => {
      latestE = e;
      if (!animationFrameId) {
        animationFrameId = requestAnimationFrame(applyResize);
      }
    };

    const onPointerUp = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      if (targetEl && targetEl.releasePointerCapture) {
        try {
          targetEl.releasePointerCapture(event.pointerId);
        } catch (_) {}
      }
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      if (latestE) {
        applyResize();
      }

      onComplete({
        node,
        width: node.customWidth || node.width || initialW,
        height: node.customHeight || node.height || initialH,
        position: node.position,
      });
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }
}
