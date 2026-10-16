# 04 - Colaboración en Tiempo Real y WebSockets

## 1. Visión General
La experiencia colaborativa multiusuario del frontend está gestionada por dos capas complementarias:
1. **`CollaborationService`** ([`src/app/core/services/collaboration.service.ts`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/src/app/core/services/collaboration.service.ts)): Conexión de transporte de bajo nivel con `Socket.IO`.
2. **`DiagramCollaborationCoordinatorService`** ([`src/app/features/diagrams/diagram-editor/services/diagram-collaboration-coordinator.service.ts`](file:///mnt/datos/uagrm/8vo_semestre/sw1/parcial_1/frontend/src/app/features/diagrams/diagram-editor/services/diagram-collaboration-coordinator.service.ts)): Orquestación de eventos de dominio, cursores y candados visuales sobre el lienzo.

---

## 2. Ciclo de Conexión y Salas

```
   [Editor Componente]               [Coordinator Service]              [Collaboration Service]             [Backend Gateway]
            │                                  │                                  │                                 │
            │ initCollaboration(projectId)    │                                  │                                 │
            │─────────────────────────────────>│ connect(projectId)              │                                 │
            │                                  │─────────────────────────────────>│ emit('join_project', ...)       │
            │                                  │                                  │────────────────────────────────>│
            │                                  │                                  │                                 │
            │                                  │                                  │<────────────────────────────────│
            │                                  │                                  │ on('user_joined')               │
            │                                  │<─────────────────────────────────│                                 │
            │                                  │ updateActiveUsersList()          │                                 │
```

1. Al abrir un diagrama, se une a la sala del proyecto emitiendo `join_project`.
2. El servicio almacena la lista reactiva de usuarios conectados en el Signal `activeUsers = signal<Collaborator[]>([])`.
3. Cada usuario recibe un color distintivo aleatorio pero consistente generado a partir de su ID para distinguir sus cursores y candados.

---

## 3. Punteros y Cursores Remotos

- Cuando el usuario mueve el ratón sobre el lienzo, el componente calcula la coordenada cartesiana teniendo en cuenta el zoom y paneo actual del canvas:
  ```typescript
  const canvasPoint = this.viewportService.screenToCanvas(event.clientX, event.clientY);
  this.collaborationService.sendCursorPosition(canvasPoint.x, canvasPoint.y);
  ```
- El backend retransmite la posición con `cursor_moved`.
- El frontend renderiza un puntero SVG flotante animado con el nombre y color del colaborador correspondiente sin interferir con los eventos de clic del usuario local (`pointer-events: none`).

---

## 4. Candados Visuales y Exclusión Mutua

- Cuando un colaborador remoto bloquea un nodo (por ejemplo, para renombrar una clase o editar sus métodos):
  - El evento `node_locked` llega al `DiagramCollaborationCoordinatorService`.
  - El nodo correspondiente se marca en el mapa de bloqueos: `lockedNodesMap.set(nodeId, { userName, color })`.
  - En el template del nodo (`uml-class-node`, etc.), se activa un borde con el color del colaborador y un icono de candado con tooltip informativo:
    ```html
    @if (isNodeLocked(node.id)) {
      <div class="absolute -top-3 -right-2 px-1.5 py-0.5 rounded text-[10px] bg-red-500 text-white flex items-center gap-1 shadow">
        <ng-icon name="heroLockClosed"></ng-icon>
        <span>{{ getLockOwner(node.id) }}</span>
      </div>
    }
    ```
  - El usuario local tiene deshabilitado el doble clic y el arrastre de ese nodo mientras permanezca bloqueado.

---

## 5. Resiliencia y Reconexión Suave
- Si el servidor WebSocket se reinicia o se pierde la red momentáneamente, `socket.io-client` reintenta automáticamente la conexión con retroceso exponencial (*exponential backoff*).
- Al reconectarse, el cliente vuelve a emitir `join_project` para restablecer el estado sin que el usuario tenga que recargar la página.
