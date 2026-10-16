import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroTrash } from '@ng-icons/heroicons/outline';
import { UmlClassNode } from '../../../../../../../core/models/diagram.model';
import { TranslatePipe } from '../../../../../../../core/i18n';
import { AutofocusInputDirective } from '../../../../directives/autofocus-input.directive';

@Component({
  selector: 'app-uml-package-node',
  standalone: true,
  imports: [CommonModule, NgIconComponent, AutofocusInputDirective, TranslatePipe],
  providers: [provideIcons({ heroTrash })],
  templateUrl: './uml-package-node.component.html',
  host: {
    class: 'w-full h-full flex flex-col flex-1 min-h-0 min-w-0',
  },
})
export class UmlPackageNodeComponent {
  @Input({ required: true }) node!: UmlClassNode;
  @Input() isSelected = false;
  @Input() isLocked = false;
  @Input() renamingNodeId: string | null = null;
  @Input() packageTabTitle = '';
  @Input() packageBodyText = '';

  @Output() nodeClick = new EventEmitter<MouseEvent>();
  @Output() deleteNode = new EventEmitter<MouseEvent>();
  @Output() commitRename = new EventEmitter<string>();
  @Output() cancelRename = new EventEmitter<void>();

  get isRenaming(): boolean {
    return this.renamingNodeId === this.node?.id;
  }

  get isBoundaryBox(): boolean {
    return (
      this.node?.nodeType === 'boundary_box' ||
      this.node?.stereotype === 'boundary' ||
      this.node?.stereotype === 'boundary_box'
    );
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
