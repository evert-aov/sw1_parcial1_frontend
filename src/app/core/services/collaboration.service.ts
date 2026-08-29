import { Injectable, signal, inject } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Subject } from 'rxjs';
import { AuthService } from './auth.service';
import { UmlClassNode, UmlConnection } from '../models/diagram.model';

export interface RemoteCursor {
  userId: string;
  userName: string;
  x: number;
  y: number;
  color: string;
}

export interface Collaborator {
  userId: string;
  userName: string;
  color: string;
  isConnected: boolean;
}

export interface ChatMessage {
  userId: string;
  userName: string;
  message: string;
  timestamp: string;
}

@Injectable({
  providedIn: 'root',
})
export class CollaborationService {
  private readonly authService = inject(AuthService);
  private socket: Socket | null = null;
  private readonly socketUrl = 'http://localhost:3000/collaboration';

  readonly isConnected = signal<boolean>(false);
  readonly activeRoomCode = signal<string | null>(null);
  readonly currentDiagramId = signal<string | null>(null);
  readonly myColor = signal<string>('#3B82F6');
  readonly collaborators = signal<Collaborator[]>([]);
  readonly remoteCursors = signal<RemoteCursor[]>([]);
  readonly chatMessages = signal<ChatMessage[]>([]);

  // Notificadores reactivos de cambios remotos
  readonly remoteNodeDrag$ = new Subject<{ nodeId: string; position: { x: number; y: number }; userId: string }>();
  readonly remoteDiagramSync$ = new Subject<{ nodes: UmlClassNode[]; connections: UmlConnection[]; userId: string; action: string }>();

  // Throttling de cursor para alto rendimiento
  private lastCursorSent = 0;

  connect(): void {
    if (this.socket) {
      if (!this.socket.connected) {
        this.socket.connect();
      }
      return;
    }

    this.socket = io(this.socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      this.isConnected.set(true);
      const diagramId = this.currentDiagramId();
      if (diagramId) {
        this.emitJoinRoom(diagramId);
      }
    });

    this.socket.on('disconnect', () => {
      this.isConnected.set(false);
      this.remoteCursors.set([]);
    });

    this.socket.on('room_participants_updated', (data: { roomCode: string; participants: Collaborator[] }) => {
      if (data && data.participants) {
        this.collaborators.set(data.participants);
      }
    });

    this.socket.on('user_left', (data: { userId: string; userName?: string }) => {
      this.collaborators.update((list) => list.filter((c) => c.userId !== data.userId));
      this.remoteCursors.update((cursors) => cursors.filter((c) => c.userId !== data.userId));
    });

    this.socket.on('cursor_moved', (data: RemoteCursor) => {
      const currentUserId = this.authService.currentUser()?.id;
      if (data.userId === currentUserId) return;

      this.remoteCursors.update((cursors) => {
        const index = cursors.findIndex((c) => c.userId === data.userId);
        if (index >= 0) {
          const updated = [...cursors];
          updated[index] = data;
          return updated;
        }
        return [...cursors, data];
      });
    });

    this.socket.on('node_dragged', (data: { nodeId: string; position: { x: number; y: number }; userId: string }) => {
      const currentUserId = this.authService.currentUser()?.id;
      if (data.userId === currentUserId) return;
      this.remoteNodeDrag$.next(data);
    });

    this.socket.on('diagram_synced', (data: { nodes: UmlClassNode[]; connections: UmlConnection[]; userId: string; action: string }) => {
      const currentUserId = this.authService.currentUser()?.id;
      if (data.userId === currentUserId) return;
      this.remoteDiagramSync$.next(data);
    });

    this.socket.on('chat_message_received', (msg: ChatMessage) => {
      this.chatMessages.update((list) => [...list, msg]);
    });
  }

  joinRoom(diagramId: string, customRoomCode?: string): void {
    this.currentDiagramId.set(diagramId);
    this.connect();

    if (this.socket && this.socket.connected) {
      this.emitJoinRoom(diagramId, customRoomCode);
    }
  }

  private emitJoinRoom(diagramId: string, customRoomCode?: string): void {
    const user = this.authService.currentUser();
    if (!user) return;

    const assignedColor = this.generateUserColor(user.fullName || user.id);
    this.myColor.set(assignedColor);

    this.socket?.emit(
      'join_room',
      {
        diagramId,
        roomCode: customRoomCode,
        userId: user.id,
        userName: user.fullName || 'Usuario',
        color: assignedColor,
      },
      (res: { success: boolean; session: any; participants?: Collaborator[] }) => {
        if (res && res.success && res.session) {
          this.activeRoomCode.set(res.session.roomCode);
          if (res.participants) {
            this.collaborators.set(res.participants);
          } else if (res.session.participants) {
            const list: Collaborator[] = res.session.participants.map((p: any) => ({
              userId: p.userId,
              userName: p.fullName,
              color: p.cursorColor,
              isConnected: p.isConnected,
            }));
            this.collaborators.set(list);
          }
        }
      },
    );
  }

  leaveRoom(): void {
    const user = this.authService.currentUser();
    const roomCode = this.activeRoomCode();
    if (this.socket && roomCode && user) {
      this.socket.emit('leave_room', {
        roomCode,
        userId: user.id,
      });
    }
    this.activeRoomCode.set(null);
    this.remoteCursors.set([]);
    this.collaborators.set([]);
  }

  sendCursorPosition(x: number, y: number): void {
    const now = Date.now();
    if (now - this.lastCursorSent < 25) return; // ~40 fps
    this.lastCursorSent = now;

    const user = this.authService.currentUser();
    const roomCode = this.activeRoomCode();
    if (!this.socket || !roomCode || !user) return;

    this.socket.emit('cursor_move', {
      roomCode,
      userId: user.id,
      userName: user.fullName || 'Usuario',
      color: this.myColor(),
      x: Math.round(x),
      y: Math.round(y),
    });
  }

  sendNodeDrag(nodeId: string, position: { x: number; y: number }): void {
    const user = this.authService.currentUser();
    const roomCode = this.activeRoomCode();
    if (!this.socket || !roomCode || !user) return;

    this.socket.emit('node_drag', {
      roomCode,
      nodeId,
      position,
      userId: user.id,
    });
  }

  sendDiagramSync(nodes: UmlClassNode[], connections: UmlConnection[], action = 'update'): void {
    const user = this.authService.currentUser();
    const roomCode = this.activeRoomCode();
    if (!this.socket || !roomCode || !user) return;

    this.socket.emit('diagram_sync', {
      roomCode,
      nodes,
      connections,
      userId: user.id,
      action,
    });
  }

  sendChatMessage(message: string): void {
    const user = this.authService.currentUser();
    const roomCode = this.activeRoomCode();
    if (!this.socket || !roomCode || !user || !message.trim()) return;

    this.socket.emit('chat_message', {
      roomCode,
      userId: user.id,
      userName: user.fullName,
      message: message.trim(),
    });
  }

  disconnect(): void {
    this.leaveRoom();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected.set(false);
  }

  private generateUserColor(seed: string): string {
    const palette = [
      '#EF4444', // Rojo Coral
      '#F59E0B', // Ámbar Oro
      '#10B981', // Verde Esmeralda
      '#3B82F6', // Azul Cobalto
      '#6366F1', // Índigo Real
      '#8B5CF6', // Púrpura Eléctrico
      '#EC4899', // Rosa Magenta
      '#06B6D4', // Cian Neón
      '#F97316', // Naranja Fuego
    ];
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % palette.length;
    return palette[index];
  }
}
