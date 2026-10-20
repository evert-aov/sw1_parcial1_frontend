import { Injectable, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { CollaborationService, NodeLock } from '../../../../../core/services/collaboration.service';
import { AuthService } from '../../../../../core/services/auth.service';
import {
  UmlClassNode,
  UmlConnection,
  UmlLineStyle,
} from '../../../../../core/models/diagram.model';

export interface DiagramCollaborationActions {
  onRemoteNodeDrag: (data: { nodeId: string; position: { x: number; y: number } }) => void;
  onRemoteDiagramSync: (data: { action: string; nodes?: UmlClassNode[]; connections?: UmlConnection[] }) => void;
  onNodeLockRejected: (data: { nodeId: string; lockedBy: { userId: string; userName: string } }) => void;
  onServerSave: (data: { diagramId: string; savedAt: string }) => void;
  onReconnected: () => void;
}

@Injectable({
  providedIn: 'root',
})
export class DiagramCollaborationCoordinatorService {
  private readonly collabService: CollaborationService;
  private readonly auth: AuthService | undefined;

  constructor(collabService?: CollaborationService, auth?: AuthService) {
    if (collabService) {
      this.collabService = collabService;
    } else {
      try {
        this.collabService = inject(CollaborationService);
      } catch (_) {
        this.collabService = undefined as any;
      }
    }

    if (auth) {
      this.auth = auth;
    } else {
      try {
        this.auth = inject(AuthService);
      } catch (_) {
        this.auth = undefined;
      }
    }
  }

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
    this.collabService?.leaveRoom();
  }

  switchRoom(prevDiagramId: string | null, nextDiagramId: string): void {
    if (prevDiagramId && prevDiagramId !== nextDiagramId) {
      this.leaveRoom();
    }
    this.joinRoom(nextDiagramId);
  }

  sendNodeDrag(nodeId: string, position: { x: number; y: number }): void {
    this.collabService?.sendNodeDrag(nodeId, position);
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
