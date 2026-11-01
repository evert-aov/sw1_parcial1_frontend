import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TranslationService } from '../../core/i18n/index';
import {
  ChatScope,
  ProactiveSuggestion,
  SuggestionFinding,
} from '../../core/plugins/contracts/ai-assistant.service.contract';
import { AiAssistantService } from './ai-assistant.service';

interface RawNodeSnapshot {
  id?: string;
  name?: string;
  nodeType?: string;
  stereotype?: string | null;
  isAnchor?: boolean;
  assocMainConnId?: string;
  attributes?: { name?: string; type?: string; unique?: boolean; nullable?: boolean }[];
  methods?: { name?: string; returnType?: string }[];
}

interface RawConnSnapshot {
  id?: string;
  type?: string;
  name?: string;
  lineStyle?: string;
  sourceId?: string;
  targetId?: string;
  sourceNodeId?: string;
  targetNodeId?: string;
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
  assocAnchorNodeId?: string;
  messages?: unknown[];
}

const DEBOUNCE_MS = 15_000;
const COOLDOWN_MS = 75_000;

/**
 * Motor híbrido de sugerencias autónomas de Kanon: detecta oportunidades estructurales UML en local
 * (ignorando posiciones, tamaños y notas flotantes) y consulta un resumen breve sin ensuciar el chat.
 */
@Injectable()
export class KanonSuggestionService implements OnDestroy {
  private readonly api = inject(AiAssistantService);
  private readonly i18n = inject(TranslationService);

  readonly activeSuggestion = signal<ProactiveSuggestion | null>(null);
  readonly muted = signal(false);

  private currentDiagramId: string | null = null;
  private debounceTimer?: ReturnType<typeof setTimeout>;
  private lastSuggestionAt = 0;
  private generation = 0;
  private readonly seenHashesByDiagram = new Map<string, Set<string>>();
  private baselineRecordedFor = new Set<string>();

  /** Observa cambios del grafo activo aplicando debounce y exclusión estricta de notas flotantes. */
  observeSnapshot(
    diagramId: string | null,
    diagramType: string,
    rawNodes: readonly unknown[],
    rawConnections: readonly unknown[],
  ): void {
    if (diagramId !== this.currentDiagramId) {
      clearTimeout(this.debounceTimer);
      this.currentDiagramId = diagramId;
      this.activeSuggestion.set(null);
    }
    if (!diagramId || this.muted()) return;

    const nodes = (rawNodes as RawNodeSnapshot[]).filter(
      (n) => !!n?.id && !n.isAnchor && (n.nodeType || '').toLowerCase().trim() !== 'note',
    );
    const validIds = new Set(nodes.map((n) => n.id!));
    const connections = (rawConnections as RawConnSnapshot[]).filter((c) => {
      const src = this.resolveNodeId(c.sourceNodeId, c.sourceId);
      const tgt = this.resolveNodeId(c.targetNodeId, c.targetId);
      return validIds.has(src) && validIds.has(tgt);
    });

    const hash = this.computeSemanticHash(diagramType, nodes, connections);
    let seen = this.seenHashesByDiagram.get(diagramId);
    if (!seen) {
      seen = new Set<string>();
      this.seenHashesByDiagram.set(diagramId, seen);
    }

    // Registra la foto inicial al abrir un diagrama para sugerir solo tras actividad real de modelado
    if (!this.baselineRecordedFor.has(diagramId)) {
      this.baselineRecordedFor.add(diagramId);
      seen.add(hash);
      return;
    }

    if (nodes.length < 2 || seen.has(hash)) return;

    clearTimeout(this.debounceTimer);
    const scheduledGen = ++this.generation;
    this.debounceTimer = setTimeout(() => {
      void this.evaluate(diagramId, diagramType, nodes, connections, rawConnections as RawConnSnapshot[], hash, scheduledGen);
    }, DEBOUNCE_MS);
  }

  /** Descarta la tarjeta flotante actual sin abrir el panel de conversación. */
  dismiss(): void {
    this.activeSuggestion.set(null);
  }

  /** Silencia o reactiva los avisos autónomos durante la sesión de trabajo. */
  setMuted(value: boolean): void {
    this.muted.set(value);
    if (value) {
      clearTimeout(this.debounceTimer);
      this.activeSuggestion.set(null);
    }
  }

  /** Siembra la sugerencia aceptada en el chat personal o grupal del usuario y limpia la notificación. */
  async acceptCurrentSuggestion(scope: ChatScope = 'personal'): Promise<string | null> {
    const suggestion = this.activeSuggestion();
    if (!suggestion) return null;
    this.activeSuggestion.set(null);
    const lang = this.i18n.currentLang() === 'en' ? 'en' : 'es';
    try {
      await firstValueFrom(
        this.api.acceptSuggestion(suggestion.diagramId, {
          clientSuggestionId: suggestion.id,
          title: suggestion.title,
          summary: suggestion.summary,
          language: lang,
          scope,
        }),
      );
    } catch {
      // Aun si falla la red puntual, abrimos el panel para no bloquear al usuario
    }
    return suggestion.diagramId;
  }

  ngOnDestroy(): void {
    this.generation++;
    clearTimeout(this.debounceTimer);
  }

  private async evaluate(
    diagramId: string,
    diagramType: string,
    nodes: RawNodeSnapshot[],
    connections: RawConnSnapshot[],
    rawConnections: RawConnSnapshot[],
    hash: string,
    scheduledGen: number,
  ): Promise<void> {
    if (
      scheduledGen !== this.generation ||
      this.muted() ||
      this.currentDiagramId !== diagramId ||
      Date.now() - this.lastSuggestionAt < COOLDOWN_MS
    ) {
      return;
    }

    const findings = this.detectUmlFindings(diagramType, nodes, connections, rawConnections);
    this.seenHashesByDiagram.get(diagramId)?.add(hash);
    if (!findings.length) return;

    const lang = this.i18n.currentLang() === 'en' ? 'en' : 'es';
    try {
      const response = await firstValueFrom(
        this.api.suggest(diagramId, {
          clientSuggestionId: crypto.randomUUID(),
          diagramType,
          provider: 'ollama',
          language: lang,
          findings: findings.slice(0, 3).map((f) => ({
            ...f,
            code: f.ruleId,
          })),
        }),
      );
      if (scheduledGen !== this.generation || this.muted() || this.currentDiagramId !== diagramId) {
        return;
      }
      if (response?.suggestion) {
        this.lastSuggestionAt = Date.now();
        this.activeSuggestion.set(response.suggestion);
      }
    } catch {
      // Silencioso por diseño: las sugerencias proactivas nunca interrumpen el trabajo con errores
    }
  }

  /** Reglas heurísticas locales UML 2.5 rápidas previas a la redacción de Kanon. */
  detectUmlFindings(
    diagramType: string,
    nodes: RawNodeSnapshot[],
    connections: RawConnSnapshot[],
    rawConnections: RawConnSnapshot[] = connections,
  ): SuggestionFinding[] {
    const findings: SuggestionFinding[] = [];
    const dt = (diagramType || 'class').toLowerCase().trim();
    const isEn = this.i18n.currentLang() === 'en';
    const nodeById = new Map(nodes.map((n) => [n.id!, n]));

    // Índices para detectar clases de asociación y elementos puente ya modelados
    const assocMainConnIds = new Set<string>();
    nodes.forEach((n) => {
      if (n.assocMainConnId) {
        assocMainConnIds.add(n.assocMainConnId);
      }
    });

    const assocAnchorIds = new Set<string>();
    const classesLinkedViaDashed = new Set<string>();
    rawConnections.forEach((c) => {
      const s = this.resolveNodeId(c.sourceNodeId, c.sourceId);
      const t = this.resolveNodeId(c.targetNodeId, c.targetId);
      const isAssocStyle =
        c.type === 'association_class' ||
        c.name === '«link»' ||
        (c.lineStyle === 'dashed' && !c.messages?.length);
      if (isAssocStyle) {
        if (s) {
          assocAnchorIds.add(s);
          if (nodeById.has(s)) classesLinkedViaDashed.add(s);
        }
        if (t) {
          assocAnchorIds.add(t);
          if (nodeById.has(t)) classesLinkedViaDashed.add(t);
        }
      }
    });

    // 1. Relación muchos-a-muchos (* a *) sin clase intermedia / tabla puente
    if (dt === 'class' || dt === 'class_analysis') {
      for (const conn of connections) {
        const sm = (conn.sourceMultiplicity || '').trim();
        const tm = (conn.targetMultiplicity || '').trim();
        const manySource = sm.includes('*') || sm.toLowerCase().includes('n');
        const manyTarget = tm.includes('*') || tm.toLowerCase().includes('n');

        if (manySource && manyTarget) {
          // Si la conexión ya es o posee una clase asociación (ancla, nodo vinculado o tipo association_class), no sugerir puente
          const hasAssocAnchor = Boolean(
            conn.assocAnchorNodeId &&
              (assocAnchorIds.has(conn.assocAnchorNodeId) || conn.assocAnchorNodeId.trim().length > 0),
          );
          const hasAssocNode = Boolean(conn.id && assocMainConnIds.has(conn.id));
          const isAssocClass = conn.type === 'association_class';

          if (isAssocClass || hasAssocAnchor || hasAssocNode) {
            continue;
          }

          const srcId = this.resolveNodeId(conn.sourceNodeId, conn.sourceId);
          const tgtId = this.resolveNodeId(conn.targetNodeId, conn.targetId);
          const sNameLower = (nodeById.get(srcId)?.name || 'A').toLowerCase();
          const tNameLower = (nodeById.get(tgtId)?.name || 'B').toLowerCase();

          // Verificar si ya existe una entidad intermedia (tabla puente / clase asociación libre / ancla) entre src y tgt
          const hasBridgeEntity = nodes.some((bridge) => {
            if (!bridge.id || bridge.id === srcId || bridge.id === tgtId) return false;
            if (bridge.assocMainConnId && bridge.assocMainConnId === conn.id) return true;

            // Clase asociada vinculada por línea discontinua o ancla
            if (classesLinkedViaDashed.has(bridge.id)) {
              const bName = (bridge.name || '').toLowerCase();
              if (
                bName.includes(sNameLower) ||
                bName.includes(tNameLower) ||
                bName.includes('detalle') ||
                bName.includes('item') ||
                bName.includes('linea')
              ) {
                return true;
              }
              const hasFkToBoth = (bridge.attributes || []).some((a) => {
                const an = (a.name || '').toLowerCase();
                return an.includes(sNameLower) || an.includes(tNameLower);
              });
              if (hasFkToBoth) return true;
            }

            const connectsToSrc = connections.some((c) => {
              const s = this.resolveNodeId(c.sourceNodeId, c.sourceId);
              const t = this.resolveNodeId(c.targetNodeId, c.targetId);
              return (s === srcId && t === bridge.id) || (s === bridge.id && t === srcId);
            });
            const connectsToTgt = connections.some((c) => {
              const s = this.resolveNodeId(c.sourceNodeId, c.sourceId);
              const t = this.resolveNodeId(c.targetNodeId, c.targetId);
              return (s === tgtId && t === bridge.id) || (s === bridge.id && t === tgtId);
            });
            return connectsToSrc && connectsToTgt;
          });

          if (hasBridgeEntity) {
            continue;
          }

          const srcName = nodeById.get(srcId)?.name || 'A';
          const tgtName = nodeById.get(tgtId)?.name || 'B';
          findings.push({
            code: 'many_to_many_without_bridge',
            ruleId: 'many_to_many_without_bridge',
            severity: 'warning',
            title: isEn
              ? `Many-to-many relation between ${srcName} and ${tgtName}`
              : `Relación N:M directa entre ${srcName} y ${tgtName}`,
            detail: isEn
              ? `Consider an association class or intermediate entity to store attributes of the ${srcName}–${tgtName} link.`
              : `Conviene modelar una clase asociación o entidad intermedia para normalizar el vínculo entre ${srcName} y ${tgtName}.`,
            elementIds: [srcId, tgtId],
          });
          break;
        }
      }

      // 2. Clases sin atributos definidos en diagrama de clases
      const emptyClasses = nodes.filter(
        (n) => (!n.nodeType || n.nodeType === 'class') && (!n.attributes || n.attributes.length === 0),
      );
      if (emptyClasses.length >= 2) {
        const names = emptyClasses
          .slice(0, 3)
          .map((n) => n.name || 'Clase')
          .join(', ');
        findings.push({
          code: 'classes_without_attributes',
          ruleId: 'classes_without_attributes',
          severity: 'info',
          title: isEn ? `Classes without domain attributes` : `Clases sin atributos de dominio`,
          detail: isEn
            ? `Classes (${names}) do not declare attributes yet, which limits JPA/SQL and Flutter generation.`
            : `Las clases (${names}) aún no declaran atributos, lo que limitará las entidades JPA/SQL y pantallas Flutter.`,
          elementIds: emptyClasses.slice(0, 3).map((n) => n.id!),
        });
      }
    }

    // 3. Regla BCE en comunicación / análisis de clases: Actor o Boundary directo a Entity
    if (dt === 'communication' || dt === 'class_analysis') {
      for (const conn of connections) {
        const src = nodeById.get(this.resolveNodeId(conn.sourceNodeId, conn.sourceId));
        const tgt = nodeById.get(this.resolveNodeId(conn.targetNodeId, conn.targetId));
        const sType = (src?.nodeType || src?.stereotype || '').toLowerCase();
        const tType = (tgt?.nodeType || tgt?.stereotype || '').toLowerCase();
        if (
          ((sType.includes('actor') || sType.includes('boundary') || sType === 'ui') &&
            tType.includes('entity')) ||
          (sType.includes('entity') && (tType.includes('actor') || tType.includes('boundary') || tType === 'ui'))
        ) {
          findings.push({
            code: 'bce_direct_entity_coupling',
            ruleId: 'bce_direct_entity_coupling',
            severity: 'warning',
            title: isEn ? `Direct coupling to Entity` : `Acoplamiento directo hacia Entidad`,
            detail: isEn
              ? `${src?.name || 'Source'} connects directly to ${tgt?.name || 'Target'} without a Control mediator.`
              : `${src?.name || 'Origen'} se comunica directo con ${tgt?.name || 'Destino'} sin mediar un Controlador.`,
            elementIds: [src?.id || '', tgt?.id || ''].filter(Boolean),
          });
          break;
        }
      }
    }

    // 4. Elementos aislados cuando el diagrama ya tiene estructura (>= 3 elementos y >= 1 relación)
    if (nodes.length >= 3 && (connections.length >= 1 || rawConnections.length >= 1)) {
      const connectedIds = new Set<string>();
      connections.forEach((c) => {
        connectedIds.add(this.resolveNodeId(c.sourceNodeId, c.sourceId));
        connectedIds.add(this.resolveNodeId(c.targetNodeId, c.targetId));
      });
      rawConnections.forEach((c) => {
        const s = this.resolveNodeId(c.sourceNodeId, c.sourceId);
        const t = this.resolveNodeId(c.targetNodeId, c.targetId);
        if (s) connectedIds.add(s);
        if (t) connectedIds.add(t);
      });
      nodes.forEach((n) => {
        if (n.id && n.assocMainConnId) {
          connectedIds.add(n.id);
        }
      });
      const isolated = nodes.filter(
        (n) => !connectedIds.has(n.id!) && n.nodeType !== 'boundary_box' && n.nodeType !== 'package',
      );
      if (isolated.length >= 1) {
        const first = isolated[0];
        findings.push({
          code: 'isolated_element',
          ruleId: 'isolated_element',
          severity: 'info',
          title: isEn
            ? `Isolated element: ${first.name || first.id}`
            : `Elemento sin relaciones: ${first.name || first.id}`,
          detail: isEn
            ? `"${first.name || first.id}" has no relationships with the rest of the diagram.`
            : `«${first.name || first.id}» permanece aislado sin relaciones con el resto del modelo.`,
          elementIds: [first.id!],
        });
      }
    }

    return findings;
  }

  private computeSemanticHash(
    diagramType: string,
    nodes: RawNodeSnapshot[],
    connections: RawConnSnapshot[],
  ): string {
    const normalizedNodes = [...nodes]
      .sort((a, b) => (a.id || '').localeCompare(b.id || ''))
      .map((n) => ({
        id: n.id,
        name: (n.name || '').trim(),
        type: n.nodeType || 'class',
        st: n.stereotype || '',
        attrs: (n.attributes || []).map((a) => `${a.name}:${a.type}`),
        methods: (n.methods || []).map((m) => `${m.name}:${m.returnType}`),
        assoc: n.assocMainConnId || '',
      }));
    const normalizedConns = [...connections]
      .sort((a, b) => (a.id || '').localeCompare(b.id || ''))
      .map((c) => ({
        s: this.resolveNodeId(c.sourceNodeId, c.sourceId),
        t: this.resolveNodeId(c.targetNodeId, c.targetId),
        type: c.type || 'association',
        sm: c.sourceMultiplicity || '',
        tm: c.targetMultiplicity || '',
        anchor: c.assocAnchorNodeId || '',
      }));
    return JSON.stringify({ dt: diagramType, n: normalizedNodes, c: normalizedConns });
  }

  private resolveNodeId(explicitId?: string, handleId?: string): string {
    if (explicitId) return explicitId;
    if (!handleId) return '';
    return handleId.replace(/_(top|right|bottom|left)(_(start|end))?$/, '');
  }
}
