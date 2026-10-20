import { DiagramDto, DiagramType } from '../../../../../core/models/diagram.model';

const SIDEBAR_WIDTH_KEY = 'uml_sidebar_width';

/**
 * Carga el ancho de la barra lateral almacenado en `localStorage` dentro del rango permitido [220, 750].
 *
 * @returns Ancho válido o `null` si no existe.
 */
export function loadSavedSidebarWidth(): number | null {
  try {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 220 && parsed <= 750) {
        return parsed;
      }
    }
  } catch {
    // Ignorar errores de acceso a localStorage
  }
  return null;
}

/**
 * Persiste el ancho de la barra lateral en `localStorage`.
 *
 * @param width Ancho en píxeles.
 */
export function saveSidebarWidth(width: number): void {
  try {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, width.toString());
  } catch {
    // Ignorar errores de almacenamiento
  }
}

/**
 * Carga el orden personalizado de diagramas para un proyecto desde `localStorage`.
 *
 * @param projectId Identificador del proyecto.
 * @returns Lista ordenada de identificadores de diagrama.
 */
export function loadCustomDiagramOrder(projectId: string): string[] {
  try {
    const raw = localStorage.getItem(`uml_diagram_order_${projectId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Ignorar errores de lectura
  }
  return [];
}

/**
 * Persiste el orden personalizado de diagramas para un proyecto en `localStorage`.
 *
 * @param projectId Identificador del proyecto.
 * @param order Lista ordenada de identificadores de diagrama.
 */
export function saveCustomDiagramOrder(projectId: string | null, order: string[]): void {
  if (!projectId) return;
  try {
    localStorage.setItem(`uml_diagram_order_${projectId}`, JSON.stringify(order));
  } catch {
    // Ignorar errores de almacenamiento
  }
}

/**
 * Ordena una lista de diagramas según el arreglo de orden personalizado.
 *
 * @param list Diagramas a ordenar.
 * @param order Orden global de identificadores.
 * @returns Nueva lista ordenada.
 */
export function sortDiagramsByCustomOrder(list: DiagramDto[], order: string[]): DiagramDto[] {
  if (!order || order.length === 0) return list;
  return [...list].sort((a, b) => {
    const idxA = order.indexOf(a.id);
    const idxB = order.indexOf(b.id);
    const posA = idxA === -1 ? 999999 : idxA;
    const posB = idxB === -1 ? 999999 : idxB;
    return posA - posB;
  });
}

/**
 * Calcula el nuevo orden global tras desplazar un diagrama arriba o abajo dentro de su carpeta.
 *
 * @param currentList Lista actual ordenada del tipo de diagrama.
 * @param currentGlobalOrder Orden global actual.
 * @param diagramId Identificador del diagrama a mover.
 * @param direction Dirección del movimiento (`'up'` | `'down'`).
 * @returns Nuevo orden global o `null` si el movimiento no aplica.
 */
export function computeMovedDiagramOrder(
  currentList: DiagramDto[],
  currentGlobalOrder: string[],
  diagramId: string,
  direction: 'up' | 'down'
): string[] | null {
  const index = currentList.findIndex((d) => d.id === diagramId);
  if (index === -1) return null;
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= currentList.length) return null;

  const reordered = [...currentList];
  const [moved] = reordered.splice(index, 1);
  reordered.splice(targetIndex, 0, moved);

  return mergeTypeOrderIntoGlobal(
    currentList,
    currentGlobalOrder,
    reordered.map((d) => d.id)
  );
}

/**
 * Calcula el nuevo orden global tras soltar un diagrama arrastrado sobre otro en la misma carpeta.
 *
 * @param currentList Lista actual ordenada del tipo de diagrama.
 * @param currentGlobalOrder Orden global actual.
 * @param draggedId Identificador del diagrama arrastrado.
 * @param targetId Identificador del diagrama destino.
 * @param position Posición relativa (`'above'` | `'below'`).
 * @returns Nuevo orden global o `null` si no aplica.
 */
export function computeDroppedDiagramOrder(
  currentList: DiagramDto[],
  currentGlobalOrder: string[],
  draggedId: string | null,
  targetId: string,
  position: 'above' | 'below' | null
): string[] | null {
  if (!draggedId || draggedId === targetId) return null;
  const draggedItem = currentList.find((d) => d.id === draggedId);
  if (!draggedItem) return null;

  const filtered = currentList.filter((d) => d.id !== draggedId);
  const targetIdx = filtered.findIndex((d) => d.id === targetId);
  if (targetIdx === -1) return null;

  const insertIdx = position === 'below' ? targetIdx + 1 : targetIdx;
  filtered.splice(insertIdx, 0, draggedItem);

  return mergeTypeOrderIntoGlobal(
    currentList,
    currentGlobalOrder,
    filtered.map((d) => d.id)
  );
}

function mergeTypeOrderIntoGlobal(
  currentList: DiagramDto[],
  currentGlobalOrder: string[],
  orderedIdsForType: string[]
): string[] {
  const typeDiagIds = new Set(currentList.map((d) => d.id));
  const filteredGlobal = currentGlobalOrder.filter((id) => !typeDiagIds.has(id));
  return [...filteredGlobal, ...orderedIdsForType];
}

/**
 * Configura el `DataTransfer` para arrastrar una herramienta desde el Toolbox hacia el lienzo.
 */
export function setToolboxDragTransfer(
  nodeType: string,
  event: DragEvent,
  stereotype?: string
): void {
  const payload: Record<string, string> = { type: 'toolbox_node', nodeType };
  if (stereotype) payload['stereotype'] = stereotype;
  if (event.dataTransfer) {
    event.dataTransfer.setData('application/json', JSON.stringify(payload));
    event.dataTransfer.setData('text/plain', nodeType);
    event.dataTransfer.effectAllowed = 'copy';
  }
}

/**
 * Configura el `DataTransfer` para arrastrar un nodo desde el Explorador hacia el lienzo.
 */
export function setExplorerNodeDragTransfer(
  diag: DiagramDto,
  node: any,
  isCompatible: boolean,
  event: DragEvent
): void {
  const payload = {
    type: 'explorer_node',
    nodeType: node.nodeType || 'class',
    sourceDiagramId: diag.id,
    sourceDiagramType: diag.type as DiagramType,
    nodeData: node,
    isCompatible,
  };
  if (event.dataTransfer) {
    event.dataTransfer.setData('application/json', JSON.stringify(payload));
    event.dataTransfer.setData('text/plain', node.name || node.nodeType);
    event.dataTransfer.effectAllowed = 'copy';
  }
}
