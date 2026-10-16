import { Injectable, signal } from '@angular/core';
import { Subject, Subscription, debounceTime } from 'rxjs';
import {
  UmlClassNode,
  UmlConnection,
  UmlLineStyle,
} from '../../../../core/models/diagram.model';

export interface UmlDiagramDraft {
  diagramId: string;
  nodes: UmlClassNode[];
  connections: UmlConnection[];
  defaultLineStyle: UmlLineStyle;
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class DiagramPersistenceService {
  readonly hasUnsavedChanges = signal<boolean>(false);
  readonly saveSuccessMessage = signal<boolean>(false);

  readonly autoSave$ = new Subject<void>();
  readonly nodeDragEnd$ = new Subject<void>();

  private successTimer: any = null;

  saveLocalDraft(
    diagramId: string,
    data: {
      nodes: UmlClassNode[];
      connections: UmlConnection[];
      defaultLineStyle: UmlLineStyle;
    },
  ): void {
    if (!diagramId) return;
    try {
      const draft: UmlDiagramDraft = {
        diagramId,
        nodes: data.nodes,
        connections: data.connections,
        defaultLineStyle: data.defaultLineStyle,
        timestamp: Date.now(),
      };
      localStorage.setItem(`uml_draft_${diagramId}`, JSON.stringify(draft));
    } catch (_) {}
  }

  clearLocalDraft(diagramId: string): void {
    if (!diagramId) return;
    try {
      localStorage.removeItem(`uml_draft_${diagramId}`);
    } catch (_) {}
  }

  getLocalDraft(diagramId: string): UmlDiagramDraft | null {
    if (!diagramId) return null;
    try {
      const raw = localStorage.getItem(`uml_draft_${diagramId}`);
      if (raw) {
        return JSON.parse(raw) as UmlDiagramDraft;
      }
    } catch (_) {}
    return null;
  }

  markAsUnsaved(
    isReadOnly: boolean,
    diagramId: string | null,
    draftData: {
      nodes: UmlClassNode[];
      connections: UmlConnection[];
      defaultLineStyle: UmlLineStyle;
    },
  ): void {
    if (isReadOnly) return;
    this.hasUnsavedChanges.set(true);
    if (diagramId) {
      this.saveLocalDraft(diagramId, draftData);
    }
    this.autoSave$.next();
  }

  markAsSaved(diagramId?: string | null): void {
    this.hasUnsavedChanges.set(false);
    if (diagramId) {
      this.clearLocalDraft(diagramId);
    }
  }

  notifySaveSuccess(durationMs = 2500): void {
    if (this.successTimer) {
      clearTimeout(this.successTimer);
    }
    this.saveSuccessMessage.set(true);
    this.successTimer = setTimeout(() => {
      this.saveSuccessMessage.set(false);
      this.successTimer = null;
    }, durationMs);
  }

  setupAutoSave(onAutoSave: () => void, debounceMs = 1000): Subscription {
    return this.autoSave$.pipe(debounceTime(debounceMs)).subscribe(onAutoSave);
  }

  setupNodeDragEnd(onDragEnd: () => void, debounceMs = 600): Subscription {
    return this.nodeDragEnd$.pipe(debounceTime(debounceMs)).subscribe(onDragEnd);
  }

  triggerAutoSave(): void {
    this.autoSave$.next();
  }

  triggerNodeDragEnd(): void {
    this.nodeDragEnd$.next();
  }
}
