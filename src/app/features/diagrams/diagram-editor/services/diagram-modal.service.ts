import { Injectable, signal, computed, inject } from '@angular/core';
import {
  DiagramType,
  UmlClassNode,
  UmlConnection,
} from '../../../../core/models/diagram.model';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';

@Injectable({
  providedIn: 'root',
})
export class DiagramModalService {
  private readonly confirmDialogService?: ConfirmDialogService | null;

  constructor(confirmDialogService?: ConfirmDialogService) {
    if (confirmDialogService !== undefined) {
      this.confirmDialogService = confirmDialogService;
    } else {
      try {
        this.confirmDialogService = inject(ConfirmDialogService, { optional: true });
      } catch {
        this.confirmDialogService = null;
      }
    }
  }

  getIncompatibleElementMessageKey(diagType: DiagramType): string {
    const keyMap: Partial<Record<DiagramType, string>> = {
      [DiagramType.USE_CASE]: 'editor.incompatible.useCase',
      [DiagramType.PACKAGE]: 'editor.incompatible.package',
      [DiagramType.COMMUNICATION]: 'editor.incompatible.communication',
      [DiagramType.SEQUENCE]: 'editor.incompatible.sequence',
      [DiagramType.CLASS]: 'editor.incompatible.class',
      [DiagramType.CLASS_ANALYSIS]: 'editor.incompatible.classAnalysis',
      [DiagramType.COMPONENT]: 'editor.incompatible.component',
      [DiagramType.DEPLOYMENT]: 'editor.incompatible.deployment',
      [DiagramType.LAYERED]: 'editor.incompatible.layered',
    };
    return keyMap[diagType] || 'editor.incompatible.class';
  }

  showIncompatibleElementModal(diagType: DiagramType, customDialog?: any): void {
    const dialog = customDialog || this.confirmDialogService;
    dialog?.alert({
      title: 'editor.incompatible.title',
      message: this.getIncompatibleElementMessageKey(diagType),
      type: 'warning',
      confirmText: 'common.confirmModal.understood',
    });
  }

  // Modales de edición de elementos
  readonly isEditNodeModalOpen = signal<boolean>(false);
  readonly isEditConnModalOpen = signal<boolean>(false);
  readonly editingNode = signal<UmlClassNode | null>(null);
  readonly editingConnection = signal<UmlConnection | null>(null);

  // Modal JSON
  readonly showJsonModal = signal<boolean>(false);
  readonly jsonContent = signal<string>('');
  readonly jsonModalMode = signal<'import' | 'export'>('export');

  // Modal Perfil y Spring Boot
  readonly isProfileModalOpen = signal<boolean>(false);
  readonly showSpringBootModal = signal<boolean>(false);

  // Modal Crear Diagrama por Tipo
  readonly isCreateDiagramModalOpen = signal<boolean>(false);
  readonly lockedDiagramType = signal<DiagramType | null>(null);

  // Menú desplegable de exportación
  readonly isExportDropdownOpen = signal<boolean>(false);

  // Señal computada para saber si hay algún modal abierto
  readonly isAnyModalOpen = computed(
    () =>
      this.isEditNodeModalOpen() ||
      this.isEditConnModalOpen() ||
      this.showJsonModal() ||
      this.isProfileModalOpen() ||
      this.showSpringBootModal() ||
      this.isCreateDiagramModalOpen()
  );

  openEditNodeModal(node: UmlClassNode): void {
    this.editingNode.set(JSON.parse(JSON.stringify(node)));
    this.isEditNodeModalOpen.set(true);
  }

  closeEditNodeModal(onReleaseLock?: (nodeId: string) => void): void {
    const current = this.editingNode();
    if (current && onReleaseLock) {
      onReleaseLock(current.id);
    }
    this.isEditNodeModalOpen.set(false);
    this.editingNode.set(null);
  }

  openEditConnModal(conn: UmlConnection): void {
    this.editingConnection.set(JSON.parse(JSON.stringify(conn)));
    this.isEditConnModalOpen.set(true);
  }

  closeEditConnModal(): void {
    this.isEditConnModalOpen.set(false);
    this.editingConnection.set(null);
  }

  openExportModal(jsonStr: string): void {
    this.jsonContent.set(jsonStr);
    this.jsonModalMode.set('export');
    this.showJsonModal.set(true);
  }

  openImportModal(): void {
    this.jsonContent.set('');
    this.jsonModalMode.set('import');
    this.showJsonModal.set(true);
  }

  closeJsonModal(): void {
    this.showJsonModal.set(false);
  }

  openCreateDiagramModal(lockedType: DiagramType | null = null): void {
    this.lockedDiagramType.set(lockedType);
    this.isCreateDiagramModalOpen.set(true);
  }

  closeCreateDiagramModal(): void {
    this.isCreateDiagramModalOpen.set(false);
    this.lockedDiagramType.set(null);
  }

  openSpringBootModal(): void {
    this.showSpringBootModal.set(true);
  }

  closeSpringBootModal(): void {
    this.showSpringBootModal.set(false);
  }

  openProfileModal(): void {
    this.isProfileModalOpen.set(true);
  }

  closeProfileModal(): void {
    this.isProfileModalOpen.set(false);
  }

  closeAllModals(onReleaseNodeLock?: (nodeId: string) => void): void {
    this.closeEditNodeModal(onReleaseNodeLock);
    this.closeEditConnModal();
    this.showJsonModal.set(false);
    this.showSpringBootModal.set(false);
    this.isProfileModalOpen.set(false);
    this.isCreateDiagramModalOpen.set(false);
    this.isExportDropdownOpen.set(false);
  }
}
