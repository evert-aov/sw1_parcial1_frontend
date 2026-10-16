import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../../../core/i18n';
import { UmlClassNode } from '../../../../../core/models/diagram.model';
import { AutofocusInputDirective } from '../../directives/autofocus-input.directive';

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

  get isRenaming(): boolean {
    return this.renamingNodeId === this.node?.id;
  }

  get isCurrentlyDragging(): boolean {
    return this.isDraggingLabel && this.draggingLabelNodeId === this.node?.id;
  }

  onPointerDown(event: PointerEvent): void {
    this.labelPointerDown.emit(event);
  }

  onDblClick(event: MouseEvent): void {
    this.labelDblClick.emit(event);
  }

  onCommit(val: string): void {
    this.commitRename.emit(val);
  }

  onCancel(): void {
    this.cancelRename.emit();
  }

  onReset(event: MouseEvent): void {
    this.resetOffset.emit(event);
  }
}
