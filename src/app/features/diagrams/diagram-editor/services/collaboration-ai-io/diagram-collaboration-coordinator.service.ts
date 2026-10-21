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

  /**
   * Configura las suscripciones a eventos WebSocket reactivos de la colaboración en tiempo real.
   * @param actions Callbacks ejecutados ante eventos remotos (drag, sync, locks, guardado de servidor).
   * @returns Lista de suscripciones RxJS creadas.
   */
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

  /**
   * Consulta si existen dos o más usuarios editando concurrentemente en la sala colaborativa activa.
   * @returns Verdadero si la edición es multiusuario.
   */
  isMultiUserEditing(): boolean {
    return this.collabService?.isMultiUserEditing() || false;
  }

  /**
   * Establece el tipo de diagrama UML en el servicio de colaboración para sincronización con pares.
   * @param type Tipo de diagrama UML activo o null.
   */
  setCurrentDiagramType(type: string | null): void {
    if (this.collabService) {
      this.collabService.currentDiagramType.set(type);
    }
  }

  /**
   * Obtiene el identificador del diagrama actualmente asociado a la sesión colaborativa.
   * @returns El ID del diagrama o null.
   */
  getCurrentDiagramId(): string | null {
    return this.collabService?.currentDiagramId() ?? null;
  }

  /**
   * Obtiene los metadatos de bloqueo de un nodo si se encuentra retenido por algún usuario.
   * @param nodeId Identificador del nodo.
   * @returns Datos del bloqueo o indefinido.
   */
  getNodeLock(nodeId: string): NodeLock | undefined {
    return this.collabService?.activeNodeLocks().get(nodeId);
  }

  /**
   * Evalúa si un nodo está bloqueado por otro usuario distinto al usuario autenticado actual.
   * @param nodeId Identificador del nodo.
   * @param currentUserId Identificador opcional del usuario actual.
   * @returns Verdadero si el nodo pertenece al bloqueo de otro colaborador.
   */
  isNodeLockedByOther(nodeId: string, currentUserId?: string): boolean {
    const lock = this.getNodeLock(nodeId);
    const userId = currentUserId || this.auth?.currentUser()?.id;
    return !!lock && lock.userId !== userId;
  }

  /**
   * Solicita el bloqueo colaborativo de un nodo UML para el usuario local.
   * @param nodeId Identificador del nodo a bloquear.
   */
  requestNodeLock(nodeId: string): void {
    this.collabService?.requestNodeLock(nodeId);
  }

  /**
   * Libera el bloqueo colaborativo que el usuario local mantenía sobre un nodo.
   * @param nodeId Identificador del nodo.
   */
  releaseNodeLock(nodeId: string): void {
    this.collabService?.releaseNodeLock(nodeId);
  }

  /**
   * Conecta y une la sesión colaborativa a la sala del diagrama indicado.
   * @param diagramId Identificador del diagrama.
   */
  joinRoom(diagramId: string): void {
    if (!diagramId) return;
    this.collabService?.joinRoom(diagramId);
  }

  /**
   * Abandona la sala colaborativa activa.
   */
  leaveRoom(): void {
    this.collabService?.leaveRoom();
  }

  /**
   * Realiza la transición de una sala colaborativa a otra de forma ordenada.
   * @param prevDiagramId Identificador del diagrama previo.
   * @param nextDiagramId Identificador del nuevo diagrama destino.
   */
  switchRoom(prevDiagramId: string | null, nextDiagramId: string): void {
    if (prevDiagramId && prevDiagramId !== nextDiagramId) {
      this.leaveRoom();
    }
    this.joinRoom(nextDiagramId);
  }

  /**
   * Transmite las nuevas coordenadas de un nodo en arrastre a los pares conectados.
   * @param nodeId Identificador del nodo en movimiento.
   * @param position Coordenadas actuales { x, y }.
   */
  sendNodeDrag(nodeId: string, position: { x: number; y: number }): void {
    this.collabService?.sendNodeDrag(nodeId, position);
  }

  /**
   * Transmite la posición del cursor del usuario sobre el lienzo a los demás colaboradores.
   * @param canvasX Coordenada X relativa al lienzo.
   * @param canvasY Coordenada Y relativa al lienzo.
   */
  sendCursorPosition(canvasX: number, canvasY: number): void {
    this.collabService?.sendCursorPosition(canvasX, canvasY);
  }

  /**
   * Transmite una sincronización completa de la estructura de nodos y conexiones tras un cambio local.
   * @param nodes Lista de nodos actualizada.
   * @param connections Lista de conexiones actualizada.
   * @param action Identificador descriptivo de la acción ('update', 'delete', etc.).
   * @param defaultLineStyle Estilo de línea por defecto.
   */
  sendDiagramSync(
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    action: string,
    defaultLineStyle?: UmlLineStyle,
  ): void {
    this.collabService?.sendDiagramSync(nodes, connections, action, defaultLineStyle);
  }
}
