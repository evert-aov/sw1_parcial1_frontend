import { Component, input, output, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroArrowsRightLeft, heroTrash, heroPlus, heroChevronUp, heroChevronDown } from '@ng-icons/heroicons/outline';
import { TranslatePipe } from '../../../../../core/i18n';
import {
  UmlConnection,
  UmlRelationTypeItem,
  UmlLineStyleItem,
  UML_RELATION_TYPES,
  UML_USE_CASE_RELATION_TYPES,
  UML_PACKAGE_RELATION_TYPES,
  UML_COMMUNICATION_RELATION_TYPES,
  UML_DEPLOYMENT_RELATION_TYPES,
  UML_SEQUENCE_RELATION_TYPES,
  ALL_UML_RELATION_TYPES,
  UML_LINE_STYLES,
  UML_MULTIPLICITY_OPTIONS,
  DiagramType,
  UmlMessage,
} from '../../../../../core/models/diagram.model';

@Component({
  selector: 'app-edit-connection-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent, TranslatePipe],
  providers: [
    provideIcons({
      heroArrowsRightLeft,
      heroTrash,
      heroPlus,
      heroChevronUp,
      heroChevronDown,
    }),
  ],
  templateUrl: './edit-connection-modal.component.html',
})
export class EditConnectionModalComponent {
  readonly isOpen = input<boolean>(false);
  readonly connection = input<UmlConnection | null>(null);
  readonly relationTypes = input<UmlRelationTypeItem[] | null>(null);
  readonly lineStyles = input<UmlLineStyleItem[]>(UML_LINE_STYLES);
  readonly multiplicityOptions = input<string[]>(UML_MULTIPLICITY_OPTIONS);
  readonly activeDiagramType = input<DiagramType>(DiagramType.CLASS);

  readonly currentRelationTypes = computed<UmlRelationTypeItem[]>(() => {
    if (this.relationTypes()) {
      return this.relationTypes()!;
    }
    switch (this.activeDiagramType()) {
      case DiagramType.SEQUENCE:
        return UML_SEQUENCE_RELATION_TYPES;
      case DiagramType.COMMUNICATION:
        return UML_COMMUNICATION_RELATION_TYPES;
      case DiagramType.USE_CASE:
        return UML_USE_CASE_RELATION_TYPES;
      case DiagramType.PACKAGE:
      case DiagramType.LAYERED:
        return UML_PACKAGE_RELATION_TYPES;
      case DiagramType.DEPLOYMENT:
        return UML_DEPLOYMENT_RELATION_TYPES;
      case DiagramType.CLASS:
      default:
        return UML_RELATION_TYPES;
    }
  });

  readonly close = output<void>();
  readonly save = output<UmlConnection>();
  readonly delete = output<string>();
  readonly swapDirection = output<void>();

  readonly editingConnection = signal<UmlConnection | null>(null);

  constructor() {
    effect(
      () => {
        const c = this.connection();
        if (c && this.isOpen()) {
          const cloned: UmlConnection = JSON.parse(JSON.stringify(c));
          const isSeq =
            this.activeDiagramType() === DiagramType.SEQUENCE ||
            ['sync', 'reply', 'async', 'create', 'self'].includes(cloned.type as string);
          if (isSeq) {
            cloned.sourceMultiplicity = '';
            cloned.targetMultiplicity = '';
            cloned.lineStyle = 'straight';
            if (!cloned.messages || cloned.messages.length === 0) {
              cloned.messages = [
                {
                  id: `msg_${Date.now()}`,
                  sequenceNumber: '1.0',
                  functionName: 'msj',
                  parameters: '',
                  returnType: '',
                  isReturn: cloned.type === 'reply',
                  direction: 'forward',
                  orderIndex: 0,
                  color: this.sequenceColorPalette[0],
                },
              ];
            }
          }
          this.editingConnection.set(cloned);
        } else if (!this.isOpen()) {
          this.editingConnection.set(null);
        }
      },
      { allowSignalWrites: true }
    );
  }

  readonly sequenceColorPalette: string[] = [
    '#241C18', // 1: Negro Carbón
    '#B91C1C', // 2: Rojo Carmín
    '#1D4ED8', // 3: Azul Real
    '#047857', // 4: Verde Esmeralda
    '#7C3AED', // 5: Violeta Púrpura
    '#C2410C', // 6: Naranja Óxido
    '#0E7490', // 7: Cian Océano
    '#BE185D', // 8: Rosa / Magenta
    '#4D7C0F', // 9: Verde Oliva
    '#4338CA', // 10: Índigo Profundo
    '#9A3412', // 11: Terracota
    '#0F766E', // 12: Teal
  ];

  canHaveMultiplicity(): boolean {
    const conn = this.editingConnection();
    if (!conn) return false;
    if (
      this.activeDiagramType() === DiagramType.SEQUENCE ||
      this.activeDiagramType() === DiagramType.COMMUNICATION ||
      this.activeDiagramType() === DiagramType.USE_CASE ||
      this.activeDiagramType() === DiagramType.PACKAGE
    ) {
      return false;
    }
    const noMultTypes = [
      'generalization', 'realization', 'include', 'extend',
      'import', 'access', 'merge', 'trace',
      'sync', 'reply', 'async', 'create', 'self',
    ];
    return !noMultTypes.includes(conn.type as string);
  }

  isSequenceOrCommunication(): boolean {
    const conn = this.editingConnection();
    if (!conn) return false;
    return (
      this.activeDiagramType() === DiagramType.SEQUENCE ||
      this.activeDiagramType() === DiagramType.COMMUNICATION ||
      Boolean(conn.messages && conn.messages.length > 0) ||
      ['sync', 'reply', 'async', 'create', 'self'].includes(conn.type as string)
    );
  }

  onSwapDirection(): void {
    const conn = this.editingConnection();
    if (!conn) return;
    const tempSource = conn.sourceId;
    conn.sourceId = conn.targetId;
    conn.targetId = tempSource;
    const tempMultiplicity = conn.sourceMultiplicity;
    conn.sourceMultiplicity = conn.targetMultiplicity;
    conn.targetMultiplicity = tempMultiplicity;
    this.editingConnection.set({ ...conn });
    this.swapDirection.emit();
  }

  addMessage(): void {
    const conn = this.editingConnection();
    if (!conn) return;
    if (!conn.messages) conn.messages = [];
    const isSeq =
      this.activeDiagramType() === DiagramType.SEQUENCE ||
      ['sync', 'reply', 'async', 'create', 'self'].includes(conn.type as string);
    const nextSeq = isSeq ? `1.${conn.messages.length}` : `${conn.messages.length + 1}`;
    const defaultColor = this.sequenceColorPalette[conn.messages.length % this.sequenceColorPalette.length];
    const newMsg: UmlMessage = {
      id: `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      sequenceNumber: nextSeq,
      functionName: 'msj',
      parameters: '',
      returnType: '',
      isReturn: isSeq && conn.type === 'reply',
      direction: 'forward',
      orderIndex: conn.messages.length,
      color: defaultColor,
    };
    conn.messages.push(newMsg);
    this.editingConnection.set({ ...conn });
  }

  removeMessage(index: number): void {
    const conn = this.editingConnection();
    if (!conn || !conn.messages) return;
    conn.messages.splice(index, 1);
    this.editingConnection.set({ ...conn });
  }

  moveMessageUp(index: number): void {
    const conn = this.editingConnection();
    if (!conn || !conn.messages || index <= 0) return;
    const temp = conn.messages[index];
    conn.messages[index] = conn.messages[index - 1];
    conn.messages[index - 1] = temp;
    this.editingConnection.set({ ...conn });
  }

  moveMessageDown(index: number): void {
    const conn = this.editingConnection();
    if (!conn || !conn.messages || index >= conn.messages.length - 1) return;
    const temp = conn.messages[index];
    conn.messages[index] = conn.messages[index + 1];
    conn.messages[index + 1] = temp;
    this.editingConnection.set({ ...conn });
  }

  onSave(): void {
    const conn = this.editingConnection();
    if (!conn) return;
    const isSeq =
      this.activeDiagramType() === DiagramType.SEQUENCE ||
      ['sync', 'reply', 'async', 'create', 'self'].includes(conn.type as string);
    if (isSeq) {
      conn.sourceMultiplicity = '';
      conn.targetMultiplicity = '';
      conn.lineStyle = 'straight';
    }
    this.save.emit(conn);
    this.close.emit();
  }

  onDelete(): void {
    const conn = this.editingConnection();
    if (!conn) return;
    this.delete.emit(conn.id);
    this.close.emit();
  }

  onClose(): void {
    this.close.emit();
  }
}
