import { Injectable, ProviderToken, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { CollaborationService, NodeLock } from '../../../../core/services/collaboration.service';
import { AuthService } from '../../../../core/services/auth.service';
import { UmlClassNode, UmlConnection, UmlLineStyle } from '../../../../core/models/diagram.model';

export interface DiagramCollaborationActions {
  onRemoteNodeDrag: (data: { nodeId: string; position: { x: number; y: number } }) => void;
  onRemoteDiagramSync: (data: {
    action: string;
    nodes?: UmlClassNode[];
    connections?: UmlConnection[];
  }) => void;
  onNodeLockRejected: (data: {
    nodeId: string;
    lockedBy: { userId: string; userName: string };
  }) => void;
  onServerSave: (data: { diagramId: string; savedAt: string }) => void;
  onReconnected: () => void;
}

/**
 * Inyección opcional que devuelve `null` si el token no está provisto o si se instancia fuera de un
 * contexto de inyección (p. ej. pruebas unitarias con `new`).
 */
function injectOrNull<T>(token: ProviderToken<T>): T | null {
  try {
    return inject(token, { optional: true });
  } catch {
    return null;
  }
}

@Injectable({
  providedIn: 'root',
})
export class DiagramCollaborationCoordinatorService {
  // Inyección opcional con tipado honesto: `null` cuando el servicio no está disponible.
  private readonly collabService: CollaborationService | null = injectOrNull(CollaborationService);
  private readonly auth: AuthService | null = injectOrNull(AuthService);

  /** Posiciones de arrastre pendientes de enviar; se acumulan y se vacían una vez por frame. */
  private readonly pendingNodeDrags = new Map<string, { x: number; y: number }>();
  private dragFlushHandle: number | ReturnType<typeof setTimeout> | null = null;

  setupSubscriptions(actions: DiagramCollaborationActions): Subscription[] {
    if (!this.collabService) return [];

    const subs: Subscription[] = [];

    subs.push(
      this.collabService.remoteNodeDrag$.subscribe((data) => {
        actions.onRemoteNodeDrag(data);
      }),
    );

    subs.push(
      this.collabService.remoteDiagramSync$.subscribe((data) => {
        actions.onRemoteDiagramSync(data);
      }),
    );

    subs.push(
      this.collabService.nodeLockRejected$.subscribe((data) => {
        actions.onNodeLockRejected(data);
      }),
    );

    subs.push(
      this.collabService.lastServerSave$.subscribe((data) => {
        actions.onServerSave(data);
      }),
    );

    subs.push(
      this.collabService.onConnect$.subscribe(() => {
        actions.onReconnected();
      }),
    );

    return subs;
  }

  isMultiUserEditing(): boolean {
    return this.collabService?.isMultiUserEditing() || false;
  }

  setCurrentDiagramType(type: string | null): void {
    if (this.collabService) {
      this.collabService.currentDiagramType.set(type);
    }
  }

  getCurrentDiagramId(): string | null {
    return this.collabService?.currentDiagramId() ?? null;
  }

  getNodeLock(nodeId: string): NodeLock | undefined {
    return this.collabService?.activeNodeLocks().get(nodeId);
  }

  isNodeLockedByOther(nodeId: string, currentUserId?: string): boolean {
    const lock = this.getNodeLock(nodeId);
    const userId = currentUserId || this.auth?.currentUser()?.id;
    return !!lock && lock.userId !== userId;
  }

  requestNodeLock(nodeId: string): void {
    this.collabService?.requestNodeLock(nodeId);
  }

  releaseNodeLock(nodeId: string): void {
    this.collabService?.releaseNodeLock(nodeId);
  }

  joinRoom(diagramId: string): void {
    if (!diagramId) return;
    this.collabService?.joinRoom(diagramId);
  }

  leaveRoom(): void {
    this.cancelPendingNodeDrags();
    this.collabService?.leaveRoom();
  }

  switchRoom(prevDiagramId: string | null, nextDiagramId: string): void {
    if (prevDiagramId && prevDiagramId !== nextDiagramId) {
      this.leaveRoom();
    }
    this.joinRoom(nextDiagramId);
  }

  /**
   * Encola la posición de un nodo arrastrado. Solo la última posición de cada nodo se envía,
   * con un lote por frame, para evitar inundar el WebSocket durante `dragmove`.
   */
  sendNodeDrag(nodeId: string, position: { x: number; y: number }): void {
    if (!this.collabService) return;
    this.pendingNodeDrags.set(nodeId, position);
    if (this.dragFlushHandle !== null) return;

    const flush = (): void => {
      this.dragFlushHandle = null;
      this.flushPendingNodeDrags();
    };
    this.dragFlushHandle =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame(flush)
        : setTimeout(flush, 16);
  }

  private flushPendingNodeDrags(): void {
    const pending = Array.from(this.pendingNodeDrags);
    this.pendingNodeDrags.clear();
    for (const [id, pos] of pending) {
      this.collabService?.sendNodeDrag(id, pos);
    }
  }

  private cancelPendingNodeDrags(): void {
    if (this.dragFlushHandle !== null) {
      if (typeof cancelAnimationFrame === 'function' && typeof this.dragFlushHandle === 'number') {
        cancelAnimationFrame(this.dragFlushHandle);
      } else {
        clearTimeout(this.dragFlushHandle as ReturnType<typeof setTimeout>);
      }
      this.dragFlushHandle = null;
    }
    this.pendingNodeDrags.clear();
  }

  sendCursorPosition(canvasX: number, canvasY: number): void {
    this.collabService?.sendCursorPosition(canvasX, canvasY);
  }

  sendDiagramSync(
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    action: string,
    defaultLineStyle?: UmlLineStyle,
  ): void {
    this.collabService?.sendDiagramSync(nodes, connections, action, defaultLineStyle);
  }
}
