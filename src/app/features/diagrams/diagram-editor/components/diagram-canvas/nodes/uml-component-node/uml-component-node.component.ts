import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroTrash } from '@ng-icons/heroicons/outline';
import { UmlClassNode } from '../../../../../../../core/models/diagram.model';
import { TranslatePipe } from '../../../../../../../core/i18n';
import { AutofocusInputDirective } from '../../../../directives/autofocus-input.directive';
import { UML_SVG_COMPONENTS } from '../../../uml-svg';

@Component({
  selector: 'app-uml-component-node',
  standalone: true,
  imports: [
    CommonModule,
    NgIconComponent,
    AutofocusInputDirective,
    TranslatePipe,
    ...UML_SVG_COMPONENTS,
  ],
  providers: [provideIcons({ heroTrash })],
  templateUrl: './uml-component-node.component.html',
  host: {
    class: 'w-full h-full flex flex-col flex-1 min-h-0 min-w-0',
  },
})
export class UmlComponentNodeComponent {
  @Input({ required: true }) node!: UmlClassNode;
  @Input() isSelected = false;
  @Input() isLocked = false;
  @Input() renamingNodeId: string | null = null;

  @Output() nodeClick = new EventEmitter<MouseEvent>();
  @Output() deleteNode = new EventEmitter<MouseEvent>();
  @Output() commitRename = new EventEmitter<string>();
  @Output() cancelRename = new EventEmitter<void>();

  get isRenaming(): boolean {
    return this.renamingNodeId === this.node?.id;
  }

  get bgColor(): string {
    const c = this.node?.color;
    if (!c || c === '#FFFDDD' || c === '#F8E5E5') return '#FAF1EC';
    return c;
  }

  onContainerClick(event: MouseEvent): void {
    this.nodeClick.emit(event);
  }

  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.deleteNode.emit(event);
  }

  onCommit(val: string): void {
    this.commitRename.emit(val);
  }

  onCancel(): void {
    this.cancelRename.emit();
  }
}
