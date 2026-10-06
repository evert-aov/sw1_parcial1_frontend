import { XMLParser } from 'fast-xml-parser';
import { UmlClassNode, UmlConnection, UmlLineStyle, UmlStereotype } from '../models/diagram.model';

export interface ParsedDiagramResult {
  name: string;
  diagramType?: string;
  nodes: UmlClassNode[];
  connections: UmlConnection[];
  defaultLineStyle: string;
}

export class XmiClientParser {
  private static parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    allowBooleanAttributes: true,
    parseAttributeValue: false,
    trimValues: true,
  });

  public static parse(xmlContent: string): ParsedDiagramResult {
    if (!xmlContent || xmlContent.trim().length === 0) {
      throw new Error('El archivo XML/XMI está vacío.');
    }

    const parsed = this.parser.parse(xmlContent);
    const xmiRoot = parsed['xmi:XMI'] || parsed['XMI'] || parsed;
    if (!xmiRoot) {
      throw new Error('El archivo no contiene un nodo raíz XMI válido.');
    }

    let diagramName = 'Diagrama Importado';
    const umlModel = xmiRoot['uml:Model'] || xmiRoot['Model'];
    if (umlModel && umlModel['@_name']) {
      diagramName = umlModel['@_name'];
    }

    // 1. Extraer geometrías y estilos de línea desde <xmi:Extension><diagrams><diagram><elements>
    const geometryMap = new Map<string, { left: number; top: number; width: number; height: number; color?: string }>();
    const connectorLabelsMap = new Map<string, { name?: string; sMult?: string; tMult?: string }>();
    const connLineStyleMap = new Map<string, UmlLineStyle>();

    try {
      this.extractGeometry(xmiRoot, geometryMap, connectorLabelsMap, connLineStyleMap);
    } catch (e) {
      // Ignorar errores de layout y continuar con grid
    }

    // 2. Extraer metadatos de Enterprise Architect (sType, estereotipos BCE)
    const eaElementMetaMap = this.extractEaElementMeta(xmiRoot);

    // 3. Extraer clases, actores y elementos
    const rawElements = this.collectPackagedElements(umlModel);
    const nodeMap = new Map<string, UmlClassNode>();
    let gridIdx = 0;

    for (const elem of rawElements) {
      const type = elem['@_xmi:type'] || elem['@_type'];
      const id = elem['@_xmi:id'] || elem['@_id'];
      const name = elem['@_name'];

      if (!id) continue;

      // A) Actores UML
      if (type === 'uml:Actor' || type === 'Actor') {
        let pos = { x: 80 + (gridIdx % 3) * 280, y: 80 + Math.floor(gridIdx / 3) * 220 };
        let width = 65;
        let height = 95;

        if (geometryMap.has(id)) {
          const g = geometryMap.get(id)!;
          pos = { x: g.left, y: g.top };
          if (g.width > 20) width = g.width;
          if (g.height > 20) height = g.height;
        }

        const customActorColor = geometryMap.get(id)?.color || eaElementMetaMap.get(id)?.color;
        const node: UmlClassNode = {
          id,
          name: (name || `Actor_${gridIdx + 1}`).trim(),
          position: pos,
          width,
          height,
          nodeType: 'actor',
          stereotype: null,
          color: customActorColor || '#FEF2DD',
          attributes: [],
          methods: [],
          isAnchor: false,
        };

        nodeMap.set(id, node);
        gridIdx++;
        continue;
      }

      // B) Clases UML y Clases Estereotipadas (BCE / Robustez)
      if (type === 'uml:Class' || type === 'uml:AssociationClass' || type === 'Class') {
        const meta = eaElementMetaMap.get(id);

        if (meta?.sType === 'Actor') {
          let pos = { x: 80 + (gridIdx % 3) * 280, y: 80 + Math.floor(gridIdx / 3) * 220 };
          let width = 65;
          let height = 95;

          if (geometryMap.has(id)) {
            const g = geometryMap.get(id)!;
            pos = { x: g.left, y: g.top };
            if (g.width > 20) width = g.width;
            if (g.height > 20) height = g.height;
          }

          const customActorMetaColor = geometryMap.get(id)?.color || meta?.color;
          const node: UmlClassNode = {
            id,
            name: (name || meta?.name || `Actor_${gridIdx + 1}`).trim(),
            position: pos,
            width,
            height,
            nodeType: 'actor',
            stereotype: null,
            color: customActorMetaColor || '#FEF2DD',
            attributes: [],
            methods: [],
            isAnchor: false,
          };

          nodeMap.set(id, node);
          gridIdx++;
          continue;
        }

        let nodeType: any = 'class';
        let stereotype: string | null = null;
        const s = (meta?.stereotype || '').toLowerCase().trim();

        if (s === 'entity.') {
          nodeType = 'class';
          stereotype = UmlStereotype.ENTITY_DOT;
        } else if (s === 'controller.') {
          nodeType = 'class';
          stereotype = UmlStereotype.CONTROLLER_DOT;
        } else if (s === 'ui') {
          nodeType = 'class';
          stereotype = UmlStereotype.UI;
        } else if (s === 'boundary') {
          nodeType = 'boundary';
          stereotype = UmlStereotype.BOUNDARY;
        } else if (s === 'control' || s === 'controller') {
          nodeType = 'control';
          stereotype = UmlStereotype.CONTROL;
        } else if (s === 'entity') {
          nodeType = 'entity';
          stereotype = UmlStereotype.ENTITY;
        } else if (meta?.stereotype) {
          const match = Object.values(UmlStereotype).find(
            (v) => (v as string).toLowerCase() === s,
          );
          stereotype = match || meta.stereotype;
        }

        const attributes = this.extractAttributes(elem);
        const methods = this.extractMethods(elem);

        let pos = { x: 80 + (gridIdx % 3) * 280, y: 80 + Math.floor(gridIdx / 3) * 220 };
        let width = 220;
        let height = 120;

        if (geometryMap.has(id)) {
          const g = geometryMap.get(id)!;
          pos = { x: g.left, y: g.top };
          if (g.width > 40) width = g.width;
          if (g.height > 30) height = g.height;
        }

        const customClassColor = geometryMap.get(id)?.color || meta?.color;
        const defaultClassColor = (nodeType === 'boundary' || nodeType === 'control' || nodeType === 'entity') ? '#DDF4F5' : '#FDFAF3';
        const node: UmlClassNode = {
          id,
          name: (name || meta?.name || `Clase_${gridIdx + 1}`).trim(),
          position: pos,
          width,
          height,
          nodeType,
          stereotype,
          color: customClassColor || defaultClassColor,
          attributes,
          methods,
          isAnchor: false,
        };

        nodeMap.set(id, node);
        gridIdx++;
      }
    }

    // C) Elementos declarados en extensión EA no presentes en packagedElements
    for (const [eId, meta] of eaElementMetaMap.entries()) {
      if (!nodeMap.has(eId) && (meta.sType === 'Actor' || meta.sType === 'Class')) {
        const isActor = meta.sType === 'Actor';
        let pos = { x: 80 + (gridIdx % 3) * 280, y: 80 + Math.floor(gridIdx / 3) * 220 };
        let width = isActor ? 65 : 220;
        let height = isActor ? 95 : 120;

        if (geometryMap.has(eId)) {
          const g = geometryMap.get(eId)!;
          pos = { x: g.left, y: g.top };
          if (g.width > 20) width = g.width;
          if (g.height > 20) height = g.height;
        }

        let nodeType: any = isActor ? 'actor' : 'class';
        let stereotype: string | null = null;
        const s = (meta.stereotype || '').toLowerCase().trim();

        if (s === 'entity.') {
          nodeType = 'class';
          stereotype = UmlStereotype.ENTITY_DOT;
        } else if (s === 'controller.') {
          nodeType = 'class';
          stereotype = UmlStereotype.CONTROLLER_DOT;
        } else if (s === 'ui') {
          nodeType = 'class';
          stereotype = UmlStereotype.UI;
        } else if (s === 'boundary') {
          nodeType = 'boundary';
          stereotype = UmlStereotype.BOUNDARY;
        } else if (s === 'control' || s === 'controller') {
          nodeType = 'control';
          stereotype = UmlStereotype.CONTROL;
        } else if (s === 'entity') {
          nodeType = 'entity';
          stereotype = UmlStereotype.ENTITY;
        } else if (meta.stereotype) {
          const match = Object.values(UmlStereotype).find(
            (v) => (v as string).toLowerCase() === s,
          );
          stereotype = match || meta.stereotype;
        }

        const customExtColor = geometryMap.get(eId)?.color || meta?.color;
        const defaultExtColor = isActor ? '#FEF2DD' : ((nodeType === 'boundary' || nodeType === 'control' || nodeType === 'entity') ? '#DDF4F5' : '#FDFAF3');
        nodeMap.set(eId, {
          id: eId,
          name: (meta.name || (isActor ? `Actor_${gridIdx + 1}` : `Clase_${gridIdx + 1}`)).trim(),
          position: pos,
          width,
          height,
          nodeType,
          stereotype,
          color: customExtColor || defaultExtColor,
          attributes: [],
          methods: [],
          isAnchor: false,
        });
        gridIdx++;
      }
    }

    // 4. Extraer relaciones
    const connections: UmlConnection[] = [];
    const connSet = new Set<string>();

    for (const elem of rawElements) {
      const type = elem['@_xmi:type'] || elem['@_type'];
      const id = elem['@_xmi:id'] || elem['@_id'];

      if (type === 'uml:Association' || type === 'Association') {
        const conn = this.parseAssociation(elem, nodeMap, connectorLabelsMap, connLineStyleMap);
        if (conn && !connSet.has(conn.id)) {
          connSet.add(conn.id);
          connections.push(conn);
        }
      }

      if (type === 'uml:Class' || type === 'Class') {
        const genConns = this.parseGeneralizations(elem, nodeMap, connLineStyleMap);
        for (const gc of genConns) {
          if (!connSet.has(gc.id)) {
            connSet.add(gc.id);
            connections.push(gc);
          }
        }
      }
    }

    // 5. Conectores de extensión EA
    const eaConns = this.extractEaConnectors(xmiRoot, nodeMap, connLineStyleMap);
    for (const ec of eaConns) {
      if (!connSet.has(ec.id)) {
        connSet.add(ec.id);
        connections.push(ec);
      }
    }

    // 6. Reconstruir tablas intermedias / Association Classes (ancla y enlace discontinuo)
    this.resolveAssociationClasses(xmiRoot, rawElements, nodeMap, connections, connSet);

    // Determinar tipo de diagrama inferido
    let hasActor = false;
    let hasBce = false;
    for (const node of nodeMap.values()) {
      if (node.nodeType === 'actor') hasActor = true;
      if (node.nodeType === 'boundary' || node.nodeType === 'control' || node.nodeType === 'entity') hasBce = true;
    }
    const diagramType = (hasActor || hasBce) ? 'class_analysis' : 'class';

    return {
      name: diagramName,
      diagramType,
      nodes: Array.from(nodeMap.values()),
      connections,
      defaultLineStyle: 'segment',
    };
  }

  private static collectPackagedElements(modelRoot: any): any[] {
    const list: any[] = [];
    if (!modelRoot) return list;

    const traverse = (node: any) => {
      if (!node) return;
      const pkged = node['packagedElement'] || node['ownedMember'];
      if (pkged) {
        if (Array.isArray(pkged)) {
          for (const item of pkged) {
            list.push(item);
            traverse(item);
          }
        } else if (typeof pkged === 'object') {
          list.push(pkged);
          traverse(pkged);
        }
      }
    };

    traverse(modelRoot);
    return list;
  }

  private static extractAttributes(classElem: any) {
    const attrs: any[] = [];
    const owned = classElem['ownedAttribute'] || classElem['attribute'];
    if (!owned) return attrs;

    const rawList = Array.isArray(owned) ? owned : [owned];
    for (const raw of rawList) {
      const name = raw['@_name'];
      if (!name) continue;

      let type = 'String';
      const typeElem = raw['type'];
      if (typeElem) {
        if (typeElem['@_xmi:idref']) type = this.cleanTypeName(typeElem['@_xmi:idref']);
        else if (typeElem['@_name']) type = typeElem['@_name'];
        else if (typeof typeElem === 'string') type = this.cleanTypeName(typeElem);
      } else if (raw['@_type']) {
        type = this.cleanTypeName(raw['@_type']);
      }

      attrs.push({
        name,
        type: this.mapType(type),
        visibility: raw['@_visibility'] || 'private',
        isPk: (name.toLowerCase().endsWith('id') || name.toLowerCase() === 'id'),
        isNullable: false,
        nullable: false,
      });
    }

    return attrs;
  }

  private static extractMethods(classElem: any) {
    const methods: any[] = [];
    const owned = classElem['ownedOperation'] || classElem['operation'];
    if (!owned) return methods;

    const rawList = Array.isArray(owned) ? owned : [owned];
    for (const raw of rawList) {
      const name = raw['@_name'];
      if (!name) continue;

      let returnType = 'void';
      const params: string[] = [];

      const rawParams = raw['ownedParameter'] || raw['parameter'];
      if (rawParams) {
        const pList = Array.isArray(rawParams) ? rawParams : [rawParams];
        for (const p of pList) {
          const pName = p['@_name'] || 'param';
          const pDirection = p['@_direction'];
          let pType = 'String';

          if (p['type'] && p['type']['@_xmi:idref']) pType = this.cleanTypeName(p['type']['@_xmi:idref']);
          else if (p['@_type']) pType = this.cleanTypeName(p['@_type']);

          pType = this.mapType(pType);

          if (pDirection === 'return' || pName === 'return') {
            returnType = pType;
          } else {
            params.push(`${pName}: ${pType}`);
          }
        }
      }

      methods.push({
        name,
        returnType,
        parameters: params.join(', '),
        visibility: raw['@_visibility'] || 'public',
      });
    }

    return methods;
  }

  private static parseAssociation(assocElem: any, nodeMap: Map<string, any>, labelsMap: Map<string, any>, connLineStyleMap?: Map<string, UmlLineStyle>): UmlConnection | null {
    const id = assocElem['@_xmi:id'] || assocElem['@_id'] || `conn_${Date.now()}`;
    const name = assocElem['@_name'] || '';

    // Priorizar ownedEnd con definiciones de tipo
    let ends = assocElem['ownedEnd'];
    if (!ends || (Array.isArray(ends) && ends.length < 2)) {
      ends = assocElem['memberEnd'] || ends;
    }
    if (!ends) return null;

    const rawEnds = (Array.isArray(ends) ? ends : [ends]).filter((e: any) => !!e);
    const endsWithTypes = rawEnds.filter((e: any) => !!e.type || !!e['@_type']);
    const listToUse = endsWithTypes.length >= 2 ? endsWithTypes : rawEnds;

    if (listToUse.length < 2) return null;

    let sourceNodeId = '';
    let targetNodeId = '';
    let sMult = '';
    let tMult = '';
    let aggregation = 'none';

    // Determinar extremos src/dst
    const end0 = listToUse[0];
    const end1 = listToUse[1];

    const typeId0 = end0.type ? (end0.type['@_xmi:idref'] || end0.type['@_type'] || (typeof end0.type === 'string' ? end0.type : '')) : (end0['@_type'] || '');
    const typeId1 = end1.type ? (end1.type['@_xmi:idref'] || end1.type['@_type'] || (typeof end1.type === 'string' ? end1.type : '')) : (end1['@_type'] || '');

    const id0 = (end0['@_xmi:id'] || end0['@_id'] || '').toLowerCase();
    const id1 = (end1['@_xmi:id'] || end1['@_id'] || '').toLowerCase();

    if (id0.includes('src') || id1.includes('dst')) {
      sourceNodeId = typeId0;
      targetNodeId = typeId1;
      sMult = this.extractMult(end0);
      tMult = this.extractMult(end1);
      if (end0['@_aggregation'] && end0['@_aggregation'] !== 'none') aggregation = end0['@_aggregation'];
      if (end1['@_aggregation'] && end1['@_aggregation'] !== 'none') aggregation = end1['@_aggregation'];
    } else if (id1.includes('src') || id0.includes('dst')) {
      sourceNodeId = typeId1;
      targetNodeId = typeId0;
      sMult = this.extractMult(end1);
      tMult = this.extractMult(end0);
      if (end1['@_aggregation'] && end1['@_aggregation'] !== 'none') aggregation = end1['@_aggregation'];
      if (end0['@_aggregation'] && end0['@_aggregation'] !== 'none') aggregation = end0['@_aggregation'];
    } else {
      sourceNodeId = typeId0;
      targetNodeId = typeId1;
      sMult = this.extractMult(end0);
      tMult = this.extractMult(end1);
      if (end0['@_aggregation'] && end0['@_aggregation'] !== 'none') aggregation = end0['@_aggregation'];
      if (end1['@_aggregation'] && end1['@_aggregation'] !== 'none') aggregation = end1['@_aggregation'];
    }

    if (!sourceNodeId || !targetNodeId || !nodeMap.has(sourceNodeId) || !nodeMap.has(targetNodeId)) {
      return null;
    }

    let type: any = 'association';
    if (aggregation === 'composite') type = 'composition';
    else if (aggregation === 'shared') type = 'aggregation';

    if (labelsMap.has(id)) {
      const lbl = labelsMap.get(id)!;
      if (!sMult && lbl.sMult) sMult = lbl.sMult;
      if (!tMult && lbl.tMult) tMult = lbl.tMult;
    }

    const lineStyle = connLineStyleMap?.get(id) || 'segment';

    return {
      id,
      sourceNodeId,
      targetNodeId,
      sourceId: `${sourceNodeId}_right`,
      targetId: `${targetNodeId}_left`,
      type,
      name: name || undefined,
      sourceMultiplicity: sMult || '',
      targetMultiplicity: tMult || '',
      lineStyle,
    };
  }

  private static parseGeneralizations(classElem: any, nodeMap: Map<string, any>, connLineStyleMap?: Map<string, UmlLineStyle>): UmlConnection[] {
    const conns: UmlConnection[] = [];
    const sourceId = classElem['@_xmi:id'] || classElem['@_id'];
    if (!sourceId || !nodeMap.has(sourceId)) return conns;

    const generalizations = classElem['generalization'];
    if (!generalizations) return conns;

    const rawList = Array.isArray(generalizations) ? generalizations : [generalizations];
    for (const g of rawList) {
      const targetId = g['@_general'] || (g['general'] && g['general']['@_xmi:idref']);
      if (targetId && nodeMap.has(targetId)) {
        const id = g['@_xmi:id'] || `gen_${sourceId}_${targetId}`;
        const lineStyle = connLineStyleMap?.get(id) || 'segment';
        conns.push({
          id,
          sourceNodeId: sourceId,
          targetNodeId: targetId,
          sourceId: `${sourceId}_top`,
          targetId: `${targetId}_bottom`,
          type: 'generalization',
          lineStyle,
          sourceMultiplicity: '',
          targetMultiplicity: '',
        });
      }
    }

    return conns;
  }

  private static extractEaConnectors(xmiRoot: any, nodeMap: Map<string, any>, connLineStyleMap?: Map<string, UmlLineStyle>): UmlConnection[] {
    const conns: UmlConnection[] = [];
    const ext = xmiRoot['xmi:Extension'] || xmiRoot['Extension'];
    if (!ext) return conns;

    const connectors = ext['connectors'];
    if (!connectors) return conns;

    const list = connectors['connector'];
    if (!list) return conns;

    const rawList = Array.isArray(list) ? list : [list];
    for (const c of rawList) {
      const id = c['@_xmi:idref'] || c['@_id'] || `conn_${Date.now()}`;
      const src = c['source'];
      const tgt = c['target'];
      if (!src || !tgt) continue;

      const sourceId = src['@_xmi:idref'] || (src['model'] && src['model']['@_ea_localid']);
      const targetId = tgt['@_xmi:idref'] || (tgt['model'] && tgt['model']['@_ea_localid']);

      if (!sourceId || !targetId || !nodeMap.has(sourceId) || !nodeMap.has(targetId)) continue;

      const eaProps = c['properties'] || {};
      const eaType = eaProps['@_ea_type'] || 'Association';

      let type: any = 'association';
      if (eaType === 'Generalization') type = 'generalization';
      else if (eaType === 'Realisation') type = 'realization';
      else if (eaType === 'Dependency') type = 'dependency';

      const labels = c['labels'] || {};
      const sMult = labels['@_lb'] || '';
      const tMult = labels['@_rb'] || '';
      const name = labels['@_mb'] || undefined;

      const appearance = c['appearance'] || {};
      const linemode = appearance['@_linemode'];
      const style = connLineStyleMap?.get(id) || this.mapEaModeToLineStyle(linemode);

      conns.push({
        id,
        sourceNodeId: sourceId,
        targetNodeId: targetId,
        sourceId: `${sourceId}_right`,
        targetId: `${targetId}_left`,
        type,
        name,
        sourceMultiplicity: sMult || '',
        targetMultiplicity: tMult || '',
        lineStyle: style,
      });
    }

    return conns;
  }

  private static extractEaElementMeta(xmiRoot: any): Map<string, { sType?: string; stereotype?: string; name?: string; color?: string }> {
    const metaMap = new Map<string, { sType?: string; stereotype?: string; name?: string; color?: string }>();
    const ext = xmiRoot['xmi:Extension'] || xmiRoot['Extension'];
    if (!ext) return metaMap;

    const elements = ext['elements']?.['element'];
    if (elements) {
      const list = Array.isArray(elements) ? elements : [elements];
      for (const el of list) {
        const idref = el['@_xmi:idref'] || el['@_id'];
        if (!idref) continue;
        const props = el['properties'];
        const sType = props ? props['@_sType'] : undefined;
        const stereotype = props ? props['@_stereotype'] : undefined;
        const name = el['@_name'];

        let color: string | undefined;
        const styleElem = el['style'];
        const appearance = styleElem ? styleElem['@_appearance'] : undefined;
        if (appearance) {
          const match = appearance.match(/BackColor=(-?\d+)/);
          if (match && match[1] !== '-1' && match[1] !== '0') {
            const val = parseInt(match[1], 10);
            if (!isNaN(val) && val > 0) {
              color = this.eaColorToHex(val);
            }
          }
        }

        metaMap.set(idref, { sType, stereotype, name, color });
      }
    }

    // Perfiles personalizados de EA (ej: <thecustomprofile:Entity. base_Class="..."/>)
    for (const key of Object.keys(xmiRoot)) {
      if (key.includes(':')) {
        const tagParts = key.split(':');
        const tagStereotype = tagParts[1];
        const entries = Array.isArray(xmiRoot[key]) ? xmiRoot[key] : [xmiRoot[key]];
        for (const entry of entries) {
          if (entry && typeof entry === 'object') {
            const baseClass = entry['@_base_Class'];
            if (baseClass) {
              const existing = metaMap.get(baseClass) || {};
              existing.stereotype = existing.stereotype || tagStereotype;
              metaMap.set(baseClass, existing);
            }
          }
        }
      }
    }

    return metaMap;
  }

  private static extractGeometry(xmiRoot: any, geometryMap: Map<string, any>, labelsMap: Map<string, any>, connLineStyleMap?: Map<string, UmlLineStyle>): void {
    const ext = xmiRoot['xmi:Extension'] || xmiRoot['Extension'];
    if (!ext) return;

    const diagrams = ext['diagrams'];
    if (!diagrams) return;

    const list = diagrams['diagram'];
    if (!list) return;

    const primary = Array.isArray(list) ? list[0] : list;
    if (!primary || !primary['elements']) return;

    const elemList = primary['elements']['element'];
    if (!elemList) return;

    const rawList = Array.isArray(elemList) ? elemList : [elemList];
    for (const elem of rawList) {
      const subject = elem['@_subject'];
      const geometry = elem['@_geometry'];
      const style = elem['@_style'];

      let color: string | undefined;
      if (style) {
        const bcolMatch = style.match(/BCol=(-?\d+)/);
        if (bcolMatch && bcolMatch[1] !== '-1' && bcolMatch[1] !== '0') {
          const val = parseInt(bcolMatch[1], 10);
          if (!isNaN(val) && val > 0) {
            color = this.eaColorToHex(val);
          }
        }
      }

      if (subject && style && connLineStyleMap) {
        const modeMatch = style.match(/Mode=(\d+)/);
        if (modeMatch) {
          connLineStyleMap.set(subject, this.mapEaModeToLineStyle(modeMatch[1]));
        }
      }

      if (subject && geometry) {
        const leftMatch = geometry.match(/Left=(-?\d+)/);
        const topMatch = geometry.match(/Top=(-?\d+)/);
        const rightMatch = geometry.match(/Right=(-?\d+)/);
        const bottomMatch = geometry.match(/Bottom=(-?\d+)/);

        if (leftMatch && topMatch && rightMatch && bottomMatch) {
          const left = parseInt(leftMatch[1], 10);
          const top = parseInt(topMatch[1], 10);
          const right = parseInt(rightMatch[1], 10);
          const bottom = parseInt(bottomMatch[1], 10);

          geometryMap.set(subject, {
            left: Math.max(20, left),
            top: Math.max(20, top),
            width: Math.max(20, right - left),
            height: Math.max(20, bottom - top),
            color,
          });
        }
      }
    }
  }

  public static mapEaModeToLineStyle(mode: string | number | undefined): UmlLineStyle {
    const m = String(mode || '3');
    switch (m) {
      case '1':
      case 'Direct':
        return 'straight';
      case '4':
      case 'Bezier':
        return 'bezier';
      case '10':
      case 'Orthogonal - Rounded':
      case 'Orthogonal Rounded':
        return 'adaptive-curve';
      case '3':
      case 'Custom Line':
      case 'Custom':
      case '2':
      case 'Auto Routing':
      default:
        return 'segment';
    }
  }

  private static extractMult(endElem: any): string {
    const lowerElem = endElem['lowerValue'];
    const upperElem = endElem['upperValue'];

    if (!lowerElem && !upperElem) return '';

    const lower = lowerElem ? (lowerElem['@_value'] !== undefined ? String(lowerElem['@_value']) : '1') : '';
    const upper = upperElem ? (upperElem['@_value'] !== undefined ? String(upperElem['@_value']) : '1') : '';

    if (lower === '0' && (upper === '-1' || upper === '*')) return '0..*';
    if (lower === '1' && (upper === '-1' || upper === '*')) return '1..*';
    if (lower === '0' && upper === '1') return '0..1';
    if (lower === '1' && upper === '1') return '1';
    if (upper === '-1') return '*';
    if (lower && upper && lower !== upper) return `${lower}..${upper}`;
    return upper || lower || '';
  }

  private static cleanTypeName(raw: string): string {
    if (!raw) return 'String';
    return raw.replace(/^EAJava_/, '').replace(/^uml:/, '');
  }

  private static mapType(type: string): string {
    const lower = (type || '').toLowerCase().trim();
    if (lower === 'uuid') return 'UUID';
    if (lower === 'string' || lower === 'text' || lower === 'varchar') return 'String';
    if (lower === 'int' || lower === 'integer') return 'Integer';
    if (lower === 'long' || lower === 'bigint') return 'Long';
    if (lower === 'bool' || lower === 'boolean') return 'Boolean';
    if (lower === 'double') return 'Double';
    if (lower === 'float') return 'Float';
    if (lower === 'bigdecimal' || lower === 'decimal' || lower === 'numeric') return 'BigDecimal';
    if (lower === 'localdate' || lower === 'date') return 'LocalDate';
    if (lower === 'localdatetime' || lower === 'timestamp') return 'LocalDateTime';
    if (lower === 'void') return 'void';
    return type || 'String';
  }

  private static resolveAssociationClasses(
    xmiRoot: any,
    rawPackagedElements: any[],
    nodeMap: Map<string, UmlClassNode>,
    connections: UmlConnection[],
    connectionSet: Set<string>,
  ): void {
    const ext = xmiRoot['xmi:Extension'] || xmiRoot['Extension'];
    const pairings: Array<{ assocNodeId: string; mainConnId?: string; sourceId?: string; targetId?: string }> = [];

    // 1. Desde conectores de EA Extension
    if (ext && ext['connectors'] && ext['connectors']['connector']) {
      const rawConnList = Array.isArray(ext['connectors']['connector'])
        ? ext['connectors']['connector']
        : [ext['connectors']['connector']];
      for (const c of rawConnList) {
        const cId = c['@_xmi:idref'] || c['@_id'];
        const assocId = c['extendedProperties']?.['@_associationclass'];
        if (cId && assocId && nodeMap.has(assocId)) {
          pairings.push({ assocNodeId: assocId, mainConnId: cId });
        }
      }
    }

    // 2. Desde elementos de EA Extension
    if (ext && ext['elements'] && ext['elements']['element']) {
      const rawElemList = Array.isArray(ext['elements']['element'])
        ? ext['elements']['element']
        : [ext['elements']['element']];
      for (const e of rawElemList) {
        const eId = e['@_xmi:idref'] || e['@_id'];
        const assocConnId = e['extendedProperties']?.['@_conID'] || e['extendedProperties']?.['@_associationclass'];
        if (eId && assocConnId && nodeMap.has(eId)) {
          pairings.push({ assocNodeId: eId, mainConnId: assocConnId });
        }
      }
    }

    // 3. Desde elementos packagedElement tipo uml:AssociationClass
    for (const elem of rawPackagedElements) {
      const type = elem['@_xmi:type'] || elem['@_type'];
      const id = elem['@_xmi:id'] || elem['@_id'];
      if (type === 'uml:AssociationClass' && id && nodeMap.has(id)) {
        const ends = elem['ownedEnd'] || elem['memberEnd'];
        if (ends) {
          const rawEnds = Array.isArray(ends) ? ends : [ends];
          const typeIds: string[] = [];
          for (const end of rawEnds) {
            const tId = end?.type?.['@_xmi:idref'] || end?.type?.['@_type'] || end?.['@_type'];
            if (tId && nodeMap.has(tId)) {
              typeIds.push(tId);
            }
          }
          if (typeIds.length >= 2) {
            pairings.push({ assocNodeId: id, sourceId: typeIds[0], targetId: typeIds[1] });
          }
        }
      }
    }

    const seenAssocNodes = new Set<string>();
    for (const pair of pairings) {
      if (seenAssocNodes.has(pair.assocNodeId)) continue;
      const assocNode = nodeMap.get(pair.assocNodeId);
      if (!assocNode || assocNode.isAnchor) continue;

      let mainConn: UmlConnection | undefined;
      if (pair.mainConnId) {
        mainConn = connections.find(c => c.id === pair.mainConnId);
      }
      if (!mainConn && pair.sourceId && pair.targetId) {
        mainConn = connections.find(c =>
          (c.sourceNodeId === pair.sourceId && c.targetNodeId === pair.targetId) ||
          (c.sourceNodeId === pair.targetId && c.targetNodeId === pair.sourceId),
        );
        if (!mainConn) {
          const newConnId = `conn_${pair.sourceId}_${pair.targetId}_${Date.now()}`;
          mainConn = {
            id: newConnId,
            sourceNodeId: pair.sourceId,
            targetNodeId: pair.targetId,
            sourceId: `${pair.sourceId}_right`,
            targetId: `${pair.targetId}_left`,
            type: 'association',
            sourceMultiplicity: '',
            targetMultiplicity: '',
            lineStyle: 'straight',
          };
          connectionSet.add(newConnId);
          connections.push(mainConn);
        }
      }
      if (!mainConn) continue;

      if (mainConn.assocAnchorNodeId && nodeMap.has(mainConn.assocAnchorNodeId)) continue;
      seenAssocNodes.add(pair.assocNodeId);

      const sId = mainConn.sourceNodeId || mainConn.sourceId?.replace(/_(top|bottom|left|right)$/, '');
      const tId = mainConn.targetNodeId || mainConn.targetId?.replace(/_(top|bottom|left|right)$/, '');
      if (!sId || !tId) continue;

      const sourceNode = nodeMap.get(sId);
      const targetNode = nodeMap.get(tId);
      const sX = sourceNode?.position?.x || 100;
      const sY = sourceNode?.position?.y || 100;
      const tX = targetNode?.position?.x || 400;
      const tY = targetNode?.position?.y || 100;

      const midX = Math.round((sX + tX + 220) / 2);
      const midY = Math.round((sY + tY + 120) / 2);

      const anchorId = `anchor_${mainConn.id}`;
      const anchorNode: UmlClassNode = {
        id: anchorId,
        name: '',
        position: { x: midX, y: midY },
        width: 14,
        height: 14,
        attributes: [],
        methods: [],
        isAnchor: true,
      };
      nodeMap.set(anchorId, anchorNode);

      mainConn.assocAnchorNodeId = anchorId;
      assocNode.assocMainConnId = mainConn.id;

      const dashedConnId = `conn_${assocNode.id}_assoc_dashed`;
      if (!connectionSet.has(dashedConnId)) {
        connectionSet.add(dashedConnId);
        connections.push({
          id: dashedConnId,
          sourceNodeId: anchorId,
          targetNodeId: assocNode.id,
          sourceId: anchorId,
          targetId: `${assocNode.id}_top`,
          type: 'association_class',
          lineStyle: 'straight',
          name: '«link»',
        });
      }
    }
  }

  public static eaColorToHex(val: number): string {
    const r = val & 0xFF;
    const g = (val >> 8) & 0xFF;
    const b = (val >> 16) & 0xFF;
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  }
}
