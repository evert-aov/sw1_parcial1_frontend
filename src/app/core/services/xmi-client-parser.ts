import { XMLParser } from 'fast-xml-parser';
import { UmlClassNode, UmlConnection, UmlLineStyle, UmlMessage, UmlStereotype } from '../models/diagram.model';

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

  public static fixUtf8Mojibake(str: string): string {
    if (!str || typeof str !== 'string') return str || '';

    // Decodificar entidades numéricas y HTML generadas por Enterprise Architect (ej. &#243;, &#237;, &aacute;, etc.)
    if (str.includes('&')) {
      str = str
        .replace(/&#(\d+);/g, (_, code) => {
          const num = parseInt(code, 10);
          return !isNaN(num) && num > 0 ? String.fromCharCode(num) : _;
        })
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
          const num = parseInt(hex, 16);
          return !isNaN(num) && num > 0 ? String.fromCharCode(num) : _;
        })
        .replace(/&aacute;/gi, 'á')
        .replace(/&eacute;/gi, 'é')
        .replace(/&iacute;/gi, 'í')
        .replace(/&oacute;/gi, 'ó')
        .replace(/&uacute;/gi, 'ú')
        .replace(/&ntilde;/gi, 'ñ')
        .replace(/&Aacute;/g, 'Á')
        .replace(/&Eacute;/g, 'É')
        .replace(/&Iacute;/g, 'Í')
        .replace(/&Oacute;/g, 'Ó')
        .replace(/&Uacute;/g, 'Ú')
        .replace(/&Ntilde;/g, 'Ñ');
    }

    if (!/Ã[\x80-\xBF]|Â[\x80-\xBF]/.test(str)) return str;
    try {
      const bytes = new Uint8Array(str.length);
      for (let i = 0; i < str.length; i++) {
        bytes[i] = str.charCodeAt(i) & 0xff;
      }
      const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      if (!decoded.includes('\uFFFD')) {
        return decoded;
      }
    } catch {
      // fallback
    }
    return str;
  }

  public static parse(xmlContent: string): ParsedDiagramResult {
    if (!xmlContent || xmlContent.trim().length === 0) {
      throw new Error('El archivo XML/XMI está vacío.');
    }

    xmlContent = this.fixUtf8Mojibake(xmlContent);

    const parsed = this.parser.parse(xmlContent);
    const xmiRoot = parsed['xmi:XMI'] || parsed['XMI'] || parsed;
    if (!xmiRoot) {
      throw new Error('El archivo no contiene un nodo raíz XMI válido.');
    }

    let diagramName = 'Diagrama Importado';
    const umlModel = xmiRoot['uml:Model'] || xmiRoot['Model'];
    if (umlModel && umlModel['@_name']) {
      diagramName = this.fixUtf8Mojibake(umlModel['@_name']);
    }

    // 1. Extraer geometrías y estilos de línea desde <xmi:Extension><diagrams><diagram><elements>
    const geometryMap = new Map<string, { left: number; top: number; width: number; height: number; color?: string }>();
    const connectorLabelsMap = new Map<string, { name?: string; sMult?: string; tMult?: string }>();
    const connLineStyleMap = new Map<string, UmlLineStyle>();
    const sequenceOrderMap = new Map<string, number>();
    const diagramMeta: { name?: string; type?: string } = {};

    try {
      this.extractGeometry(xmiRoot, geometryMap, connectorLabelsMap, connLineStyleMap, diagramMeta, sequenceOrderMap);
    } catch (e) {
      // Ignorar errores de layout y continuar con grid
    }

    if (diagramMeta.name) {
      diagramName = this.fixUtf8Mojibake(diagramMeta.name);
    }

    // 2. Extraer metadatos de Enterprise Architect (sType, estereotipos BCE)
    const eaElementMetaMap = this.extractEaElementMeta(xmiRoot);

    // 3. Extraer clases, actores y elementos
    const rawElements = this.collectPackagedElements(umlModel);
    const nodeMap = new Map<string, UmlClassNode>();
    let gridIdx = 0;
    const pendingTextNotes: { id: string; text: string; pos?: { left: number; top: number; right: number; bottom: number } }[] = [];

    for (const elem of rawElements) {
      const type = elem['@_xmi:type'] || elem['@_type'];
      const id = elem['@_xmi:id'] || elem['@_id'];
      const name = elem['@_name'];

      if (!id) continue;

      const hasGeo =
        geometryMap.has(id) ||
        geometryMap.has(id.replace('EAPK_', 'EAID_')) ||
        geometryMap.has(id.replace('EAID_', 'EAPK_'));

      // A) Actores UML
      if (type === 'uml:Actor' || type === 'Actor') {
        if (geometryMap.size > 0 && !hasGeo) {
          continue;
        }

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
          name: this.fixUtf8Mojibake(name || `Actor_${gridIdx + 1}`).trim(),
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

      // B) Casos de Uso UML
      if (type === 'uml:UseCase' || type === 'UseCase') {
        if (geometryMap.size > 0 && !hasGeo) {
          continue;
        }

        let pos = { x: 80 + (gridIdx % 3) * 280, y: 80 + Math.floor(gridIdx / 3) * 220 };
        const cleanName = this.fixUtf8Mojibake(name || `CU_${gridIdx + 1}`).trim();
        const nameLen = cleanName.length;
        const dynamicWidth = Math.min(260, Math.max(140, Math.round(nameLen * 7.5 + 40)));
        const usableWidth = Math.max(50, dynamicWidth - 24);
        const charsPerLine = Math.max(8, Math.floor(usableWidth / 6.8));
        const lines = Math.max(1, Math.ceil(nameLen / charsPerLine));
        const dynamicHeight = Math.max(60, 45 + (lines - 1) * 18);

        let width = dynamicWidth;
        let height = dynamicHeight;

        if (geometryMap.has(id)) {
          const g = geometryMap.get(id)!;
          pos = { x: g.left, y: g.top };
          if (g.width > 20) width = Math.max(width, g.width);
          if (g.height > 20) height = Math.max(height, g.height);
        }

        const customUcColor = geometryMap.get(id)?.color || eaElementMetaMap.get(id)?.color;
        const node: UmlClassNode = {
          id,
          name: cleanName,
          position: pos,
          width,
          height,
          nodeType: 'use_case',
          stereotype: null,
          color: customUcColor || '#E5F2FE',
          attributes: [],
          methods: [],
          isAnchor: false,
        };

        nodeMap.set(id, node);
        gridIdx++;
        continue;
      }

      // C) Líneas de Vida (Diagramas de Secuencia)
      if (type === 'uml:Lifeline' || type === 'Lifeline' || type === 'uml:Sequence' || type === 'Sequence') {
        const meta = eaElementMetaMap.get(id);
        const cleanName = this.fixUtf8Mojibake(name || meta?.name || `Lifeline_${gridIdx + 1}`).trim();
        let pos = { x: 80 + gridIdx * 180, y: 50 };
        let width = 110;
        let height = 60;

        if (geometryMap.has(id)) {
          const g = geometryMap.get(id)!;
          pos = { x: g.left, y: 50 };
          if (g.width > 20) width = Math.max(90, g.width);
        }

        const defaultSeqColor = '#DDF4F5';

        const customSeqColor = geometryMap.get(id)?.color || meta?.color;

        const node: UmlClassNode = {
          id,
          name: cleanName,
          position: pos,
          width,
          height,
          nodeType: 'lifeline',
          stereotype: null,
          color: customSeqColor || defaultSeqColor,
          attributes: [],
          methods: [],
          isAnchor: false,
        };

        nodeMap.set(id, node);
        gridIdx++;
        continue;
      }

      // D) Paquetes UML (Diagramas de Paquetes)
      if (type === 'uml:Package' || type === 'Package') {
        const hasBehavior = !!elem['ownedBehavior'];
        if (hasBehavior) {
          continue;
        }

        const meta = eaElementMetaMap.get(id);
        const hasGeo =
          geometryMap.has(id) ||
          geometryMap.has(id.replace('EAPK_', 'EAID_')) ||
          geometryMap.has(id.replace('EAID_', 'EAPK_'));

        // Si hay mapa de geometrías en EA, sólo los paquetes presentes en el diagrama son nodos
        if (geometryMap.size > 0 && !hasGeo) {
          continue;
        }

        // Si no hay mapa de geometrías en EA, paquetes contenedor raíz o con otros elementos no son nodos de lienzo
        if (geometryMap.size === 0) {
          if (!hasGeo && (!name || name === 'Model' || name === 'EA_PrimitiveTypes_Package' || elem['packagedElement'])) {
            continue;
          }
        }

        const cleanName = this.fixUtf8Mojibake(name || meta?.name || `Package_${gridIdx + 1}`).trim();
        let pos = {
          x: 80 + (gridIdx % 3) * 280,
          y: 80 + Math.floor(gridIdx / 3) * 220,
        };
        let width = 200;
        let height = 120;

        if (hasGeo) {
          const g =
            geometryMap.get(id) ||
            geometryMap.get(id.replace('EAPK_', 'EAID_')) ||
            geometryMap.get(id.replace('EAID_', 'EAPK_'))!;
          pos = { x: g.left, y: g.top };
          if (g.width > 30) width = g.width;
          if (g.height > 20) height = g.height;
        }

        const customColor =
          geometryMap.get(id)?.color ||
          geometryMap.get(id.replace('EAPK_', 'EAID_'))?.color ||
          meta?.color;
        const defaultColor = '#FAF1EC';

        const node: UmlClassNode = {
          id,
          name: cleanName,
          position: pos,
          width,
          height,
          nodeType: 'package',
          stereotype: meta?.stereotype || null,
          color: customColor || defaultColor,
          attributes: [],
          methods: [],
          isAnchor: false,
        };

        nodeMap.set(id, node);
        gridIdx++;
        continue;
      }

      // E) Clases UML, Objetos e InstanceSpecifications (BCE / Robustez)
      if (
        type === 'uml:Class' ||
        type === 'uml:AssociationClass' ||
        type === 'Class' ||
        type === 'uml:InstanceSpecification' ||
        type === 'InstanceSpecification' ||
        type === 'uml:Object' ||
        type === 'Object'
      ) {
        const meta = eaElementMetaMap.get(id);

        // Si el elemento es de tipo Text en EA (nota de texto o descripción de paquete), no es una clase
        if (meta?.sType === 'Text' || (name && name.startsWith('Package : '))) {
          const rawDoc = meta?.documentation || name;
          if (rawDoc && rawDoc !== 'undefined' && !rawDoc.startsWith('Package : ')) {
            const cleanDoc = this.fixUtf8Mojibake(rawDoc).trim();
            const g = geometryMap.get(id);
            pendingTextNotes.push({
              id,
              text: cleanDoc,
              pos: g ? { left: g.left, top: g.top, right: g.left + g.width, bottom: g.top + g.height } : undefined,
            });
          }
          continue;
        }

        if (meta?.sType === 'Actor') {
          if (geometryMap.size > 0 && !hasGeo) {
            continue;
          }

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
            name: this.fixUtf8Mojibake(name || meta?.name || `Actor_${gridIdx + 1}`).trim(),
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

        if (meta?.sType === 'UseCase') {
          if (geometryMap.size > 0 && !hasGeo) {
            continue;
          }

          let pos = { x: 80 + (gridIdx % 3) * 280, y: 80 + Math.floor(gridIdx / 3) * 220 };
          const cleanName = this.fixUtf8Mojibake(name || meta?.name || `CU_${gridIdx + 1}`).trim();
          const nameLen = cleanName.length;
          const dynamicWidth = Math.min(260, Math.max(140, Math.round(nameLen * 7.5 + 40)));
          const usableWidth = Math.max(50, dynamicWidth - 24);
          const charsPerLine = Math.max(8, Math.floor(usableWidth / 6.8));
          const lines = Math.max(1, Math.ceil(nameLen / charsPerLine));
          const dynamicHeight = Math.max(60, 45 + (lines - 1) * 18);

          let width = dynamicWidth;
          let height = dynamicHeight;

          if (geometryMap.has(id)) {
            const g = geometryMap.get(id)!;
            pos = { x: g.left, y: g.top };
            if (g.width > 20) width = Math.max(width, g.width);
            if (g.height > 20) height = Math.max(height, g.height);
          }

          const customUcMetaColor = geometryMap.get(id)?.color || meta?.color;
          const node: UmlClassNode = {
            id,
            name: cleanName,
            position: pos,
            width,
            height,
            nodeType: 'use_case',
            stereotype: null,
            color: customUcMetaColor || '#E5F2FE',
            attributes: [],
            methods: [],
            isAnchor: false,
          };

          nodeMap.set(id, node);
          gridIdx++;
          continue;
        }

        if (geometryMap.size > 0 && !hasGeo) {
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
        const isBce = nodeType === 'boundary' || nodeType === 'control' || nodeType === 'entity';
        let width = isBce ? 70 : 220;
        let height = isBce ? 70 : 120;

        if (geometryMap.has(id)) {
          const g = geometryMap.get(id)!;
          pos = { x: g.left, y: g.top };
          if (g.width > 20) width = g.width;
          if (g.height > 20) height = g.height;
        }

        const customClassColor = geometryMap.get(id)?.color || meta?.color;
        const defaultClassColor = (nodeType === 'boundary' || nodeType === 'control' || nodeType === 'entity') ? '#DDF4F5' : '#FDFAF3';
        const node: UmlClassNode = {
          id,
          name: this.fixUtf8Mojibake(name || meta?.name || `Clase_${gridIdx + 1}`).trim(),
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

    // F) Elementos declarados en extensión EA no presentes en packagedElements
    for (const [eId, meta] of eaElementMetaMap.entries()) {
      if (meta.sType === 'Text') {
        const rawDoc = meta.documentation || meta.name;
        if (rawDoc && rawDoc !== 'undefined' && !rawDoc.startsWith('Package : ')) {
          const cleanDoc = this.fixUtf8Mojibake(rawDoc).trim();
          const g = geometryMap.get(eId);
          pendingTextNotes.push({
            id: eId,
            text: cleanDoc,
            pos: g ? { left: g.left, top: g.top, right: g.left + g.width, bottom: g.top + g.height } : undefined,
          });
        }
        continue;
      }

      if (
        !nodeMap.has(eId) &&
        !nodeMap.has(eId.replace('EAPK_', 'EAID_')) &&
        !nodeMap.has(eId.replace('EAID_', 'EAPK_')) &&
        (meta.sType === 'Actor' ||
          meta.sType === 'Class' ||
          meta.sType === 'UseCase' ||
          meta.sType === 'Object' ||
          meta.sType === 'Boundary' ||
          meta.sType === 'Sequence' ||
          meta.sType === 'Package')
      ) {
        const isActor = meta.sType === 'Actor';
        const isUseCase = meta.sType === 'UseCase';
        const isObject = meta.sType === 'Object';
        const isSequence = meta.sType === 'Sequence';
        const isPackage = meta.sType === 'Package';

        if (isPackage) {
          const hasGeo =
            geometryMap.has(eId) ||
            geometryMap.has(eId.replace('EAPK_', 'EAID_')) ||
            geometryMap.has(eId.replace('EAID_', 'EAPK_'));
          if (!hasGeo) {
            continue;
          }
        }

        if (geometryMap.size > 0 && !geometryMap.has(eId)) {
          continue;
        }

        let pos = {
          x: 80 + (gridIdx % 3) * 280,
          y: isSequence ? 50 : 80 + Math.floor(gridIdx % 3) * 220,
        };
        const cleanName = this.fixUtf8Mojibake(
          meta.name ||
          (isActor
            ? `Actor_${gridIdx + 1}`
            : isUseCase
              ? `CU_${gridIdx + 1}`
              : isSequence
                ? `Lifeline_${gridIdx + 1}`
                : isPackage
                  ? `Package_${gridIdx + 1}`
                  : `Clase_${gridIdx + 1}`)
        ).trim();

        let width = isPackage ? 200 : 220;
        let height = 120;
        if (isActor) {
          width = 65;
          height = 95;
        } else if (isUseCase) {
          const nameLen = cleanName.length;
          const dynamicWidth = Math.min(260, Math.max(140, Math.round(nameLen * 7.5 + 40)));
          const usableWidth = Math.max(50, dynamicWidth - 24);
          const charsPerLine = Math.max(8, Math.floor(usableWidth / 6.8));
          const lines = Math.max(1, Math.ceil(nameLen / charsPerLine));
          width = dynamicWidth;
          height = Math.max(60, 45 + (lines - 1) * 18);
        } else if (isObject) {
          width = 70;
          height = 70;
        } else if (isSequence) {
          width = 110;
          height = 60;
        } else if (isPackage) {
          width = 200;
          height = 120;
        }

        const geoObj =
          geometryMap.get(eId) ||
          geometryMap.get(eId.replace('EAPK_', 'EAID_')) ||
          geometryMap.get(eId.replace('EAID_', 'EAPK_'));
        if (geoObj) {
          pos = { x: geoObj.left, y: isSequence ? 50 : geoObj.top };
          if (geoObj.width > 20) width = isUseCase ? Math.max(width, geoObj.width) : isSequence ? Math.max(90, geoObj.width) : geoObj.width;
          if (geoObj.height > 20) height = isUseCase ? Math.max(height, geoObj.height) : isSequence ? 60 : geoObj.height;
        }

        let nodeType: any = isActor
          ? 'actor'
          : isUseCase
            ? 'use_case'
            : isSequence
              ? 'lifeline'
              : isPackage
                ? 'package'
                : 'class';
        let stereotype: string | null = null;
        if (!isActor && !isUseCase && !isSequence && !isPackage) {
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
        } else if (isPackage) {
          stereotype = meta.stereotype || null;
        }

        let defaultExtColor = isActor ? '#FEF2DD' : (isUseCase ? '#E5F2FE' : isPackage ? '#FAF1EC' : ((nodeType === 'boundary' || nodeType === 'control' || nodeType === 'entity') ? '#DDF4F5' : '#FDFAF3'));
        if (isSequence) {
          defaultExtColor = '#DDF4F5';
        }

        const customExtColor = geometryMap.get(eId)?.color ||
          geometryMap.get(eId.replace('EAPK_', 'EAID_'))?.color ||
          meta?.color;
        nodeMap.set(eId, {
          id: eId,
          name: cleanName,
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

    // Asociar notas de texto pendientes a los paquetes que las contienen geométricamente
    if (pendingTextNotes.length > 0) {
      const packageNodes = Array.from(nodeMap.values()).filter((n) => n.nodeType === 'package');
      for (const note of pendingTextNotes) {
        if (!note.text) continue;
        let targetPkg: UmlClassNode | undefined;

        if (note.pos) {
          targetPkg = packageNodes.find((pkg) => {
            const pLeft = pkg.position.x;
            const pTop = pkg.position.y;
            const pRight = pLeft + (pkg.width || 200);
            const pBottom = pTop + (pkg.height || 120);
            return (
              note.pos!.left >= pLeft - 30 &&
              note.pos!.right <= pRight + 30 &&
              note.pos!.top >= pTop - 30 &&
              note.pos!.bottom <= pBottom + 30
            );
          });
        }

        if (!targetPkg && packageNodes.length === 1) {
          targetPkg = packageNodes[0];
        }

        if (targetPkg) {
          const alreadyExists = targetPkg.attributes.some((a) => a.name === note.text);
          if (!alreadyExists) {
            targetPkg.attributes.push({
              name: note.text,
              type: 'String',
              visibility: 'private',
              isPk: false,
              isNullable: false,
              nullable: false,
            });

            // Si la nota de texto o descripción es extensa, asegurar dimensiones proporcionales
            const lines = note.text.split('\n');
            const maxLineLen = Math.max(...lines.map((l) => l.length));
            const neededWidth = Math.max(targetPkg.width || 200, Math.min(280, Math.round(maxLineLen * 7.5 + 40)));
            const neededHeight = Math.max(targetPkg.height || 120, 90 + lines.length * 20);
            targetPkg.width = Math.max(targetPkg.width || 200, neededWidth);
            targetPkg.height = Math.max(targetPkg.height || 120, neededHeight);
          }
        }
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

      if (type === 'uml:UseCase' || type === 'UseCase') {
        const ucConns = this.parseUseCaseRelationships(elem, nodeMap, connLineStyleMap);
        for (const uc of ucConns) {
          if (!connSet.has(uc.id)) {
            connSet.add(uc.id);
            connections.push(uc);
          }
        }
      }

      if (type === 'uml:Dependency' || type === 'Dependency') {
        const depConn = this.parseDependency(elem, nodeMap, connectorLabelsMap);
        if (depConn && !connSet.has(depConn.id)) {
          connSet.add(depConn.id);
          connections.push(depConn);
        }
      }

      if (type === 'uml:Package' || type === 'Package') {
        const pkgConns = this.parsePackageRelationships(elem, nodeMap);
        for (const pc of pkgConns) {
          if (!connSet.has(pc.id)) {
            connSet.add(pc.id);
            connections.push(pc);
          }
        }
      }

      if (type === 'uml:Connector' || type === 'Connector') {
        const cConn = this.parseUmlConnector(elem, nodeMap, connLineStyleMap);
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
          const cConn = this.parseUmlConnector(oc, nodeMap, connLineStyleMap);
          if (cConn && !connSet.has(cConn.id)) {
            connSet.add(cConn.id);
            connections.push(cConn);
          }
        }
      }
    }

    // 5. Conectores de extensión EA
    const eaConns = this.extractEaConnectors(xmiRoot, nodeMap, connLineStyleMap, connections, sequenceOrderMap);
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

    // 6. Reconstruir tablas intermedias / Association Classes (ancla y enlace discontinuo)
    this.resolveAssociationClasses(xmiRoot, rawElements, nodeMap, connections, connSet);

    // Determinar tipo de diagrama inferido
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

    if (eaDiagType.includes('sequence')) {
      diagramType = 'sequence';
    } else if (eaDiagType.includes('collab') || eaDiagType.includes('commun')) {
      diagramType = 'communication';
    } else if (eaDiagType.includes('use case')) {
      diagramType = 'use_case';
    } else if (eaDiagType.includes('package')) {
      diagramType = 'package';
    } else if (hasSequenceConn || hasLifeline) {
      diagramType = 'sequence';
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
      // Un diagrama de paquetes está compuesto por {package, use_case, actor}
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
      // Un diagrama de casos de uso sólo debe contener actores y casos de uso
      for (const [id, node] of Array.from(nodeMap.entries())) {
        if (node.nodeType !== 'use_case' && node.nodeType !== 'actor') {
          nodeMap.delete(id);
        }
      }
    }

    // Filtrar conexiones cuyos extremos hayan sido eliminados del lienzo
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
        name: this.fixUtf8Mojibake(name),
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
            params.push(`${this.fixUtf8Mojibake(pName)}: ${pType}`);
          }
        }
      }

      methods.push({
        name: this.fixUtf8Mojibake(name),
        returnType,
        parameters: params.join(', '),
        visibility: raw['@_visibility'] || 'public',
      });
    }

    return methods;
  }

  private static parseAssociation(assocElem: any, nodeMap: Map<string, any>, labelsMap: Map<string, any>, connLineStyleMap?: Map<string, UmlLineStyle>): UmlConnection | null {
    const id = assocElem['@_xmi:id'] || assocElem['@_id'] || `conn_${Date.now()}`;
    const name = this.fixUtf8Mojibake(assocElem['@_name'] || '');

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

    const resolvedSrc = this.resolveNodeId(sourceNodeId, nodeMap);
    const resolvedTgt = this.resolveNodeId(targetNodeId, nodeMap);
    if (!resolvedSrc || !resolvedTgt || resolvedSrc === resolvedTgt) {
      return null;
    }
    sourceNodeId = resolvedSrc;
    targetNodeId = resolvedTgt;

    let type: any = 'association';
    if (aggregation === 'composite') type = 'composition';
    else if (aggregation === 'shared') type = 'aggregation';

    if (labelsMap.has(id)) {
      const lbl = labelsMap.get(id)!;
      if (!sMult && lbl.sMult) sMult = lbl.sMult;
      if (!tMult && lbl.tMult) tMult = lbl.tMult;
    }

    const sNode = nodeMap.get(sourceNodeId);
    const tNode = nodeMap.get(targetNodeId);
    const isActorOrUseCase =
      sNode?.nodeType === 'actor' ||
      sNode?.nodeType === 'use_case' ||
      tNode?.nodeType === 'actor' ||
      tNode?.nodeType === 'use_case';

    if (isActorOrUseCase) {
      if (sMult === '1' && !end0['lowerValue'] && !end1['lowerValue']) {
        sMult = '';
      }
      if (tMult === '1' && !end0['lowerValue'] && !end1['lowerValue']) {
        tMult = '';
      }
    }

    const lineStyle = connLineStyleMap?.get(id) || 'segment';
    const rawConnName = name || (labelsMap.has(id) ? labelsMap.get(id)!.name : undefined);
    const cleanConnName = this.fixUtf8Mojibake(rawConnName || '');
    const commMsgs = this.parseCommunicationMessages(cleanConnName);

    return {
      id,
      sourceNodeId,
      targetNodeId,
      sourceId: `${sourceNodeId}_right`,
      targetId: `${targetNodeId}_left`,
      type,
      name: commMsgs.length > 0 ? undefined : (cleanConnName || undefined),
      sourceMultiplicity: sMult || '',
      targetMultiplicity: tMult || '',
      lineStyle,
      messages: commMsgs.length > 0 ? commMsgs : undefined,
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

  private static parseUseCaseRelationships(
    ucElem: any,
    nodeMap: Map<string, any>,
    connLineStyleMap?: Map<string, UmlLineStyle>,
  ): UmlConnection[] {
    const conns: UmlConnection[] = [];
    const sourceId = ucElem['@_xmi:id'] || ucElem['@_id'];
    if (!sourceId || !nodeMap.has(sourceId)) return conns;

    // A) Extend: <extend xmi:type="uml:Extend" xmi:id="..." extendedCase="..."/>
    const rawExtends = ucElem['extend'];
    if (rawExtends) {
      const list = Array.isArray(rawExtends) ? rawExtends : [rawExtends];
      for (const ext of list) {
        const targetId = ext['@_extendedCase'];
        if (targetId && nodeMap.has(targetId)) {
          const id = ext['@_xmi:id'] || ext['@_id'] || `ext_${sourceId}_${targetId}`;
          const lineStyle = connLineStyleMap?.get(id) || 'segment';
          conns.push({
            id,
            sourceNodeId: sourceId,
            targetNodeId: targetId,
            sourceId: `${sourceId}_right`,
            targetId: `${targetId}_left`,
            type: 'extend',
            name: '«extend»',
            lineStyle,
          });
        }
      }
    }

    // B) Include: <include xmi:type="uml:Include" xmi:id="..." addition="..."/>
    const rawIncludes = ucElem['include'];
    if (rawIncludes) {
      const list = Array.isArray(rawIncludes) ? rawIncludes : [rawIncludes];
      for (const inc of list) {
        const targetId = inc['@_addition'];
        if (targetId && nodeMap.has(targetId)) {
          const id = inc['@_xmi:id'] || inc['@_id'] || `inc_${sourceId}_${targetId}`;
          const lineStyle = connLineStyleMap?.get(id) || 'segment';
          conns.push({
            id,
            sourceNodeId: sourceId,
            targetNodeId: targetId,
            sourceId: `${sourceId}_right`,
            targetId: `${targetId}_left`,
            type: 'include',
            name: '«include»',
            lineStyle,
          });
        }
      }
    }

    // C) Generalization: <generalization xmi:type="uml:Generalization" general="..."/>
    const rawGens = ucElem['generalization'];
    if (rawGens) {
      const list = Array.isArray(rawGens) ? rawGens : [rawGens];
      for (const g of list) {
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
    }

    return conns;
  }

  private static parseDependency(
    depElem: any,
    nodeMap: Map<string, UmlClassNode>,
    connectorLabelsMap?: Map<string, { name?: string; sMult?: string; tMult?: string }>,
  ): UmlConnection | null {
    const id =
      depElem['@_xmi:id'] ||
      depElem['@_id'] ||
      `dep_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const name = this.fixUtf8Mojibake(depElem['@_name'] || '');

    const rawClient =
      depElem['@_client'] ||
      (depElem['client'] &&
        (depElem['client']['@_xmi:idref'] || depElem['client']['@_idref']));
    const rawSupplier =
      depElem['@_supplier'] ||
      (depElem['supplier'] &&
        (depElem['supplier']['@_xmi:idref'] || depElem['supplier']['@_idref']));

    const sourceId = this.resolveNodeId(rawClient, nodeMap);
    const targetId = this.resolveNodeId(rawSupplier, nodeMap);

    if (!sourceId || !targetId || sourceId === targetId) return null;

    let type: any = 'dependency';
    const lowerName = name.toLowerCase();
    if (lowerName.includes('import')) {
      type = 'import';
    } else if (lowerName.includes('access')) {
      type = 'access';
    } else if (lowerName.includes('merge')) {
      type = 'merge';
    } else if (lowerName.includes('trace')) {
      type = 'trace';
    }

    return {
      id,
      sourceNodeId: sourceId,
      targetNodeId: targetId,
      sourceId: `${sourceId}_right`,
      targetId: `${targetId}_left`,
      type,
      name: name || undefined,
    };
  }

  private static parsePackageRelationships(
    pkgElem: any,
    nodeMap: Map<string, UmlClassNode>,
  ): UmlConnection[] {
    const conns: UmlConnection[] = [];
    const pkgId = pkgElem['@_xmi:id'] || pkgElem['@_id'];
    const resolvedPkgId = this.resolveNodeId(pkgId, nodeMap);
    if (!resolvedPkgId) return conns;

    // A) Dependencies declaradas dentro de packagedElement del paquete
    const childElems = pkgElem['packagedElement'];
    if (childElems) {
      const list = Array.isArray(childElems) ? childElems : [childElems];
      for (const el of list) {
        const type = el['@_xmi:type'] || el['@_type'];
        if (type === 'uml:Dependency' || type === 'Dependency') {
          const dep = this.parseDependency(el, nodeMap);
          if (dep) conns.push(dep);
        }
      }
    }

    // B) PackageImport
    const rawImports = pkgElem['packageImport'];
    if (rawImports) {
      const list = Array.isArray(rawImports) ? rawImports : [rawImports];
      for (const imp of list) {
        const targetRaw =
          imp['@_importedPackage'] ||
          (imp['importedPackage'] &&
            (imp['importedPackage']['@_xmi:idref'] ||
              imp['importedPackage']['@_idref']));
        const targetId = this.resolveNodeId(targetRaw, nodeMap);
        if (targetId && targetId !== resolvedPkgId) {
          const id =
            imp['@_xmi:id'] ||
            imp['@_id'] ||
            `pkg_imp_${resolvedPkgId}_${targetId}`;
          conns.push({
            id,
            sourceNodeId: resolvedPkgId,
            targetNodeId: targetId,
            sourceId: `${resolvedPkgId}_right`,
            targetId: `${targetId}_left`,
            type: 'import' as any,
            name: '«import»',
          });
        }
      }
    }

    // C) PackageMerge
    const rawMerges = pkgElem['packageMerge'];
    if (rawMerges) {
      const list = Array.isArray(rawMerges) ? rawMerges : [rawMerges];
      for (const m of list) {
        const targetRaw =
          m['@_mergedPackage'] ||
          (m['mergedPackage'] &&
            (m['mergedPackage']['@_xmi:idref'] ||
              m['mergedPackage']['@_idref']));
        const targetId = this.resolveNodeId(targetRaw, nodeMap);
        if (targetId && targetId !== resolvedPkgId) {
          const id =
            m['@_xmi:id'] ||
            m['@_id'] ||
            `pkg_mrg_${resolvedPkgId}_${targetId}`;
          conns.push({
            id,
            sourceNodeId: resolvedPkgId,
            targetNodeId: targetId,
            sourceId: `${resolvedPkgId}_right`,
            targetId: `${targetId}_left`,
            type: 'merge' as any,
            name: '«merge»',
          });
        }
      }
    }

    return conns;
  }

  private static parseUmlConnector(
    elem: any,
    nodeMap: Map<string, any>,
    connLineStyleMap?: Map<string, UmlLineStyle>,
  ): UmlConnection | null {
    const id = elem['@_xmi:id'] || elem['@_id'] || `conn_${Date.now()}`;
    const ends = elem['end'];
    if (!ends) return null;
    const endList = Array.isArray(ends) ? ends : [ends];
    if (endList.length < 2) return null;
    const s = endList[0]['@_role'];
    const t = endList[1]['@_role'];
    if (!s || !t || !nodeMap.has(s) || !nodeMap.has(t)) return null;

    const lineStyle = connLineStyleMap?.get(id) || 'segment';
    return {
      id,
      sourceNodeId: s,
      targetNodeId: t,
      sourceId: `${s}_right`,
      targetId: `${t}_left`,
      type: 'association',
      sourceMultiplicity: '',
      targetMultiplicity: '',
      lineStyle,
    };
  }

  private static extractEaConnectors(
    xmiRoot: any,
    nodeMap: Map<string, any>,
    connLineStyleMap?: Map<string, UmlLineStyle>,
    existingConnections: UmlConnection[] = [],
    sequenceOrderMap: Map<string, number> = new Map(),
  ): UmlConnection[] {
    const conns: UmlConnection[] = [];
    const ext = xmiRoot['xmi:Extension'] || xmiRoot['Extension'];
    if (!ext) return conns;

    const connectors = ext['connectors'];
    if (!connectors) return conns;

    const list = connectors['connector'];
    if (!list) return conns;

    const rawList = Array.isArray(list) ? list : [list];
    const umlMessages = this.collectUmlMessages(xmiRoot['uml:Model'] || xmiRoot['Model']);
    const collaborationMsgList: Array<{
      targetConnId: string;
      sourceId: string;
      targetId: string;
      rawLabel: string;
      seqNum?: string;
      isReturn?: boolean;
    }> = [];
    const sequenceConnList: Array<{
      id: string;
      sourceId: string;
      targetId: string;
      seqNo: number;
      name: string;
      functionName: string;
      parameters: string;
      returnType?: string;
      isReply: boolean;
      type: 'sync' | 'async' | 'create' | 'reply';
      sequenceNumber?: string;
    }> = [];

    for (const c of rawList) {
      const id =
        c['@_xmi:id'] ||
        c['@_xmi:idref'] ||
        c['@_id'] ||
        `conn_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const src = c['source'];
      const tgt = c['target'];
      if (!src || !tgt) continue;

      const rawSourceId = src['@_xmi:idref'] || (src['model'] && src['model']['@_ea_localid']);
      const rawTargetId = tgt['@_xmi:idref'] || (tgt['model'] && tgt['model']['@_ea_localid']);

      const sourceId = this.resolveNodeId(rawSourceId, nodeMap);
      const targetId = this.resolveNodeId(rawTargetId, nodeMap);

      if (!sourceId || !targetId || sourceId === targetId) continue;

      const eaProps = c['properties'] || {};
      const eaType = eaProps['@_ea_type'] || 'Association';
      const eaSubtype = (eaProps['@_subtype'] || '').toLowerCase();
      const eaStereo = (eaProps['@_stereotype'] || '').toLowerCase();
      const labels = c['labels'] || {};
      const mbText = (labels['@_mb'] || '').toLowerCase();

      // Manejo de mensajes de comunicación en EA (Collaboration links)
      if (eaType === 'Collaboration') {
        const extProps = c['extendedProperties'] || {};
        const msgLink = extProps['@_message_link'];
        const stateFlags = extProps['@_stateflags'] || '';
        const isReturn = stateFlags.includes('IsReturn=true');
        const rawLabel =
          labels['@_lt'] ||
          labels['@_mb'] ||
          eaProps['@_name'] ||
          c['@_name'] ||
          '';
        const seqMatch = rawLabel.match(/^(\d+(?:\.\d+)*):?/);
        const seqNum = extProps['@_privatedata4'] || (seqMatch ? seqMatch[1] : undefined);

        if (msgLink) {
          collaborationMsgList.push({
            targetConnId: msgLink,
            sourceId,
            targetId,
            rawLabel,
            seqNum,
            isReturn,
          });
        }
        continue;
      }

      if (eaType === 'Sequence') {
        const extProps = c['extendedProperties'] || {};
        const umlMessage = umlMessages.get(id);
        const rawName = labels['@_mt'] || eaProps['@_name'] || c['@_name'] || umlMessage?.['@_name'] || '';
        const label = this.fixUtf8Mojibake(String(rawName)).trim();
        const labelSequence = label.match(/^(\d+(?:\.\d+)*)(?:\s*[:.-]\s*|\s+)(.*)$/);
        const cleanName = labelSequence ? labelSequence[2].trim() : label;
        const stateflags = extProps['@_stateflags'] || '';
        const priv1 = (extProps['@_privatedata1'] || '').toLowerCase();
        const priv4 = extProps['@_privatedata4'];
        const isReply =
          priv4 === '1' ||
          stateflags.includes('IsReturn=true') ||
          priv1.includes('return') ||
          umlMessage?.['@_messageSort'] === 'reply';
        const callKind = String(extProps['@_privatedata3'] || '').toLowerCase();
        const messageSort = umlMessage?.['@_messageSort'];
        const type = isReply ? 'reply'
          : callKind.includes('create') || priv1.includes('create') || messageSort === 'createMessage' ? 'create'
          : priv1.includes('asynch') || messageSort === 'asynchCall' || messageSort === 'asynchSignal' ? 'async'
          : 'sync';

        // SeqNo es cronología, no numeración visible; cero es una posición válida.
        const seqNo = sequenceOrderMap.get(id)
          ?? this.readSequenceOrder(extProps['@_privatedata5'])
          ?? this.readSequenceOrder(c['appearance']?.['@_seqno'])
          ?? sequenceConnList.length;

        let functionName = cleanName;
        let parameters = '';
        const pMatch = cleanName.match(/^([^(]+)\((.*)\)$/);
        if (pMatch) {
          functionName = pMatch[1].trim();
          parameters = pMatch[2].trim();
        }

        const priv2 = extProps['@_privatedata2'] || '';
        if (!parameters && priv2) {
          const paramsMatch = priv2.match(/paramsDlg=([^;]+);/);
          if (paramsMatch) {
            parameters = paramsMatch[1].trim();
          }
        }

        if (!parameters && umlMessage?.argument) {
          const args = Array.isArray(umlMessage.argument) ? umlMessage.argument : [umlMessage.argument];
          parameters = args.map((arg: any) => this.fixUtf8Mojibake(String(
            arg['@_value'] ?? arg['@_name'] ?? arg['#text'] ?? '',
          )).trim()).join(', ');
        }

        let returnType: string | undefined = undefined;
        if (priv2) {
          const retMatch = priv2.match(/retval=([^;]+);/);
          if (retMatch && retMatch[1].trim() !== 'void') {
            returnType = retMatch[1].trim();
          }
        }

        sequenceConnList.push({
          id,
          sourceId,
          targetId,
          seqNo,
          name: cleanName,
          functionName,
          parameters,
          returnType,
          isReply,
          type,
          sequenceNumber: labelSequence?.[1],
        });
        continue;
      }

      let type: any = 'association';
      let name = labels['@_mb'] ? this.fixUtf8Mojibake(labels['@_mb']) : undefined;

      if (eaType === 'UseCase') {
        if (eaSubtype === 'extends' || eaStereo === 'extend' || mbText.includes('extend')) {
          type = 'extend';
          name = '«extend»';
        } else if (eaSubtype === 'includes' || eaStereo === 'include' || mbText.includes('include')) {
          type = 'include';
          name = '«include»';
        }
      } else if (eaType === 'Generalization') {
        type = 'generalization';
      } else if (eaType === 'Realisation') {
        type = 'realization';
      } else if (eaType === 'Dependency') {
        type = 'dependency';
        if (eaStereo === 'import' || mbText.includes('import')) {
          type = 'import';
          name = '«import»';
        } else if (eaStereo === 'access' || mbText.includes('access')) {
          type = 'access';
          name = '«access»';
        } else if (eaStereo === 'merge' || mbText.includes('merge')) {
          type = 'merge';
          name = '«merge»';
        } else if (eaStereo === 'trace' || mbText.includes('trace')) {
          type = 'trace';
          name = '«trace»';
        }
      }

      const sMult = labels['@_lb'] || '';
      const tMult = labels['@_rb'] || '';

      const appearance = c['appearance'] || {};
      const linemode = appearance['@_linemode'];
      const style = connLineStyleMap?.get(id) || this.mapEaModeToLineStyle(linemode);
      const cleanConnName = name ? this.fixUtf8Mojibake(name) : undefined;
      const commMsgs = this.parseCommunicationMessages(cleanConnName);

      conns.push({
        id,
        sourceNodeId: sourceId,
        targetNodeId: targetId,
        sourceId: `${sourceId}_right`,
        targetId: `${targetId}_left`,
        type,
        name: commMsgs.length > 0 ? undefined : (cleanConnName || undefined),
        sourceMultiplicity: sMult || '',
        targetMultiplicity: tMult || '',
        lineStyle: style,
        messages: commMsgs.length > 0 ? commMsgs : undefined,
      });
    }

    if (sequenceConnList.length > 0) {
      sequenceConnList.sort((a, b) => a.seqNo - b.seqNo);
      const hasHierarchicalLabels = sequenceConnList.some((item) => item.sequenceNumber?.includes('.'));
      let group = 0;
      let child = 0;
      sequenceConnList.forEach((item, index) => {
        const slot = index;
        if (group === 0 || (!item.isReply && nodeMap.get(item.sourceId)?.nodeType === 'actor')) {
          group++;
          child = 0;
        } else {
          child++;
        }
        // Los ordinales planos de EA no representan grupos de interacción.
        const groupedNumber = child === 0 ? `${group}` : `${group}.${child}`;
        const seqNumStr = hasHierarchicalLabels ? item.sequenceNumber ?? groupedNumber : groupedNumber;
        const type = item.type;
        const connColor = this.getGroupColor(seqNumStr);

        conns.push({
          id: item.id,
          sourceNodeId: item.sourceId,
          targetNodeId: item.targetId,
          sourceId: `${item.sourceId}_slot_${slot}`,
          targetId: `${item.targetId}_slot_${slot}`,
          type,
          lineStyle: 'straight' as UmlLineStyle,
          messages: [
            {
              id: `msg_${item.id}`,
              sequenceNumber: seqNumStr,
              functionName: item.functionName,
              parameters: item.parameters || undefined,
              returnType: item.returnType,
              isReturn: item.isReply,
              direction: 'forward',
              orderIndex: index,
              type,
              color: connColor,
            },
          ],
        });
      });
    }

    // Asociar mensajes de colaboración al conector base
    for (const collab of collaborationMsgList) {
      let baseConn =
        conns.find((cn) => cn.id === collab.targetConnId) ||
        existingConnections.find((cn) => cn.id === collab.targetConnId);
      if (!baseConn) {
        baseConn =
          conns.find(
            (cn) =>
              (cn.sourceNodeId === collab.sourceId || cn.sourceNodeId === collab.targetId) &&
              (cn.targetNodeId === collab.sourceId || cn.targetNodeId === collab.targetId),
          ) ||
          existingConnections.find(
            (cn) =>
              (cn.sourceNodeId === collab.sourceId || cn.sourceNodeId === collab.targetId) &&
              (cn.targetNodeId === collab.sourceId || cn.targetNodeId === collab.targetId),
          );
      }
      if (baseConn) {
        const parsedMsgs = this.parseCommunicationMessages(collab.rawLabel);
        if (parsedMsgs.length > 0) {
          for (const pm of parsedMsgs) {
            if (collab.seqNum) pm.sequenceNumber = collab.seqNum;
            const isRev = collab.isReturn || collab.sourceId === baseConn.targetNodeId;
            pm.direction = isRev ? 'reverse' : 'forward';
            pm.isReturn = isRev;
            if (!pm.color || collab.seqNum) {
              pm.color = this.getGroupColor(pm.sequenceNumber);
            }
            if (!baseConn.messages) baseConn.messages = [];
            const alreadyExists = baseConn.messages.some(
              (m) => m.sequenceNumber === pm.sequenceNumber && m.functionName === pm.functionName,
            );
            if (!alreadyExists) {
              baseConn.messages.push(pm);
            }
          }
          baseConn.messages?.sort((a, b) =>
            this.compareSequenceNumbers(a.sequenceNumber, b.sequenceNumber),
          );
        }
      }
    }

    return conns;
  }

  private static readSequenceOrder(raw: unknown): number | undefined {
    if (raw === undefined || raw === null || String(raw).trim() === '') return undefined;
    const text = String(raw).trim();
    const match = text.match(/(?:^|;)\s*SeqNo\s*=\s*(\d+)\s*(?:;|$)/i);
    const value = match ? match[1] : text;
    if (!/^\d+$/.test(value)) return undefined;
    const order = Number(value);
    return Number.isSafeInteger(order) ? order : undefined;
  }

  private static collectUmlMessages(model: any): Map<string, any> {
    const messages = new Map<string, any>();
    const visit = (value: any): void => {
      if (!value || typeof value !== 'object') return;
      for (const message of value.message ? (Array.isArray(value.message) ? value.message : [value.message]) : []) {
        const id = message['@_xmi:id'] || message['@_id'];
        if (id) messages.set(id, message);
      }
      for (const key of ['packagedElement', 'ownedBehavior', 'nestedClassifier']) {
        const children = value[key];
        if (children) (Array.isArray(children) ? children : [children]).forEach(visit);
      }
    };
    visit(model);
    return messages;
  }

  private static resolveNodeId(
    rawId: string | undefined | null,
    nodeMap: Map<string, UmlClassNode>,
  ): string | null {
    if (!rawId) return null;
    if (nodeMap.has(rawId)) return rawId;
    if (rawId.startsWith('EAPK_')) {
      const alt = rawId.replace('EAPK_', 'EAID_');
      if (nodeMap.has(alt)) return alt;
    }
    if (rawId.startsWith('EAID_')) {
      const alt = rawId.replace('EAID_', 'EAPK_');
      if (nodeMap.has(alt)) return alt;
    }
    return null;
  }

  private static extractEaElementMeta(xmiRoot: any): Map<string, { sType?: string; stereotype?: string; name?: string; color?: string; documentation?: string }> {
    const metaMap = new Map<string, { sType?: string; stereotype?: string; name?: string; color?: string; documentation?: string }>();
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
        let stereotype = props ? props['@_stereotype'] : undefined;
        const name = el['@_name'] ? this.fixUtf8Mojibake(el['@_name']) : undefined;
        const documentation = props ? props['@_documentation'] : undefined;

        if (!stereotype) {
          const xrefsVal = el['xrefs']?.['@_value'] || '';
          const stMatch = xrefsVal.match(/@STEREO;Name=([^;@]+);/);
          if (stMatch) {
            stereotype = stMatch[1];
          }
        }

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

        metaMap.set(idref, { sType, stereotype, name, color, documentation });
      }
    }

    // Perfiles personalizados de EA (ej: <thecustomprofile:Entity. base_Class="..."/> o <EAUML:entity base_InstanceSpecification="..."/>)
    for (const key of Object.keys(xmiRoot)) {
      if (key.includes(':')) {
        const tagParts = key.split(':');
        const tagStereotype = tagParts[1];
        const entries = Array.isArray(xmiRoot[key]) ? xmiRoot[key] : [xmiRoot[key]];
        for (const entry of entries) {
          if (entry && typeof entry === 'object') {
            const baseClass =
              entry['@_base_Class'] ||
              entry['@_base_InstanceSpecification'] ||
              entry['@_base_Element'] ||
              entry['@_base_Package'];
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

  private static extractGeometry(
    xmiRoot: any,
    geometryMap: Map<string, any>,
    labelsMap: Map<string, any>,
    connLineStyleMap?: Map<string, UmlLineStyle>,
    diagramMetaRef?: { name?: string; type?: string },
    sequenceOrderMap?: Map<string, number>,
  ): void {
    const ext = xmiRoot['xmi:Extension'] || xmiRoot['Extension'];
    if (!ext) return;

    const diagrams = ext['diagrams'];
    if (!diagrams) return;

    const list = diagrams['diagram'];
    if (!list) return;

    const primary = Array.isArray(list) ? list[0] : list;
    if (!primary) return;

    if (diagramMetaRef) {
      const props = primary['properties'];
      if (props) {
        diagramMetaRef.type = props['@_type'];
        diagramMetaRef.name = props['@_name'];
      }
    }

    if (!primary['elements']) return;

    const elemList = primary['elements']['element'];
    if (!elemList) return;

    const rawList = Array.isArray(elemList) ? elemList : [elemList];
    for (const elem of rawList) {
      const subject = elem['@_subject'];
      const geometry = elem['@_geometry'];
      const style = elem['@_style'];
      const sequenceOrder = this.readSequenceOrder(geometry);
      if (subject && sequenceOrder !== undefined) {
        sequenceOrderMap?.set(subject, sequenceOrder);
      }

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

  public static parseCommunicationMessages(rawText?: string): UmlMessage[] {
    if (!rawText) return [];
    const parts = rawText
      .split(/\r?\n|&#xA;|;/)
      .map((p) => p.trim())
      .filter(Boolean);
    const msgs: UmlMessage[] = [];
    const msgRegex = /^(\d+(?:\.\d+)*)\s*:\s*([a-zA-Z_$][a-zA-Z0-9_$]*)(?:\s*\((.*?)(?:\)|$))?(?:\s*:\s*([a-zA-Z_$][a-zA-Z0-9_$<>]*))?$/;

    for (let i = 0; i < parts.length; i++) {
      let text = parts[i];
      let isReverse = false;
      if (text.startsWith('<-') || text.startsWith('&lt;-')) {
        isReverse = true;
        text = text.replace(/^(?:<-|&lt;-)\s*/, '').trim();
      } else if (text.startsWith('->') || text.startsWith('-&gt;')) {
        text = text.replace(/^(?:->|-&gt;)\s*/, '').trim();
      }

      const match = text.match(msgRegex);
      if (match) {
        msgs.push({
          id: `msg_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
          sequenceNumber: match[1],
          functionName: match[2],
          parameters: (match[3] || '').replace(/\.\.\.$/, '').trim(),
          returnType: match[4] || '',
          direction: isReverse ? 'reverse' : 'forward',
          isReturn: isReverse,
          color: this.getGroupColor(match[1]),
          orderIndex: i,
        });
      } else {
        const colonIdx = text.indexOf(':');
        if (colonIdx > 0) {
          const seq = text.substring(0, colonIdx).trim();
          const rest = text.substring(colonIdx + 1).trim();
          const pStart = rest.indexOf('(');
          const pEnd = rest.lastIndexOf(')');
          const fn = pStart !== -1 ? rest.substring(0, pStart).trim() : rest;
          let params = '';
          if (pStart !== -1) {
            params = pEnd !== -1 ? rest.substring(pStart + 1, pEnd).trim() : rest.substring(pStart + 1).trim();
            params = params.replace(/\.\.\.$/, '').trim();
          }
          const retPart = pEnd !== -1 && rest.indexOf(':', pEnd) !== -1 ? rest.substring(rest.indexOf(':', pEnd) + 1).trim() : '';
          msgs.push({
            id: `msg_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
            sequenceNumber: seq || `${i + 1}`,
            functionName: fn || 'msg',
            parameters: params,
            returnType: retPart,
            direction: isReverse ? 'reverse' : 'forward',
            isReturn: isReverse,
            color: this.getGroupColor(seq),
            orderIndex: i,
          });
        }
      }
    }
    return msgs;
  }

  public static getGroupColor(sequenceNumber?: string): string {
    const match = (sequenceNumber || '').trim().match(/^(\d+)/);
    const g = match ? parseInt(match[1], 10) : 1;
    const palette = [
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
    return palette[(Math.max(1, g) - 1) % palette.length];
  }

  public static compareSequenceNumbers(seqA?: string, seqB?: string): number {
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
