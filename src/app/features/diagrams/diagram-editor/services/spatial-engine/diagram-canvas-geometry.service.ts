import { Injectable, inject } from '@angular/core';
import {
  DiagramType,
  UmlClassNode,
  UmlConnection,
  UmlMessage,
  UmlRelationshipType,
} from '../../../../../core/models/diagram.model';
import { DiagramAssemblyConnectionService } from './diagram-assembly-connection.service';
import {
  DeploymentColors,
} from '../../components/diagram-canvas/nodes/uml-deployment-node/uml-deployment-node.component';
import {
  getActorBottomExtra,
  getSequenceMessageColor,
  isDeploymentNode as isDeploymentNodeLogic,
  isSequenceConnection as isSequenceConnectionLogic,
} from '../../components/diagram-canvas/nodes';
import {
  UmlMarkerConfig,
  getUmlMarkerConfig,
} from '../../components/uml-svg/connection-marker-svg.component';
import { getNodeHeight, getNodeWidth } from '../../utils/node-metrics.util';
import { ConnectionCascadeUtil } from '../../utils/connection-cascade.util';

/**
 * Servicio de geometría, estilos visuales y metadatos de presentación para nodos y conexiones en el lienzo UML.
 * Desacopla el cálculo de marcadores SVG, colores de mensajes, agrupación jerárquica de secuencia y z-index.
 */
export const DEPLOYMENT_NODE_DEPTH = 14;

@Injectable({
  providedIn: 'root',
})
export class DiagramCanvasGeometryService {
  private readonly assemblyConnectionService = inject(DiagramAssemblyConnectionService);

  /**
   * Obtiene la configuración geométrica del marcador SVG para un tipo de relación UML 2.5.
   *
   * @param relationType Tipo de relación UML.
   * @param isStartDiamond Indica si el rombo de agregación/composición debe ubicarse al inicio.
   * @returns Configuración de dimensiones, viewBox y posición para `fMarker`.
   */
  getMarkerConfig(
    relationType: UmlRelationshipType | string | null | undefined,
    isStartDiamond = false,
  ): UmlMarkerConfig {
    return getUmlMarkerConfig(relationType, isStartDiamond);
  }

  /**
   * Determina si el rombo de agregación o composición se posiciona en el extremo origen.
   *
   * @param conn Conexión UML a evaluar.
   * @returns `true` cuando el rombo debe renderizarse al inicio según la multiplicidad.
   */
  isDiamondAtStart(conn: UmlConnection): boolean {
    return ConnectionCascadeUtil.isDiamondAtStart(conn);
  }

  /**
   * Determina si una conexión pertenece a la semántica de diagrama de secuencia.
   *
   * @param conn Conexión UML a evaluar.
   * @param activeDiagramType Tipo de diagrama activo.
   * @returns `true` si la conexión es secuencial.
   */
  isSequenceConnection(conn: UmlConnection, activeDiagramType: DiagramType): boolean {
    return isSequenceConnectionLogic(conn, activeDiagramType);
  }

  /**
   * Determina si una conexión conecta un nodo consigo mismo (recursiva / self-message).
   *
   * @param conn Conexión UML a evaluar.
   * @returns `true` si origen y destino corresponden al mismo nodo base.
   */
  isRecursiveConn(conn: UmlConnection): boolean {
    const s = conn.sourceNodeId || conn.sourceId?.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
    const t = conn.targetNodeId || conn.targetId?.replace(/_(top|bottom|left|right|slot_\d+)$/, '');
    return !!s && s === t;
  }

  /**
   * Determina si la conexión debe usar comportamiento flotante (conecta a la caja general del nodo)
   * o fijo (conecta a un puerto cardinal específico como _top, _right, etc.).
   */
  isFloatingConn(conn: UmlConnection): boolean {
    if (!conn) return false;
    const isSourcePort = /_(top|right|bottom|left|slot_\d+)$/.test(conn.sourceId || '');
    const isTargetPort = /_(top|right|bottom|left|slot_\d+)$/.test(conn.targetId || '');
    return !isSourcePort && !isTargetPort && !this.isRecursiveConn(conn);
  }

  /**
   * Extrae el lado de conexión (`top`, `right`, `bottom`, `left`) desde el ID de conector.
   *
   * @param connectorId Identificador del conector.
   * @param defaultSide Lado por defecto si no se especifica sufijo.
   * @returns Lado cardinal del conector.
   */
  getConnSide(
    connectorId: string | undefined,
    defaultSide: 'top' | 'right' | 'bottom' | 'left' = 'right',
  ): 'top' | 'right' | 'bottom' | 'left' {
    return this.assemblyConnectionService.getConnSide(connectorId, defaultSide);
  }

  /**
   * Calcula el ángulo de rotación en grados para el conector de ensamble (Ball & Socket).
   *
   * @param conn Conexión de tipo `assembly`.
   * @param nodes Lista de nodos del diagrama.
   * @param boardElement Elemento contenedor del tablero para resolver posiciones DOM.
   * @returns Ángulo en grados para orientar el símbolo Ball & Socket.
   */
  getAssemblyAngle(
    conn: UmlConnection,
    nodes: UmlClassNode[],
    boardElement?: HTMLElement | null,
  ): number {
    return this.assemblyConnectionService.getAssemblyAngle(
      conn,
      nodes,
      boardElement,
      (n) => getNodeWidth(n),
      (n) => getNodeHeight(n),
    );
  }

  /**
   * Determina si una conexión debe mostrar etiquetas de multiplicidad en sus extremos.
   *
   * @param conn Conexión UML a evaluar.
   * @param activeDiagramType Tipo de diagrama activo.
   * @returns `true` si la conexión admite multiplicidades visibles.
   */
  shouldShowMultiplicity(conn: UmlConnection, activeDiagramType: DiagramType): boolean {
    if (this.isSequenceConnection(conn, activeDiagramType)) return false;
    return ![
      'generalization',
      'realization',
      'dependency',
      'include',
      'extend',
      'import',
      'access',
      'merge',
      'trace',
      'assembly',
    ].includes(conn.type || '');
  }

  /**
   * Obtiene el color temático de grupo para una conexión de secuencia.
   *
   * @param conn Conexión de secuencia.
   * @returns Color hexadecimal asignado al mensaje o grupo de secuencia.
   */
  getSequenceConnColor(conn: UmlConnection): string {
    const msg = conn.messages?.[0];
    if (msg?.color) return msg.color;
    return getSequenceMessageColor(msg?.sequenceNumber || conn.name);
  }

  /**
   * Calcula la transformación CSS vertical durante el arrastre interactivo de un mensaje de secuencia.
   *
   * @param conn Conexión de secuencia.
   * @param isDragging Indica si hay un arrastre de mensaje en curso.
   * @param draggingConnId ID de la conexión que se está arrastrando.
   * @param deltaY Desplazamiento vertical acumulado en píxeles.
   * @returns Cadena CSS `translateY(...)` o cadena vacía.
   */
  getSequenceMessageTransform(
    conn: UmlConnection,
    isDragging: boolean,
    draggingConnId: string | null,
    deltaY: number,
  ): string {
    if (isDragging && draggingConnId === conn.id && deltaY !== 0) {
      return `translateY(${deltaY}px)`;
    }
    return '';
  }

  /**
   * Determina si una conexión de secuencia es iniciadora de un grupo jerárquico (ej. `1`, `2`).
   *
   * @param conn Conexión de secuencia.
   * @returns `true` si su número de secuencia es un entero raíz.
   */
  isGroupInitiator(conn: UmlConnection): boolean {
    const seq = conn.messages?.[0]?.sequenceNumber?.trim() || '';
    return /^\d+$/.test(seq);
  }

  /**
   * Cuenta cuántos mensajes pertenecen al grupo jerárquico iniciado por la conexión dada.
   *
   * @param conn Conexión iniciadora del grupo.
   * @param connections Lista total de conexiones del diagrama.
   * @returns Cantidad total de mensajes en el grupo jerárquico.
   */
  getGroupMemberCount(conn: UmlConnection, connections: UmlConnection[]): number {
    const seq = conn.messages?.[0]?.sequenceNumber?.trim() || '';
    if (!/^\d+$/.test(seq)) return 1;
    const prefix = `${seq}.`;
    return connections.filter((c) => {
      const s = c.messages?.[0]?.sequenceNumber?.trim() || '';
      return c.id === conn.id || s === seq || s.startsWith(prefix);
    }).length;
  }

  /**
   * Comprueba si una conexión de comunicación tiene mensajes en dirección `forward`.
   *
   * @param conn Conexión UML a evaluar.
   * @returns `true` si existen mensajes hacia adelante.
   */
  hasForwardMessages(conn: UmlConnection): boolean {
    return this.getForwardMessages(conn).length > 0;
  }

  /**
   * Filtra y retorna los mensajes en dirección `forward` de una conexión de comunicación.
   *
   * @param conn Conexión UML.
   * @returns Lista de mensajes con dirección `forward`.
   */
  getForwardMessages(conn: UmlConnection): UmlMessage[] {
    if (!conn.messages || conn.messages.length === 0) return [];
    return conn.messages.filter((m) => (m.direction || 'forward') !== 'reverse');
  }

  /**
   * Comprueba si una conexión de comunicación tiene mensajes en dirección `reverse`.
   *
   * @param conn Conexión UML a evaluar.
   * @returns `true` si existen mensajes en reversa.
   */
  hasReverseMessages(conn: UmlConnection): boolean {
    return this.getReverseMessages(conn).length > 0;
  }

  /**
   * Filtra y retorna los mensajes en dirección `reverse` de una conexión de comunicación.
   *
   * @param conn Conexión UML.
   * @returns Lista de mensajes con dirección `reverse`.
   */
  getReverseMessages(conn: UmlConnection): UmlMessage[] {
    if (!conn.messages || conn.messages.length === 0) return [];
    return conn.messages.filter((m) => m.direction === 'reverse');
  }

  /**
   * Obtiene el color visual de un mensaje en diagramas de comunicación.
   *
   * @param msg Mensaje UML.
   * @returns Color hexadecimal para renderizar el mensaje.
   */
  getCommMessageColor(msg: UmlMessage): string {
    if (msg.color) return msg.color;
    return getSequenceMessageColor(msg.sequenceNumber);
  }

  /**
   * Calcula las dimensiones `{ width, height }` de un nodo para el enlace `[fNodeSize]`.
   *
   * @param node Nodo UML.
   * @returns Objeto con ancho y alto en píxeles.
   */
  getNodeSize(node: UmlClassNode): { width: number; height: number } {
    if (node.isAnchor) return { width: 0, height: 0 };
    return {
      width: getNodeWidth(node),
      height: getNodeHeight(node),
    };
  }

  /**
   * Calcula el `z-index` jerárquico de un nodo para que los contenedores queden detrás de sus hijos.
   * Jerarquía de capas (de más al fondo a más al frente):
   * 1. Boundary Box (z: 1-2)
   * 2. Package / Subsystem (z: 3-4)
   * 3. Dispositivos físicos («device») (z: 5-7)
   * 4. Entornos de ejecución («executionEnvironment» / «node») (z: 10-12)
   * 5. Componentes de software («component») (z: 15-18)
   * 6. Clases, artefactos y otros nodos contenidos (z: 20-25)
   * 7. Nodos ancla y controles flotantes (z: 45)
   *
   * @param node Nodo UML.
   * @param isSelected Indica si el nodo está seleccionado.
   * @returns Valor numérico de `z-index`.
   */
  getNodeZIndex(node: UmlClassNode, isSelected: boolean): number {
    if (node.isAnchor) return 45;

    // 1. Boundary Box: el más al fondo en diagramas de despliegue, componentes y casos de uso
    if (node.nodeType === 'boundary_box') {
      return isSelected ? 2 : 1;
    }

    // 2. Package / Subsistema contenedor
    if (node.nodeType === 'package') {
      return isSelected ? 4 : 3;
    }

    // 3. Dispositivos físicos («device»): servidores de hardware, nodos físicos de infraestructura
    const isDevice = node.nodeType === 'device' || node.stereotype === 'device';
    if (isDevice) {
      return isSelected ? 7 : 5;
    }

    // 4. Entornos de ejecución («executionEnvironment» / «node»): servidores de aplicación, Docker, VM, OS
    const isExecutionEnv =
      node.nodeType === 'executionEnvironment' ||
      node.nodeType === 'execution-environment' ||
      node.nodeType === 'node' ||
      node.stereotype === 'executionEnvironment' ||
      node.stereotype === 'execution-environment' ||
      node.stereotype === 'node';
    if (isExecutionEnv) {
      return isSelected ? 12 : 10;
    }

    // 5. Componentes de software («component»): módulos, subsistemas lógicos, artefactos
    const isComponent = node.nodeType === 'component' || node.stereotype === 'component';
    if (isComponent) {
      return isSelected ? 18 : 15;
    }

    // 6. Clases, actores, casos de uso, interfaces y otros nodos contenidos
    return isSelected ? 25 : 20;
  }

  /**
   * Calcula el offset inferior en píxeles del conector inferior de un nodo (ej. actores/BCE con etiqueta debajo).
   *
   * @param node Nodo UML.
   * @returns Desplazamiento `bottom` en píxeles.
   */
  getBottomConnectorOffset(node: UmlClassNode): number {
    if (node.nodeType === 'actor') {
      return -6 - getActorBottomExtra(node);
    }
    if (node.nodeType === 'boundary' || node.nodeType === 'control' || node.nodeType === 'entity') {
      return -20;
    }
    return -6;
  }

  /**
   * Determina si un nodo corresponde a un elemento de despliegue 3D.
   *
   * @param node Nodo UML.
   * @returns `true` si es dispositivo, entorno de ejecución o nodo físico.
   */
  isDeploymentNode(node: UmlClassNode): boolean {
    return isDeploymentNodeLogic(node.nodeType) || ['device', 'executionEnvironment', 'node'].includes(node.stereotype || '');
  }

  /**
   * Obtiene el alto total de un nodo de despliegue 3D.
   *
   * @param node Nodo UML.
   * @returns Alto en píxeles.
   */
  getDeploymentHeight(node: UmlClassNode): number {
    return node.customHeight || node.height || getNodeHeight(node) || 120;
  }

  /**
   * Obtiene el ancho frontal de la caja isométrica 3D de un nodo de despliegue.
   *
   * @param node Nodo UML.
   * @returns Ancho frontal en píxeles.
   */
  getDeploymentFrontWidth(node: UmlClassNode): number {
    return Math.max(100, getNodeWidth(node) - DEPLOYMENT_NODE_DEPTH);
  }

  /**
   * Obtiene el alto frontal de la caja isométrica 3D de un nodo de despliegue.
   *
   * @param node Nodo UML.
   * @returns Alto frontal en píxeles.
   */
  getDeploymentFrontHeight(node: UmlClassNode): number {
    return Math.max(70, this.getDeploymentHeight(node) - DEPLOYMENT_NODE_DEPTH);
  }

  /**
   * Obtiene la paleta cromática para las caras superior, lateral y frontal de un nodo de despliegue 3D.
   *
   * @param node Nodo UML.
   * @returns Paleta de colores 3D.
   */
  getDeploymentColors(node: UmlClassNode): DeploymentColors {
    if (node.nodeType === 'executionEnvironment' || node.stereotype === 'executionEnvironment') {
      return {
        top: '#E0F2FE',
        right: '#BAE6FD',
        front: node.color || '#F0F9FF',
        border: '#0284C7',
      };
    }
    return {
      top: '#EFE2D3',
      right: '#DFCBB7',
      front: node.color || '#FDFAF3',
      border: '#796354',
    };
  }

  /**
   * Obtiene el texto de la pestaña superior de un paquete UML.
   *
   * @param node Nodo de paquete.
   * @returns Título de la pestaña.
   */
  getPackageTabTitle(node: UmlClassNode): string {
    if (node.stereotype) return `«${node.stereotype}»`;
    return node.name || 'Package';
  }

  /**
   * Obtiene el texto principal del cuerpo de un paquete UML.
   *
   * @param node Nodo de paquete.
   * @returns Nombre del paquete.
   */
  getPackageBodyText(node: UmlClassNode): string {
    return node.name || 'Package';
  }

  /**
   * Construye la transformación CSS `translate(x, y)` para una etiqueta libre de nodo.
   *
   * @param node Nodo UML.
   * @returns Cadena CSS `translate(...)` o cadena vacía.
   */
  getLabelTransform(node: UmlClassNode): string {
    return '';
  }

  /**
   * Determina si un nodo tiene desplazamiento personalizado en su etiqueta.
   *
   * @param node Nodo UML.
   * @returns `true` si `labelOffset` es distinto de `(0, 0)`.
   */
  hasLabelOffset(node: UmlClassNode): boolean {
    return false;
  }

  /**
   * Obtiene la clave de traducción i18n para el mensaje de estado vacío del lienzo.
   *
   * @param type Tipo de diagrama activo.
   * @returns Clave de traducción.
   */
  getEmptyStateMessageKey(type: DiagramType): string {
    switch (type) {
      case DiagramType.USE_CASE:
        return 'editor.canvas.emptyState.useCase';
      case DiagramType.SEQUENCE:
        return 'editor.canvas.emptyState.sequence';
      case DiagramType.COMMUNICATION:
        return 'editor.canvas.emptyState.communication';
      case DiagramType.PACKAGE:
        return 'editor.canvas.emptyState.package';
      case DiagramType.COMPONENT:
        return 'editor.canvas.emptyState.component';
      case DiagramType.DEPLOYMENT:
        return 'editor.canvas.emptyState.deployment';
      default:
        return 'editor.canvas.emptyState.class';
    }
  }
}
