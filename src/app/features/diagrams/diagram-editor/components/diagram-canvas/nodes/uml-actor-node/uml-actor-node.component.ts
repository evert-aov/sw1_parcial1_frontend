import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FFlowModule } from '@foblex/flow';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroTrash } from '@ng-icons/heroicons/outline';
import { UmlClassNode } from '../../../../../../../core/models/diagram.model';
import { TranslatePipe } from '../../../../../../../core/i18n';
import { DiagramFloatingLabelComponent } from '../../../diagram-floating-label/diagram-floating-label.component';
import { UML_SVG_COMPONENTS } from '../../../uml-svg';

@Component({
  selector: 'app-uml-actor-node',
  standalone: true,
  imports: [
    CommonModule,
    FFlowModule,
    NgIconComponent,
    TranslatePipe,
    DiagramFloatingLabelComponent,
    ...UML_SVG_COMPONENTS,
  ],
  providers: [provideIcons({ heroTrash })],
  templateUrl: './uml-actor-node.component.html',
  host: {
    class: 'w-full h-full flex flex-col flex-1 min-h-0 min-w-0',
  },
})
export class UmlActorNodeComponent {
  @Input({ required: true }) node!: UmlClassNode;
  @Input() isSelected = false;
  @Input() isLocked = false;
  @Input() activeDiagramType = '';
  @Input() selectedRelationType: string | null = null;
  @Input() renamingNodeId: string | null = null;
  @Input() isReadOnly = false;
  @Input() lifelineLength = 300;
  @Input() activations: Array<{ id: string; top: number; height: number }> = [];
  @Input() sequenceSlots: number[] = [];
  @Input() isSequenceSlotOccupiedFn: (slot: number) => boolean = () => false;
  @Input() getSlotTopFn: (slot: number) => number = () => 0;

  @Output() nodeClick = new EventEmitter<MouseEvent>();
  @Output() deleteNode = new EventEmitter<MouseEvent>();
  @Output() tableClick = new EventEmitter<MouseEvent>();
  @Output() labelDblClick = new EventEmitter<MouseEvent>();
  @Output() commitRename = new EventEmitter<string>();
  @Output() cancelRename = new EventEmitter<void>();

  onContainerClick(event: MouseEvent): void {
    this.nodeClick.emit(event);
  }

  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.deleteNode.emit(event);
  }

  onLayerClick(event: MouseEvent): void {
    if (this.activeDiagramType !== 'sequence') {
      this.tableClick.emit(event);
    }
  }

  onSlotClick(event: MouseEvent): void {
    this.tableClick.emit(event);
  }
}
