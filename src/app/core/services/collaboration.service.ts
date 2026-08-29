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
  readonly collaborators = signal<Collaborator[]>([]);
  readonly remoteCursors = signal<RemoteCursor[]>([]);
  readonly chatMessages = signal<ChatMessage[]>([]);

  // Notificadores reactivos de cambios remotos
  readonly remoteNodeDrag$ = new Subject<{ nodeId: string; position: { x: number; y: number }; userId: string }>();
  readonly remoteDiagramSync$ = new Subject<{ nodes: UmlClassNode[]; connections: UmlConnection[]; userId: string; action: string }>();

  // Throttling de cursor para alto rendimiento
  private lastCursorSent = 0;

  connect(): void {
    if (this.socket && this.socket.connected) return;

    this.socket = io(this.socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      this.isConnected.set(true);
    });

    this.socket.on('disconnect', () => {
      this.isConnected.set(false);
      this.remoteCursors.set([]);
    });

    this.socket.on('user_joined', (data: { userId: string; userName: string; color: string; participants?: any[] }) => {
      this.collaborators.update((list) => {
        const exists = list.some((c) => c.userId === data.userId);
        if (exists) {
          return list.map((c) => (c.userId === data.userId ? { ...c, isConnected: true } : c));
        }
        return [...list, { userId: data.userId, userName: data.userName, color: data.color, isConnected: true }];
      });
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
    this.connect();
    const user = this.authService.currentUser();
    if (!user) return;

    this.currentDiagramId.set(diagramId);

    this.socket?.emit(
      'join_room',
      {
        diagramId,
        roomCode: customRoomCode,
        userId: user.id,
        userName: user.fullName,
      },
      (res: { success: boolean; session: any }) => {
        if (res && res.success && res.session) {
          this.activeRoomCode.set(res.session.roomCode);
          if (res.session.participants) {
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
    if (now - this.lastCursorSent < 30) return; // 33 fps cap
    this.lastCursorSent = now;

    const user = this.authService.currentUser();
    const roomCode = this.activeRoomCode();
    if (!this.socket || !roomCode || !user) return;

    this.socket.emit('cursor_move', {
      roomCode,
      userId: user.id,
      userName: user.fullName,
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
}
