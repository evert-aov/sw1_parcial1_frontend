import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../core/i18n/index';
import { UmlClassNode } from '../../../core/models/diagram.model';
import { AutofocusInputDirective } from '../autofocus-input.directive';

@Component({
  standalone: true,
  selector: 'app-diagram-floating-label',
  imports: [CommonModule, AutofocusInputDirective, TranslatePipe],
  templateUrl: './diagram-floating-label.component.html',
})
export class DiagramFloatingLabelComponent {
  @Input({ required: true }) node!: UmlClassNode;
  @Input() renamingNodeId: string | null = null;
  @Input() isDraggingLabel = false;
  @Input() draggingLabelNodeId: string | null = null;
  @Input() isReadOnly = false;
  @Input() isLocked = false;
  @Input() fallbackName = '';
  @Input() transform = '';
  @Input() hasOffset = false;
  @Input() accentColor: 'blue' | 'cyan' | 'teal' | 'emerald' | 'amber' = 'blue';

  @Output() labelPointerDown = new EventEmitter<PointerEvent>();
  @Output() labelDblClick = new EventEmitter<MouseEvent>();
  @Output() commitRename = new EventEmitter<string>();
  @Output() cancelRename = new EventEmitter<void>();
  @Output() resetOffset = new EventEmitter<MouseEvent>();

  /** Comprueba si el nodo asociado a esta etiqueta está en modo de renombrado en línea. */
  get isRenaming(): boolean {
    return this.renamingNodeId === this.node?.id;
  }

  /** Determina si esta etiqueta se está arrastrando interactivamente en este momento. */
  get isCurrentlyDragging(): boolean {
    return this.isDraggingLabel && this.draggingLabelNodeId === this.node?.id;
  }

  /**
   * Emite el inicio del arrastre de la etiqueta.
   * @param event Evento PointerEvent capturado.
   */
  onPointerDown(event: PointerEvent): void {
    this.labelPointerDown.emit(event);
  }

  /**
   * Emite el doble clic para iniciar la edición en línea del nombre.
   * @param event Evento MouseEvent.
   */
  onDblClick(event: MouseEvent): void {
    this.labelDblClick.emit(event);
  }

  /**
   * Confirma el nuevo nombre editado en el input.
   * @param val Nombre definitivo ingresado.
   */
  onCommit(val: string): void {
    this.commitRename.emit(val);
  }

  /**
   * Cancela la edición en línea del nombre.
   */
  onCancel(): void {
    this.cancelRename.emit();
  }

  /**
   * Restablece la posición de la etiqueta al punto inicial por defecto.
   * @param event Evento MouseEvent.
   */
  onReset(event: MouseEvent): void {
    this.resetOffset.emit(event);
  }
}
