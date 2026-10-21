import { UmlAttribute, UmlClassNode, UmlMethod, UmlStereotype } from '../../../core/models/diagram.model';
import { EaElementMeta, EaGeometryInfo } from './xmi-diagram-layout-parser';
import { XmiStringUtils } from './xmi-string-utils';

export class XmiClassifierParser {
  /**
   * Recolecta recursivamente todos los elementos empaquetados en el modelo UML.
   */
  public static collectPackagedElements(modelRoot: any): any[] {
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

  /**
   * Extrae atributos de una clase u objeto UML.
   */
  public static extractAttributes(classElem: any): UmlAttribute[] {
    const attrs: UmlAttribute[] = [];
    const owned = classElem['ownedAttribute'] || classElem['attribute'];
    if (!owned) return attrs;

    const rawList = Array.isArray(owned) ? owned : [owned];
    for (const raw of rawList) {
      const name = raw['@_name'];
      if (!name) continue;

      let type = 'String';
      const typeElem = raw['type'];
      if (typeElem) {
        if (typeElem['@_xmi:idref']) type = XmiStringUtils.cleanTypeName(typeElem['@_xmi:idref']);
        else if (typeElem['@_name']) type = typeElem['@_name'];
        else if (typeof typeElem === 'string') type = XmiStringUtils.cleanTypeName(typeElem);
      } else if (raw['@_type']) {
        type = XmiStringUtils.cleanTypeName(raw['@_type']);
      }

      attrs.push({
        name: XmiStringUtils.fixUtf8Mojibake(name),
        type: XmiStringUtils.mapType(type),
        visibility: raw['@_visibility'] || 'private',
        isPk: name.toLowerCase().endsWith('id') || name.toLowerCase() === 'id',
        isNullable: false,
        nullable: false,
      });
    }

    return attrs;
  }

  /**
   * Extrae métodos y operaciones de una clase u objeto UML.
   */
  public static extractMethods(classElem: any): UmlMethod[] {
    const methods: UmlMethod[] = [];
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

          if (p['type'] && p['type']['@_xmi:idref']) pType = XmiStringUtils.cleanTypeName(p['type']['@_xmi:idref']);
          else if (p['@_type']) pType = XmiStringUtils.cleanTypeName(p['@_type']);

          pType = XmiStringUtils.mapType(pType);

          if (pDirection === 'return' || pName === 'return') {
            returnType = pType;
          } else {
            params.push(`${XmiStringUtils.fixUtf8Mojibake(pName)}: ${pType}`);
          }
        }
      }

      methods.push({
        name: XmiStringUtils.fixUtf8Mojibake(name),
        returnType,
        parameters: params.join(', '),
        visibility: raw['@_visibility'] || 'public',
      });
    }

    return methods;
  }

  /**
   * Construye el mapa de nodos (`UmlClassNode`) a partir de los elementos XMI y metadatos de Enterprise Architect.
   */
  public static extractClassifiers(
    rawElements: any[],
    geometryMap: Map<string, EaGeometryInfo>,
    eaElementMetaMap: Map<string, EaElementMeta>,
  ): Map<string, UmlClassNode> {
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
          name: XmiStringUtils.fixUtf8Mojibake(name || `Actor_${gridIdx + 1}`).trim(),
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
        const cleanName = XmiStringUtils.fixUtf8Mojibake(name || `CU_${gridIdx + 1}`).trim();
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
        const cleanName = XmiStringUtils.fixUtf8Mojibake(name || meta?.name || `Lifeline_${gridIdx + 1}`).trim();
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
        const hasPkgGeo =
          geometryMap.has(id) ||
          geometryMap.has(id.replace('EAPK_', 'EAID_')) ||
          geometryMap.has(id.replace('EAID_', 'EAPK_'));

        if (geometryMap.size > 0 && !hasPkgGeo) {
          continue;
        }

        if (geometryMap.size === 0) {
          if (!hasPkgGeo && (!name || name === 'Model' || name === 'EA_PrimitiveTypes_Package' || elem['packagedElement'])) {
            continue;
          }
        }

        const cleanName = XmiStringUtils.fixUtf8Mojibake(name || meta?.name || `Package_${gridIdx + 1}`).trim();
        let pos = {
          x: 80 + (gridIdx % 3) * 280,
          y: 80 + Math.floor(gridIdx / 3) * 220,
        };
        let width = 200;
        let height = 120;

        if (hasPkgGeo) {
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

      // E) Componentes UML (Diagramas de Componentes)
      if (type === 'uml:Component' || type === 'Component') {
        if (geometryMap.size > 0 && !hasGeo) {
          continue;
        }

        const meta = eaElementMetaMap.get(id);
        const cleanName = XmiStringUtils.fixUtf8Mojibake(name || meta?.name || `Componente_${gridIdx + 1}`).trim();
        let pos = {
          x: 80 + (gridIdx % 3) * 280,
          y: 80 + Math.floor(gridIdx / 3) * 220,
        };
        let width = 190;
        let height = 70;

        if (geometryMap.has(id)) {
          const g = geometryMap.get(id)!;
          pos = { x: g.left, y: g.top };
          if (g.width > 20) width = g.width;
          if (g.height > 20) height = g.height;
        }

        const customCompColor = geometryMap.get(id)?.color || meta?.color;
        const node: UmlClassNode = {
          id,
          name: cleanName,
          position: pos,
          width,
          height,
          nodeType: 'component',
          stereotype: meta?.stereotype || null,
          color: customCompColor || '#FAF1EC',
          attributes: [],
          methods: [],
          isAnchor: false,
        };

        nodeMap.set(id, node);
        gridIdx++;
        continue;
      }

      // F) Clases UML, Objetos e InstanceSpecifications (BCE / Robustez)
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

        if (meta?.sType === 'Text' || (name && name.startsWith('Package : '))) {
          const rawDoc = meta?.documentation || name;
          if (rawDoc && rawDoc !== 'undefined' && !rawDoc.startsWith('Package : ')) {
            const cleanDoc = XmiStringUtils.fixUtf8Mojibake(rawDoc).trim();
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
            name: XmiStringUtils.fixUtf8Mojibake(name || meta?.name || `Actor_${gridIdx + 1}`).trim(),
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
          const cleanName = XmiStringUtils.fixUtf8Mojibake(name || meta?.name || `CU_${gridIdx + 1}`).trim();
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

        if (meta?.sType === 'Component') {
          if (geometryMap.size > 0 && !hasGeo) {
            continue;
          }

          let pos = { x: 80 + (gridIdx % 3) * 280, y: 80 + Math.floor(gridIdx / 3) * 220 };
          let width = 190;
          let height = 70;

          if (geometryMap.has(id)) {
            const g = geometryMap.get(id)!;
            pos = { x: g.left, y: g.top };
            if (g.width > 20) width = g.width;
            if (g.height > 20) height = g.height;
          }

          const customCompColor = geometryMap.get(id)?.color || meta?.color;
          const node: UmlClassNode = {
            id,
            name: XmiStringUtils.fixUtf8Mojibake(name || meta?.name || `Componente_${gridIdx + 1}`).trim(),
            position: pos,
            width,
            height,
            nodeType: 'component',
            stereotype: meta?.stereotype || null,
            color: customCompColor || '#FAF1EC',
            attributes: [],
            methods: [],
            isAnchor: false,
          };

          nodeMap.set(id, node);
          gridIdx++;
          continue;
        }

        if (meta?.sType === 'Boundary') {
          if (geometryMap.size > 0 && !hasGeo) {
            continue;
          }

          let pos = { x: 80 + (gridIdx % 3) * 280, y: 80 + Math.floor(gridIdx / 3) * 220 };
          let width = 280;
          let height = 200;

          if (geometryMap.has(id)) {
            const g = geometryMap.get(id)!;
            pos = { x: g.left, y: g.top };
            if (g.width > 20) width = g.width;
            if (g.height > 20) height = g.height;
          }

          const customBBoxColor = geometryMap.get(id)?.color || meta?.color;
          const node: UmlClassNode = {
            id,
            name: XmiStringUtils.fixUtf8Mojibake(name || meta?.name || `BoundaryBox_${gridIdx + 1}`).trim(),
            position: pos,
            width,
            height,
            nodeType: 'boundary_box',
            stereotype: null,
            color: customBBoxColor || '#FAF8F5',
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
        const defaultClassColor =
          nodeType === 'boundary' || nodeType === 'control' || nodeType === 'entity' ? '#DDF4F5' : '#FDFAF3';
        const node: UmlClassNode = {
          id,
          name: XmiStringUtils.fixUtf8Mojibake(name || meta?.name || `Clase_${gridIdx + 1}`).trim(),
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

    // Elementos declarados en extensión EA no presentes en packagedElements
    for (const [eId, meta] of eaElementMetaMap.entries()) {
      if (meta.sType === 'Text') {
        const rawDoc = meta.documentation || meta.name;
        if (rawDoc && rawDoc !== 'undefined' && !rawDoc.startsWith('Package : ')) {
          const cleanDoc = XmiStringUtils.fixUtf8Mojibake(rawDoc).trim();
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
          meta.sType === 'Component' ||
          meta.sType === 'Boundary' ||
          meta.sType === 'Object' ||
          meta.sType === 'Sequence' ||
          meta.sType === 'Package')
      ) {
        const isActor = meta.sType === 'Actor';
        const isUseCase = meta.sType === 'UseCase';
        const isComponent = meta.sType === 'Component';
        const isBoundary = meta.sType === 'Boundary';
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
        const cleanName = XmiStringUtils.fixUtf8Mojibake(
          meta.name ||
            (isActor
              ? `Actor_${gridIdx + 1}`
              : isUseCase
                ? `CU_${gridIdx + 1}`
                : isComponent
                  ? `Componente_${gridIdx + 1}`
                  : isBoundary
                    ? `BoundaryBox_${gridIdx + 1}`
                    : isSequence
                      ? `Lifeline_${gridIdx + 1}`
                      : isPackage
                        ? `Package_${gridIdx + 1}`
                        : `Clase_${gridIdx + 1}`),
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
        } else if (isComponent) {
          width = 190;
          height = 70;
        } else if (isBoundary) {
          width = 280;
          height = 200;
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
          if (geoObj.width > 20) {
            width = isUseCase ? Math.max(width, geoObj.width) : isSequence ? Math.max(90, geoObj.width) : geoObj.width;
          }
          if (geoObj.height > 20) {
            height = isUseCase ? Math.max(height, geoObj.height) : isSequence ? 60 : geoObj.height;
          }
        }

        let nodeType: any = isActor
          ? 'actor'
          : isUseCase
            ? 'use_case'
            : isComponent
              ? 'component'
              : isBoundary
                ? 'boundary_box'
                : isSequence
                  ? 'lifeline'
                  : isPackage
                    ? 'package'
                    : 'class';
        let stereotype: string | null = null;
        if (!isActor && !isUseCase && !isComponent && !isBoundary && !isSequence && !isPackage) {
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
        } else if (isPackage || isComponent) {
          stereotype = meta.stereotype || null;
        }

        let defaultExtColor = isActor
          ? '#FEF2DD'
          : isUseCase
            ? '#E5F2FE'
            : isPackage || isComponent
              ? '#FAF1EC'
              : isBoundary
                ? '#FAF8F5'
                : nodeType === 'boundary' || nodeType === 'control' || nodeType === 'entity'
                  ? '#DDF4F5'
                  : '#FDFAF3';
        if (isSequence) {
          defaultExtColor = '#DDF4F5';
        }

        const customExtColor =
          geometryMap.get(eId)?.color ||
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

    return nodeMap;
  }
}
