import { XMLParser } from 'fast-xml-parser';
import { UmlClassNode, UmlConnection, UmlLineStyle, UmlMessage, UmlStereotype } from '../models/diagram.model';
import {
  EaDiagramMeta,
  EaGeometryInfo,
  XmiBehaviorParser,
  XmiClassifierParser,
  XmiConnectorParser,
  XmiDiagramLayoutParser,
  XmiStringUtils,
} from './xmi';

export interface ParsedDiagramResult {
  name: string;
  diagramType?: string;
  nodes: UmlClassNode[];
  connections: UmlConnection[];
  defaultLineStyle: string;
}

/**
 * Fachada principal de parsing XMI/XML para Enterprise Architect y estándares UML 2.1+.
 * Orquesta los submódulos especializados: XmiClassifierParser, XmiConnectorParser,
 * XmiDiagramLayoutParser, XmiBehaviorParser y XmiStringUtils.
 */
export class XmiClientParser {
  private static readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    allowBooleanAttributes: true,
    parseAttributeValue: false,
    trimValues: true,
  });

  // Delegaciones públicas retrocompatibles
  public static fixUtf8Mojibake(str: string): string {
    return XmiStringUtils.fixUtf8Mojibake(str);
  }

  public static parseCommunicationMessages(rawText?: string): UmlMessage[] {
    return XmiBehaviorParser.parseCommunicationMessages(rawText);
  }

  public static getGroupColor(sequenceNumber?: string): string {
    return XmiBehaviorParser.getGroupColor(sequenceNumber);
  }

  public static compareSequenceNumbers(seqA?: string, seqB?: string): number {
    return XmiBehaviorParser.compareSequenceNumbers(seqA, seqB);
  }

  public static mapEaModeToLineStyle(mode: string | number | undefined): UmlLineStyle {
    return XmiDiagramLayoutParser.mapEaModeToLineStyle(mode);
  }

  public static eaColorToHex(val: number): string {
    return XmiStringUtils.eaColorToHex(val);
  }

  /**
   * Procesa el contenido XML/XMI y produce la estructura del diagrama visual UML.
   */
  public static parse(xmlContent: string): ParsedDiagramResult {
    if (!xmlContent || xmlContent.trim().length === 0) {
      throw new Error('El archivo XML/XMI está vacío.');
    }

    xmlContent = XmiStringUtils.fixUtf8Mojibake(xmlContent);

    const parsed = this.parser.parse(xmlContent);
    const xmiRoot = parsed['xmi:XMI'] || parsed['XMI'] || parsed;
    if (!xmiRoot) {
      throw new Error('El archivo no contiene un nodo raíz XMI válido.');
    }

    let diagramName = 'Diagrama Importado';
    const umlModel = xmiRoot['uml:Model'] || xmiRoot['Model'];
    if (umlModel && umlModel['@_name']) {
      diagramName = XmiStringUtils.fixUtf8Mojibake(umlModel['@_name']);
    }

    // 1. Extraer geometrías y estilos de línea desde <xmi:Extension><diagrams><diagram><elements>
    const geometryMap = new Map<string, EaGeometryInfo>();
    const connectorLabelsMap = new Map<string, { name?: string; sMult?: string; tMult?: string }>();
    const connLineStyleMap = new Map<string, UmlLineStyle>();
    const sequenceOrderMap = new Map<string, number>();
    const diagramMeta: EaDiagramMeta = {};

    try {
      XmiDiagramLayoutParser.extractGeometry(
        xmiRoot,
        geometryMap,
        connectorLabelsMap,
        connLineStyleMap,
        diagramMeta,
        sequenceOrderMap,
        XmiBehaviorParser.readSequenceOrder,
      );
    } catch (e) {
      // Ignorar errores de layout y continuar con distribución en grid
    }

    if (diagramMeta.name) {
      diagramName = XmiStringUtils.fixUtf8Mojibake(diagramMeta.name);
    }

    // 2. Extraer metadatos de Enterprise Architect (sType, estereotipos BCE, colores)
    const eaElementMetaMap = XmiDiagramLayoutParser.extractEaElementMeta(xmiRoot);

    // 3. Extraer clasificadores (clases, actores, casos de uso, paquetes, componentes, lifelines, notas)
    const rawElements = XmiClassifierParser.collectPackagedElements(umlModel);
    const nodeMap = XmiClassifierParser.extractClassifiers(rawElements, geometryMap, eaElementMetaMap);

    // 4. Extraer relaciones declaradas en los elementos packagedElements
    const connections: UmlConnection[] = [];
    const connSet = new Set<string>();

    for (const elem of rawElements) {
      const type = elem['@_xmi:type'] || elem['@_type'];

      if (type === 'uml:Association' || type === 'Association') {
        const conn = XmiConnectorParser.parseAssociation(elem, nodeMap, connectorLabelsMap, connLineStyleMap);
        if (conn && !connSet.has(conn.id)) {
          connSet.add(conn.id);
          connections.push(conn);
        }
      }

      if (type === 'uml:Class' || type === 'Class') {
        const genConns = XmiConnectorParser.parseGeneralizations(elem, nodeMap, connLineStyleMap);
        for (const gc of genConns) {
          if (!connSet.has(gc.id)) {
            connSet.add(gc.id);
            connections.push(gc);
          }
        }
      }

      if (type === 'uml:UseCase' || type === 'UseCase') {
        const ucConns = XmiConnectorParser.parseUseCaseRelationships(elem, nodeMap, connLineStyleMap);
        for (const uc of ucConns) {
          if (!connSet.has(uc.id)) {
            connSet.add(uc.id);
            connections.push(uc);
          }
        }
      }

      if (type === 'uml:Dependency' || type === 'Dependency') {
        const depConn = XmiConnectorParser.parseDependency(elem, nodeMap, connectorLabelsMap);
        if (depConn && !connSet.has(depConn.id)) {
          connSet.add(depConn.id);
          connections.push(depConn);
        }
      }

      if (type === 'uml:Package' || type === 'Package') {
        const pkgConns = XmiConnectorParser.parsePackageRelationships(elem, nodeMap);
        for (const pc of pkgConns) {
          if (!connSet.has(pc.id)) {
            connSet.add(pc.id);
            connections.push(pc);
          }
        }
      }

      if (type === 'uml:Connector' || type === 'Connector') {
        const cConn = XmiConnectorParser.parseUmlConnector(elem, nodeMap, connLineStyleMap);
        if (cConn && !connSet.has(cConn.id)) {
          connSet.add(cConn.id);
          connections.push(cConn);
        }
      }

      if (elem['ownedConnector']) {
        const rawOConns = Array.isArray(elem['ownedConnector'])
          ? elem['ownedConnector']
          : [elem['ownedConnector']];
        for (const oc of rawOConns) {
          const cConn = XmiConnectorParser.parseUmlConnector(oc, nodeMap, connLineStyleMap);
          if (cConn && !connSet.has(cConn.id)) {
            connSet.add(cConn.id);
            connections.push(cConn);
          }
        }
      }
    }

    // 5. Conectores enriquecidos de extensión EA (Secuencias cronológicas, colaboraciones y conectores directos)
    const eaConns = XmiConnectorParser.extractEaConnectors(
      xmiRoot,
      nodeMap,
      connLineStyleMap,
      connections,
      sequenceOrderMap,
    );
    for (const ec of eaConns) {
      if (!connSet.has(ec.id)) {
        connSet.add(ec.id);
        connections.push(ec);
      } else {
        const existing = connections.find((c) => c.id === ec.id);
        if (existing) {
          if (ec.messages && ec.messages.length > 0) {
            existing.messages = ec.messages;
          }
          if (!existing.name && ec.name) {
            existing.name = ec.name;
          }
        }
      }
    }

    // 6. Reconstruir Association Classes (nodo ancla y enlace discontinuo de asociación)
    XmiConnectorParser.resolveAssociationClasses(xmiRoot, rawElements, nodeMap, connections, connSet);

    // 7. Determinar tipo de diagrama inferido
    let hasActor = false;
    let hasUseCase = false;
    let hasCommStereo = false;
    let hasAnalysisStereo = false;
    const hasMessages = connections.some(
      (c) => c.messages && c.messages.length > 0,
    );

    for (const node of nodeMap.values()) {
      if (node.nodeType === 'actor') hasActor = true;
      if (node.nodeType === 'use_case') hasUseCase = true;
      const s = (node.stereotype || '').toLowerCase().trim();
      const nt = (node.nodeType || '').toLowerCase().trim();
      if (
        s === 'boundary' ||
        s === 'control' ||
        s === 'entity' ||
        nt === 'boundary' ||
        nt === 'control' ||
        nt === 'entity'
      ) {
        hasCommStereo = true;
      }
      if (s === 'ui' || s === 'controller.' || s === 'entity.') {
        hasAnalysisStereo = true;
      }
    }

    let diagramType = 'class';
    const eaDiagType = (diagramMeta.type || '').toLowerCase();
    const hasSequenceConn = connections.some(
      (c) =>
        c.type === 'sync' ||
        c.type === 'reply' ||
        c.sourceId?.includes('_slot_') ||
        c.targetId?.includes('_slot_'),
    );
    const hasLifeline = Array.from(nodeMap.values()).some(
      (n) => n.nodeType === 'lifeline',
    );
    const hasPackageNode = Array.from(nodeMap.values()).some(
      (n) => n.nodeType === 'package',
    );
    const hasComponentNode = Array.from(nodeMap.values()).some(
      (n) => n.nodeType === 'component',
    );
    const hasAssemblyConn = connections.some(
      (c) => c.type === 'assembly',
    );

    if (eaDiagType.includes('sequence')) {
      diagramType = 'sequence';
    } else if (eaDiagType.includes('collab') || eaDiagType.includes('commun')) {
      diagramType = 'communication';
    } else if (eaDiagType.includes('use case')) {
      diagramType = 'use_case';
    } else if (eaDiagType.includes('component')) {
      diagramType = 'component';
    } else if (eaDiagType.includes('package')) {
      diagramType = 'package';
    } else if (hasSequenceConn || hasLifeline) {
      diagramType = 'sequence';
    } else if (hasComponentNode || hasAssemblyConn) {
      diagramType = 'component';
    } else if (hasPackageNode) {
      diagramType = 'package';
    } else if (hasUseCase) {
      diagramType = 'use_case';
    } else if (
      hasMessages ||
      (hasCommStereo && !hasAnalysisStereo)
    ) {
      diagramType = 'communication';
    } else if (hasAnalysisStereo || hasActor) {
      diagramType = 'class_analysis';
    }

    // 8. Normalizar geometrías y estereotipos según el tipo de diagrama final
    if (diagramType === 'sequence') {
      for (const node of nodeMap.values()) {
        if (node.nodeType !== 'actor') {
          node.nodeType = 'lifeline';
          node.color = geometryMap.get(node.id)?.color || eaElementMetaMap.get(node.id)?.color || '#DDF4F5';
          node.height = 60;
          node.width = Math.max(90, node.width || 110);
        }
      }
    } else if (diagramType === 'communication') {
      for (const node of nodeMap.values()) {
        const s = (node.stereotype || '').toLowerCase().trim();
        const nt = (node.nodeType || '').toLowerCase().trim();
        if (nt === 'boundary' || s === 'boundary' || s === 'ui') {
          node.nodeType = 'boundary';
          node.stereotype = UmlStereotype.BOUNDARY;
          if (node.width && node.width > 120 && node.height && node.height > 100) {
            node.width = 70;
            node.height = 70;
          }
        } else if (nt === 'control' || s === 'control' || s.includes('controller')) {
          node.nodeType = 'control';
          node.stereotype = UmlStereotype.CONTROL;
          if (node.width && node.width > 120 && node.height && node.height > 100) {
            node.width = 70;
            node.height = 70;
          }
        } else if (nt === 'entity' || s === 'entity' || s.includes('entity')) {
          node.nodeType = 'entity';
          node.stereotype = UmlStereotype.ENTITY;
          if (node.width && node.width > 120 && node.height && node.height > 100) {
            node.width = 70;
            node.height = 70;
          }
        }
      }
    } else if (diagramType === 'class_analysis') {
      for (const node of nodeMap.values()) {
        const s = (node.stereotype || '').toLowerCase().trim();
        const nt = (node.nodeType || '').toLowerCase().trim();
        if (nt === 'boundary' || s === 'boundary' || s === 'ui') {
          node.nodeType = 'class';
          node.stereotype = UmlStereotype.UI;
        } else if (nt === 'control' || s === 'control' || s.includes('controller')) {
          node.nodeType = 'class';
          node.stereotype = UmlStereotype.CONTROLLER_DOT;
        } else if (nt === 'entity' || s === 'entity' || s.includes('entity')) {
          node.nodeType = 'class';
          node.stereotype = UmlStereotype.ENTITY_DOT;
        }
      }
    } else if (diagramType === 'package') {
      for (const node of nodeMap.values()) {
        if (!node.nodeType) {
          node.nodeType = 'package';
        }
        if (node.nodeType === 'package') {
          node.width = Math.max(160, node.width || 200);
          node.height = Math.max(80, node.height || 120);
          node.color = node.color || '#FAF1EC';
        }
      }
      for (const [id, node] of Array.from(nodeMap.entries())) {
        if (
          node.nodeType !== 'package' &&
          node.nodeType !== 'use_case' &&
          node.nodeType !== 'actor'
        ) {
          nodeMap.delete(id);
        }
      }
    } else if (diagramType === 'use_case') {
      for (const [id, node] of Array.from(nodeMap.entries())) {
        if (node.nodeType !== 'use_case' && node.nodeType !== 'actor') {
          nodeMap.delete(id);
        }
      }
    } else if (diagramType === 'component') {
      for (const node of nodeMap.values()) {
        if (!node.nodeType) {
          node.nodeType = 'component';
        }
        if (node.nodeType === 'component') {
          node.width = Math.max(160, node.width || 190);
          node.height = Math.max(60, node.height || 70);
          node.color = node.color || '#FAF1EC';
        } else if (node.nodeType === 'boundary_box') {
          node.width = Math.max(200, node.width || 280);
          node.height = Math.max(120, node.height || 200);
          node.color = node.color || '#FAF8F5';
        }
      }
      for (const [id, node] of Array.from(nodeMap.entries())) {
        if (
          node.nodeType !== 'component' &&
          node.nodeType !== 'boundary_box' &&
          node.nodeType !== 'package' &&
          node.nodeType !== 'class'
        ) {
          nodeMap.delete(id);
        }
      }
    }

    // 9. Filtrar conexiones cuyos extremos hayan sido eliminados del lienzo
    const activeNodeIds = new Set(nodeMap.keys());
    const validConnections = connections.filter((c) => {
      const srcNodeId = c.sourceNodeId || (c.sourceId ? c.sourceId.replace(/_(left|right|top|bottom|_slot_\d+)$/, '') : '');
      const tgtNodeId = c.targetNodeId || (c.targetId ? c.targetId.replace(/_(left|right|top|bottom|_slot_\d+)$/, '') : '');
      return activeNodeIds.has(srcNodeId) && activeNodeIds.has(tgtNodeId);
    });

    return {
      name: diagramName,
      diagramType,
      nodes: Array.from(nodeMap.values()),
      connections: validConnections,
      defaultLineStyle: 'segment',
    };
  }
}
