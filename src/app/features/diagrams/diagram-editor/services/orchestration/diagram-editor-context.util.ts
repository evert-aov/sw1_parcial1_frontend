import { Subscription } from 'rxjs';
import { FCreateConnectionEvent } from '@foblex/flow';
import { DiagramEditorComponent } from '../../diagram-editor.component';
import { DiagramHotkeysActions } from './diagram-hotkeys.service';
import { ToolbarAlignmentContext } from './diagram-toolbar.service';
import {
  DiagramType,
  UML_DIAGRAM_TYPES,
  UmlClassNode,
  UmlConnection,
} from '../../../../../core/models/diagram.model';

/**
 * Utilidad de ensamblaje de contextos de ejecución y delegación de acciones
 * para `DiagramEditorComponent`.
 */
export class DiagramEditorContextUtil {
  /**
   * Construye el mapa de acciones para el servicio de atajos de teclado (`DiagramHotkeysService`).
   *
   * @param editor Instancia del componente editor.
   * @returns Objeto de callbacks de atajos de teclado.
   */
  static buildHotkeysActions(editor: DiagramEditorComponent): DiagramHotkeysActions {
    return {
      isReadOnly: () => editor.isReadOnly(),
      isModalOpen: () => editor.modalService.isAnyModalOpen(),
      undo: () => editor.undo(),
      redo: () => editor.redo(),
      save: () => editor.saveDiagramManual(),
      toggleToolbox: () => editor.toggleLeftToolbar(),
      toggleAi: () => editor.toggleAiPanel(),
      copy: () => editor.copySelectedNodes(),
      cut: () => {
        editor.copySelectedNodes();
        editor.deleteSelectedNodes();
      },
      paste: () => editor.pasteClipboardNodes(),
      duplicate: () => editor.duplicateSelectedNodes(),
      selectAll: () => editor.selectAllClasses(),
      deleteSelected: () => editor.deleteSelectedNodes(),
      escape: () => {
        editor.setPointerMode();
        editor.clearSelection();
        editor.closeContextMenu();
      },
      hasContextMenu: () => !!editor.contextMenu()?.visible,
      closeContextMenu: () => editor.closeContextMenu(),
      getRenameTargetNodeId: () => editor.selectedNodeId(),
      startRenameNode: (nodeId: string) => {
        const node = editor.nodes().find((n) => n.id === nodeId);
        if (node) editor.openEditNodeModal(node);
      },
    };
  }

  /**
   * Construye el contexto de alineación y distribución para `DiagramToolbarService`.
   *
   * @param editor Instancia del componente editor.
   * @returns Contexto de operaciones de barra de herramientas.
   */
  static buildToolbarContext(editor: DiagramEditorComponent): ToolbarAlignmentContext {
    return {
      isReadOnly: editor.isReadOnly(),
      selectedNodeIds: editor.selectedNodeIds(),
      nodes: editor.nodes(),
      getNodeWidth: (n: UmlClassNode) => editor.getNodeWidth(n),
      getNodeHeight: (n: UmlClassNode) => editor.getNodeHeight(n),
      onApplyTransformation: (modified: UmlClassNode[], action: string) => {
        editor.toolbarService.applyNodesTransformation(modified, action, {
          pushSnapshot: () => editor.pushSnapshot(),
          nodes: editor.nodes(),
          connections: editor.connections(),
          defaultLineStyle: editor.defaultLineStyle(),
          markAsUnsaved: () => editor.markAsUnsaved(),
          updateConnectionEndpoints: () => editor.updateConnectionEndpoints(),
          redrawCanvas: () => editor.fCanvas?.redraw(),
          sendNodeDrag: (id, pos) => editor.collabCoordinator.sendNodeDrag(id, pos),
          sendDiagramSync: (n, c, act, s) => editor.collabCoordinator.sendDiagramSync(n, c, act, s),
        });
        editor.closeContextMenu();
      },
    };
  }

  /**
   * Inicializa las suscripciones reactivas de ruta, auto-guardado y eventos colaborativos.
   *
   * @param editor Instancia del componente editor.
   * @returns Lista de suscripciones creadas para limpieza en `ngOnDestroy`.
   */
  static setupEditorSubscriptions(editor: DiagramEditorComponent): Subscription[] {
    const subs: Subscription[] = [];

    subs.push(
      editor.route.queryParams.subscribe((params) => {
        editor.tabManager.handleRouteQueryParams(params, {
          userId: editor.authService.currentUser()?.id,
          setCurrentProjectId: (id: string) => editor.currentProjectId.set(id),
          setCurrentDiagramId: (id: string) => editor.currentDiagramId.set(id),
          setCurrentDiagramName: (name: string) => editor.currentDiagramName.set(name),
          setCurrentProject: (proj: any) => editor.currentProject.set(proj),
          setCurrentUserRole: (role: any) => editor.currentUserRole.set(role),
          loadDiagramsByProject: (pid: string) => editor.diagramService.loadDiagramsByProject(pid),
          getProject: (pid: string) => editor.projectService.getProject(pid),
          loadDiagram: (did: string) => editor.loadDiagram(did),
          resolveUserRole: (proj: any, uid?: string | null) => editor.resolveUserRole(proj, uid),
        });
      }),
    );

    subs.push(
      editor.persistenceService.setupAutoSave(() => {
        editor.saveToBackend(true);
      }, 1000),
    );

    subs.push(
      editor.persistenceService.setupNodeDragEnd(() => {
        editor.sendDiagramSync(editor.nodes(), editor.connections(), 'move_node');
      }, 600),
    );

    subs.push(
      ...editor.collabCoordinator.setupSubscriptions({
        onRemoteNodeDrag: (data) => {
          const updated = editor.nodes().map((n) =>
            n.id === data.nodeId ? { ...n, position: data.position } : n,
          );
          editor.nodes.set(updated);
          editor.updateConnectionEndpoints();
          editor.cdr.markForCheck();
        },
        onRemoteDiagramSync: (data) => {
          if (data.nodes) {
            const cleanNodes = editor.documentSyncService.normalizeIncomingNodes(
              data.nodes,
              (t, s) => editor.getDefaultColorForNodeType(t, s),
            );
            editor.nodes.set(cleanNodes);
            if (data.connections) {
              editor.connections.set(editor.sanitizeClientConnections(data.connections, cleanNodes));
            }
          } else if (data.connections) {
            editor.connections.set(
              editor.sanitizeClientConnections(data.connections, editor.nodes()),
            );
          }
          editor.updateConnectionEndpoints();
          editor.cdr.markForCheck();
        },
        onNodeLockRejected: (data) => {
          if (editor.editingNode()?.id === data.nodeId) {
            editor.closeEditNodeModal();
          }
          editor.toastService?.warning(
            `🔒 El elemento está siendo editado por ${data.lockedBy.userName}`,
          );
        },
        onServerSave: (data) => {
          if (data.diagramId === editor.currentDiagramId()) {
            editor.persistenceService.markAsSaved(data.diagramId);
          }
        },
        onReconnected: () => {
          const curId = editor.currentDiagramId();
          if (curId) editor.loadDiagram(curId);
        },
      }),
    );

    return subs;
  }

  /**
   * Ejecuta la carga de un diagrama desde el backend restaurando el borrador local si procede.
   *
   * @param editor Instancia del componente editor.
   * @param diagramId Identificador del diagrama a cargar.
   */
  static executeLoadDiagram(editor: DiagramEditorComponent, diagramId: string): void {
    const prevId = editor.collabCoordinator.getCurrentDiagramId();
    editor.collabCoordinator.switchRoom(prevId, diagramId);

    editor.persistenceService.executeLoadDiagram(editor.diagramService, diagramId, {
      getDefaultColor: (t, s) => editor.getDefaultColorForNodeType(t, s),
      normalizeDataType: (t) => editor.normalizeDataType(t),
      normalizeReturnType: (t) => editor.normalizeReturnType(t),
      recalculateSequenceNumbers: (c, p) => editor.recalculateSequenceNumbers(c, p),
      onLoaded: (diagram, resolved) => {
        const diagType = (diagram.type as DiagramType) || DiagramType.CLASS;
        editor.activeDiagramType.set(diagType);
        editor.collabCoordinator.setCurrentDiagramType(diagType);
        editor.currentDiagramName.set(diagram.name);
        editor.tabManager.addTab({ id: diagram.id, name: diagram.name, type: diagType });
        if (resolved.defaultLineStyle) {
          editor.defaultLineStyle.set(resolved.defaultLineStyle);
        }
        editor.nodes.set(resolved.nodes);
        editor.connections.set(resolved.connections);
        editor.historyService.clear();
        editor.selectionService.clearSelection();
        editor.persistenceService.syncProjectInfo(diagram.projectId, {
          hasCurrentProject: !!editor.currentProject(),
          projectDiagramsCount: editor.projectDiagrams().length,
          setCurrentProjectId: (pid: string) => editor.currentProjectId.set(pid),
          fetchProject: (pid: string) => editor.projectService.getProject(pid),
          fetchProjectDiagrams: (pid: string) => editor.diagramService.loadDiagramsByProject(pid),
          onProjectLoaded: (proj: any) => {
            editor.currentProject.set(proj);
            editor.currentUserRole.set(
              editor.resolveUserRole(proj, editor.authService.currentUser()?.id),
            );
          },
        });
        editor.viewportService.restoreCanvasViewState(
          editor.diagramCanvas,
          diagram.id,
          () => editor.updateConnectionEndpoints(),
        );
        if (resolved.fromDraft) {
          editor.markAsUnsaved();
          editor.saveToBackend(true);
        } else {
          editor.persistenceService.markAsSaved(diagram.id);
        }
      },
    });
  }

  /**
   * Procesa el clic sobre un nodo cuando hay una herramienta de relación activa (conexión en dos clics).
   *
   * @param editor Instancia del componente editor.
   * @param nodeId Identificador del nodo clicado.
   * @param event Evento de ratón.
   */
  static executeTableClick(
    editor: DiagramEditorComponent,
    nodeId: string,
    event: MouseEvent,
  ): void {
    editor.connectionOps.handleTableClick(nodeId, event, {
      isReadOnly: editor.isReadOnly(),
      isLocked: editor.isNodeLockedByOther(nodeId),
      activeRel: editor.selectedRelationType(),
      currentSource: editor.selectedSourceNodeId(),
      setSourceNodeId: (id) => editor.selectedSourceNodeId.set(id),
      onMouseMove: (e) => editor.onCanvasMouseMove(e),
      activeDiagramType: editor.activeDiagramType(),
      nodes: editor.nodes(),
      connections: editor.connections(),
      defaultLineStyle: editor.defaultLineStyle(),
      getOptimalConnectorId: (s, t) => editor.getOptimalConnectorId(s, t),
      generateNextSequenceMessage: (src, tgt, isReturn) =>
        editor.connectionOps.generateNextSequenceMessage(src, tgt, isReturn),
      onApplyNewConnection: (newConn, isSeqRel) => {
        editor.pushSnapshot();
        const nextConns = isSeqRel
          ? editor.recalculateSequenceNumbers([...editor.connections(), newConn])
          : [...editor.connections(), newConn];
        editor.connections.set(nextConns);
        editor.selectedSourceNodeId.set(null);
        if (isSeqRel) {
          editor.selectedRelationType.set(null);
        }
        editor.markAsUnsaved();
        editor.sendDiagramSync(editor.nodes(), editor.connections(), 'add_connection');
      },
      onApplyAssociationClass: (assocResult) => {
        editor.pushSnapshot();
        editor.nodes.set(assocResult.nodes);
        editor.connections.set(assocResult.connections);
        editor.updateConnectionEndpoints();
        editor.selectedSourceNodeId.set(null);
        editor.selectedRelationType.set(null);
        editor.markAsUnsaved();
        editor.sendDiagramSync(editor.nodes(), editor.connections(), 'add_association_class');
      },
    });
  }

  /**
   * Procesa la creación de una conexión arrastrando desde un puerto de salida a uno de entrada.
   *
   * @param editor Instancia del componente editor.
   * @param event Evento de creación de conexión de `@foblex/flow`.
   */
  static executeConnectionCreated(
    editor: DiagramEditorComponent,
    event: FCreateConnectionEvent,
  ): void {
    editor.connectionOps.handleConnectionCreated(event, {
      isReadOnly: editor.isReadOnly(),
      selectedRelationType: editor.selectedRelationType(),
      activeDiagramType: editor.activeDiagramType(),
      defaultLineStyle: editor.defaultLineStyle(),
      nodes: editor.nodes(),
      connections: editor.connections(),
      isNodeLockedByOther: (id) => editor.isNodeLockedByOther(id),
      generateNextSequenceMessage: (src, tgt, isReturn) =>
        editor.connectionOps.generateNextSequenceMessage(src, tgt, isReturn),
      onApplyNewConnection: (newConn, isSeqRel) => {
        editor.pushSnapshot();
        const nextConns = isSeqRel
          ? editor.recalculateSequenceNumbers([...editor.connections(), newConn])
          : [...editor.connections(), newConn];
        editor.connections.set(nextConns);
        if (isSeqRel) {
          editor.selectedRelationType.set(null);
        }
        editor.markAsUnsaved();
        editor.sendDiagramSync(editor.nodes(), editor.connections(), 'add_connection');
      },
      onApplyAssocClass: (result) => {
        editor.pushSnapshot();
        editor.nodes.set(result.nodes);
        editor.connections.set(result.connections);
        editor.updateConnectionEndpoints();
        editor.selectedRelationType.set(null);
        editor.markAsUnsaved();
        editor.sendDiagramSync(editor.nodes(), editor.connections(), 'add_association_class');
      },
    });
  }

  /**
   * Devuelve los metadatos del tipo de diagrama activo.
   */
  static getDiagramTypeInfo(type: DiagramType) {
    return UML_DIAGRAM_TYPES.find((d) => d.id === type) || UML_DIAGRAM_TYPES[0];
  }

  /**
   * Determina si un tipo de relación pertenece a diagramas de secuencia.
   */
  static isSequenceRelation(rel: string | null, diagType: DiagramType, predicate: (rel: string, type: DiagramType) => boolean): boolean {
    if (!rel) return false;
    return predicate(rel, diagType);
  }
}
