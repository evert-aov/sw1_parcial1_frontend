import { ChangeDetectionStrategy, Component, input, output, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroArrowsRightLeft, heroTrash, heroPlus, heroChevronUp, heroChevronDown } from '@ng-icons/heroicons/outline';
import { TranslatePipe } from '../../../core/i18n/index';
import {
  UmlConnection,
  UmlRelationTypeItem,
  UmlLineStyleItem,
  UML_RELATION_TYPES,
  UML_USE_CASE_RELATION_TYPES,
  UML_PACKAGE_RELATION_TYPES,
  UML_COMPONENT_RELATION_TYPES,
  UML_COMMUNICATION_RELATION_TYPES,
  UML_DEPLOYMENT_RELATION_TYPES,
  UML_SEQUENCE_RELATION_TYPES,
  ALL_UML_RELATION_TYPES,
  UML_LINE_STYLES,
  UML_MULTIPLICITY_OPTIONS,
  DiagramType,
  UmlMessage,
} from '../../../core/models/diagram.model';

@Component({
  selector: 'app-edit-connection-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
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
      case DiagramType.COMPONENT:
        return UML_COMPONENT_RELATION_TYPES;
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
    '#8B0000', // 2: Guindo / Rojo Carmín Oscuro (como en EA)
    '#15803D', // 3: Verde Bosque (como en EA)
    '#1D4ED8', // 4: Azul Real
    '#7C3AED', // 5: Violeta Púrpura
    '#C2410C', // 6: Naranja Óxido
    '#0E7490', // 7: Cian Océano
    '#BE185D', // 8: Rosa / Magenta
    '#4D7C0F', // 9: Verde Oliva
    '#4338CA', // 10: Índigo Profundo
  ];

  /**
   * Determina si la relación en edición admite multiplicidades en origen y destino.
   */
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

  /**
   * Determina si la conexión pertenece a un diagrama de interacción (secuencia o comunicación).
   */
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

  /**
   * Verifica si la relación se comporta como mensaje en diagrama de secuencia temporal.
   */
  isSequenceDiagram(): boolean {
    const conn = this.editingConnection();
    return (
      this.activeDiagramType() === DiagramType.SEQUENCE ||
      Boolean(conn && ['sync', 'reply', 'async', 'create', 'self'].includes(conn.type as string))
    );
  }

  /**
   * Evalúa si es posible añadir un mensaje adicional a la conexión.
   */
  canAddMessage(): boolean {
    const conn = this.editingConnection();
    if (!conn) return false;
    if (this.isSequenceDiagram()) {
      return !conn.messages || conn.messages.length === 0;
    }
    return true;
  }

  /**
   * Invierte el origen y destino de la conexión, intercambiando multiplicidades y conectores.
   */
  onSwapDirection(): void {
    const conn = this.editingConnection();
    if (!conn) return;
    const tempSource = conn.sourceId;
    conn.sourceId = conn.targetId;
    conn.targetId = tempSource;
    const tempSourceNode = conn.sourceNodeId;
    conn.sourceNodeId = conn.targetNodeId;
    conn.targetNodeId = tempSourceNode;
    const tempMultiplicity = conn.sourceMultiplicity;
    conn.sourceMultiplicity = conn.targetMultiplicity;
    conn.targetMultiplicity = tempMultiplicity;
    this.editingConnection.set({ ...conn });
    this.swapDirection.emit();
  }

  /**
   * Añade un nuevo mensaje de interacción a la relación con número secuencial y color automático.
   */
  addMessage(): void {
    const conn = this.editingConnection();
    if (!conn) return;
    if (!conn.messages) conn.messages = [];
    if (this.isSequenceDiagram() && conn.messages.length >= 1) {
      return;
    }
    const isSeq = this.isSequenceDiagram();
    const nextSeq = isSeq ? `1.${conn.messages.length}` : `${conn.messages.length + 1}`;
    const groupMatch = nextSeq.match(/^(\d+)/);
    const g = groupMatch ? parseInt(groupMatch[1], 10) : conn.messages.length + 1;
    const defaultColor = this.sequenceColorPalette[(Math.max(1, g) - 1) % this.sequenceColorPalette.length];
    const newMsg: UmlMessage = {
      id: `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      sequenceNumber: nextSeq,
      functionName: 'msj',
      parameters: '',
      returnType: '',
      isReturn: isSeq && conn.type === 'reply',
      direction: isSeq && conn.type === 'reply' ? 'reverse' : 'forward',
      orderIndex: 0,
      color: defaultColor,
    };
    conn.messages.push(newMsg);
    this.editingConnection.set({ ...conn });
  }

  /**
   * Elimina un mensaje de la conexión por su índice en la lista.
   * @param index Posición del mensaje.
   */
  removeMessage(index: number): void {
    const conn = this.editingConnection();
    if (!conn || !conn.messages) return;
    conn.messages.splice(index, 1);
    this.editingConnection.set({ ...conn });
  }

  /**
   * Desplaza un mensaje hacia arriba en la secuencia de ejecución.
   * @param index Posición actual del mensaje.
   */
  moveMessageUp(index: number): void {
    const conn = this.editingConnection();
    if (!conn || !conn.messages || index <= 0) return;
    const temp = conn.messages[index];
    conn.messages[index] = conn.messages[index - 1];
    conn.messages[index - 1] = temp;
    this.editingConnection.set({ ...conn });
  }

  /**
   * Desplaza un mensaje hacia abajo en la secuencia de ejecución.
   * @param index Posición actual del mensaje.
   */
  moveMessageDown(index: number): void {
    const conn = this.editingConnection();
    if (!conn || !conn.messages || index >= conn.messages.length - 1) return;
    const temp = conn.messages[index];
    conn.messages[index] = conn.messages[index + 1];
    conn.messages[index + 1] = temp;
    this.editingConnection.set({ ...conn });
  }

  /**
   * Valida, sanea mensajes y emite la conexión actualizada hacia el editor cerrando el modal.
   */
  onSave(): void {
    const conn = this.editingConnection();
    if (!conn) return;
    const isSeq = this.isSequenceDiagram();
    if (isSeq) {
      conn.sourceMultiplicity = '';
      conn.targetMultiplicity = '';
      conn.lineStyle = 'straight';
      if (conn.messages && conn.messages.length > 0) {
        const firstMsg = conn.messages[0];
        firstMsg.orderIndex = 0;
        firstMsg.direction = conn.type === 'reply' || firstMsg.isReturn ? 'reverse' : 'forward';
        firstMsg.type = conn.type === 'reply' ? 'reply' : (firstMsg.type || 'sync');
        firstMsg.isReturn = conn.type === 'reply' || !!firstMsg.isReturn;

        let fn = String(firstMsg.functionName || '').trim();
        let params = String(firstMsg.parameters || '').trim();
        const fnSeqMatch = fn.match(/^(\d+(?:\.\d+)*)\s*[:.\s-]\s*(.*)$/);
        if (fnSeqMatch) {
          fn = fnSeqMatch[2].trim();
        }
        const fnParenMatch = fn.match(/^(.*?)\((.*?)\)$/);
        if (fnParenMatch) {
          fn = fnParenMatch[1].trim();
          if (!params && fnParenMatch[2] !== undefined) {
            params = fnParenMatch[2].trim();
          }
        }
        firstMsg.functionName = fn.replace(/\(\)/g, '').trim();
        firstMsg.parameters = params;

        conn.messages = [firstMsg];
      }
    } else if (conn.messages && conn.messages.length > 0) {
      conn.messages.sort((a, b) => this.compareSequenceNumbers(a.sequenceNumber, b.sequenceNumber));
    }
    this.save.emit(conn);
    this.close.emit();
  }

  /**
   * Compara dos números de secuencia jerárquicos (ej. '1.1' vs '1.2' o '2.0').
   * @param seqA Primer número de secuencia.
   * @param seqB Segundo número de secuencia.
   * @returns Diferencia numérica para ordenamiento.
   */
  compareSequenceNumbers(seqA?: string, seqB?: string): number {
    if (!seqA && !seqB) return 0;
    if (!seqA) return 1;
    if (!seqB) return -1;
    const partsA = seqA.trim().split('.').map((p) => parseInt(p, 10));
    const partsB = seqB.trim().split('.').map((p) => parseInt(p, 10));
    const len = Math.max(partsA.length, partsB.length);
    for (let i = 0; i < len; i++) {
      const valA = isNaN(partsA[i]) ? 0 : partsA[i];
      const valB = isNaN(partsB[i]) ? 0 : partsB[i];
      if (valA !== valB) {
        return valA - valB;
      }
    }
    return (seqA || '').localeCompare(seqB || '');
  }

  /**
   * Emite el evento de eliminación de la conexión y cierra el diálogo modal.
   */
  onDelete(): void {
    const conn = this.editingConnection();
    if (!conn) return;
    this.delete.emit(conn.id);
    this.close.emit();
  }

  /**
   * Cierra el diálogo modal sin persistir modificaciones.
   */
  onClose(): void {
    this.close.emit();
  }
}
