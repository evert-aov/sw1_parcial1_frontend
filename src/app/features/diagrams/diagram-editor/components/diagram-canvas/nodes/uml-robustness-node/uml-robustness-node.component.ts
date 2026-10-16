import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroTrash } from '@ng-icons/heroicons/outline';
import { UmlClassNode } from '../../../../../../../core/models/diagram.model';
import { TranslatePipe } from '../../../../../../../core/i18n';
import { DiagramFloatingLabelComponent } from '../../../diagram-floating-label/diagram-floating-label.component';
import { UML_SVG_COMPONENTS } from '../../../uml-svg';

@Component({
  selector: 'app-uml-robustness-node',
  standalone: true,
  imports: [
    CommonModule,
    NgIconComponent,
    TranslatePipe,
    DiagramFloatingLabelComponent,
    ...UML_SVG_COMPONENTS,
  ],
  providers: [provideIcons({ heroTrash })],
  templateUrl: './uml-robustness-node.component.html',
  host: {
    class: 'w-full h-full flex flex-col flex-1 min-h-0 min-w-0',
  },
})
export class UmlRobustnessNodeComponent {
  @Input({ required: true }) node!: UmlClassNode;
  @Input() isSelected = false;
  @Input() isLocked = false;
  @Input() renamingNodeId: string | null = null;
  @Input() isDraggingLabel = false;
  @Input() draggingLabelNodeId: string | null = null;
  @Input() isReadOnly = false;
  @Input() labelTransform = '';
  @Input() hasLabelOffset = false;

  @Output() nodeClick = new EventEmitter<MouseEvent>();
  @Output() deleteNode = new EventEmitter<MouseEvent>();
  @Output() labelPointerDown = new EventEmitter<PointerEvent>();
  @Output() labelDblClick = new EventEmitter<MouseEvent>();
  @Output() commitRename = new EventEmitter<string>();
  @Output() cancelRename = new EventEmitter<void>();
  @Output() resetOffset = new EventEmitter<MouseEvent>();

  get accentColor(): 'cyan' | 'teal' | 'emerald' {
    if (this.node?.nodeType === 'boundary') return 'cyan';
    if (this.node?.nodeType === 'control') return 'teal';
    return 'emerald';
  }

  get ringClass(): string {
    if (!this.isSelected) return 'hover:bg-slate-100/40';
    if (this.node?.nodeType === 'boundary') return 'ring-2 ring-cyan-600 shadow-[0_0_12px_rgba(8,145,178,0.35)]';
    if (this.node?.nodeType === 'control') return 'ring-2 ring-teal-600 shadow-[0_0_12px_rgba(13,148,136,0.35)]';
    return 'ring-2 ring-emerald-600 shadow-[0_0_12px_rgba(5,150,105,0.35)]';
  }

  get deleteTitle(): string {
    if (this.node?.nodeType === 'boundary') return 'editor.canvas.nodes.deleteBoundary';
    if (this.node?.nodeType === 'control') return 'editor.canvas.nodes.deleteControl';
    return 'editor.canvas.nodes.deleteEntity';
  }

  onContainerClick(event: MouseEvent): void {
    this.nodeClick.emit(event);
  }

  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.deleteNode.emit(event);
  }
}
