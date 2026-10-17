import { UmlClassNode, UmlConnection, UmlLineStyle } from '../../models/diagram.model';
import { XmiBehaviorParser } from './xmi-behavior-parser';
import { XmiDiagramLayoutParser } from './xmi-diagram-layout-parser';
import { XmiStringUtils } from './xmi-string-utils';

export class XmiConnectorParser {
  /**
   * Resuelve el ID del nodo reconciliando discrepancias entre prefijos EA (EAPK_ vs EAID_).
   */
  public static resolveNodeId(
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

  /**
   * Extrae la multiplicidad en notación UML (ej: 0..1, 1..*, 0..*, *) a partir de los extremos de asociación.
   */
  public static extractMult(endElem: any): string {
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

  /**
   * Parsea una asociación estándar UML (uml:Association).
   */
  public static parseAssociation(
    assocElem: any,
    nodeMap: Map<string, any>,
    labelsMap: Map<string, any>,
    connLineStyleMap?: Map<string, UmlLineStyle>,
  ): UmlConnection | null {
    const id = assocElem['@_xmi:id'] || assocElem['@_id'] || `conn_${Date.now()}`;
    const name = XmiStringUtils.fixUtf8Mojibake(assocElem['@_name'] || '');

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
    const cleanConnName = XmiStringUtils.fixUtf8Mojibake(rawConnName || '');
    const commMsgs = XmiBehaviorParser.parseCommunicationMessages(cleanConnName);

    return {
      id,
      sourceNodeId,
      targetNodeId,
      sourceId: `${sourceNodeId}_right`,
      targetId: `${targetNodeId}_left`,
      type,
      name: commMsgs.length > 0 ? undefined : cleanConnName || undefined,
      sourceMultiplicity: sMult || '',
      targetMultiplicity: tMult || '',
      lineStyle,
      messages: commMsgs.length > 0 ? commMsgs : undefined,
    };
  }

  /**
   * Parsea relaciones de generalización / herencia (uml:Generalization).
   */
  public static parseGeneralizations(
    classElem: any,
    nodeMap: Map<string, any>,
    connLineStyleMap?: Map<string, UmlLineStyle>,
  ): UmlConnection[] {
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

  /**
   * Parsea relaciones de casos de uso (extend, include, generalization).
   */
  public static parseUseCaseRelationships(
    ucElem: any,
    nodeMap: Map<string, any>,
    connLineStyleMap?: Map<string, UmlLineStyle>,
  ): UmlConnection[] {
    const conns: UmlConnection[] = [];
    const sourceId = ucElem['@_xmi:id'] || ucElem['@_id'];
    if (!sourceId || !nodeMap.has(sourceId)) return conns;

    // A) Extend
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

    // B) Include
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

    // C) Generalization
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

  /**
   * Parsea dependencias UML estándar (uml:Dependency, import, access, merge, trace).
   */
  public static parseDependency(
    depElem: any,
    nodeMap: Map<string, UmlClassNode>,
    connectorLabelsMap?: Map<string, { name?: string; sMult?: string; tMult?: string }>,
  ): UmlConnection | null {
    const id =
      depElem['@_xmi:id'] ||
      depElem['@_id'] ||
      `dep_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const name = XmiStringUtils.fixUtf8Mojibake(depElem['@_name'] || '');

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

  /**
   * Parsea relaciones entre paquetes (PackageImport, PackageMerge, Dependency).
   */
  public static parsePackageRelationships(
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

  /**
   * Parsea conectores explícitos UML (uml:Connector - assembly/asociación).
   */
  public static parseUmlConnector(
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
    const kind = elem['@_kind'];
    const type = kind === 'assembly' ? 'assembly' : 'association';
    return {
      id,
      sourceNodeId: s,
      targetNodeId: t,
      sourceId: `${s}_right`,
      targetId: `${t}_left`,
      type,
      sourceMultiplicity: '',
      targetMultiplicity: '',
      lineStyle,
    };
  }

  /**
   * Extrae conectores enriquecidos desde <xmi:Extension><connectors> de Enterprise Architect.
   */
  public static extractEaConnectors(
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
    const umlMessages = XmiBehaviorParser.collectUmlMessages(xmiRoot['uml:Model'] || xmiRoot['Model']);
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
        const label = XmiStringUtils.fixUtf8Mojibake(String(rawName)).trim();
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
        const type = isReply
          ? 'reply'
          : callKind.includes('create') || priv1.includes('create') || messageSort === 'createMessage'
            ? 'create'
            : priv1.includes('asynch') || messageSort === 'asynchCall' || messageSort === 'asynchSignal'
              ? 'async'
              : 'sync';

        const seqNo =
          sequenceOrderMap.get(id) ??
          XmiBehaviorParser.readSequenceOrder(extProps['@_privatedata5']) ??
          XmiBehaviorParser.readSequenceOrder(c['appearance']?.['@_seqno']) ??
          sequenceConnList.length;

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
          parameters = args
            .map((arg: any) =>
              XmiStringUtils.fixUtf8Mojibake(
                String(arg['@_value'] ?? arg['@_name'] ?? arg['#text'] ?? ''),
              ).trim(),
            )
            .join(', ');
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
      let name = labels['@_mb'] ? XmiStringUtils.fixUtf8Mojibake(labels['@_mb']) : undefined;

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
      } else if (eaType === 'Assembly' || eaStereo === 'assembly' || eaSubtype === 'assembly') {
        type = 'assembly';
      }

      const sMult = labels['@_lb'] || '';
      const tMult = labels['@_rb'] || '';

      const appearance = c['appearance'] || {};
      const linemode = appearance['@_linemode'];
      const style = connLineStyleMap?.get(id) || XmiDiagramLayoutParser.mapEaModeToLineStyle(linemode);
      const cleanConnName = name ? XmiStringUtils.fixUtf8Mojibake(name) : undefined;
      const commMsgs = XmiBehaviorParser.parseCommunicationMessages(cleanConnName);

      conns.push({
        id,
        sourceNodeId: sourceId,
        targetNodeId: targetId,
        sourceId: `${sourceId}_right`,
        targetId: `${targetId}_left`,
        type,
        name: commMsgs.length > 0 ? undefined : cleanConnName || undefined,
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
        const groupedNumber = child === 0 ? `${group}` : `${group}.${child}`;
        const seqNumStr = hasHierarchicalLabels ? item.sequenceNumber ?? groupedNumber : groupedNumber;
        const type = item.type;
        const connColor = XmiBehaviorParser.getGroupColor(seqNumStr);

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
        const parsedMsgs = XmiBehaviorParser.parseCommunicationMessages(collab.rawLabel);
        if (parsedMsgs.length > 0) {
          for (const pm of parsedMsgs) {
            if (collab.seqNum) pm.sequenceNumber = collab.seqNum;
            const isRev = collab.isReturn || collab.sourceId === baseConn.targetNodeId;
            pm.direction = isRev ? 'reverse' : 'forward';
            pm.isReturn = isRev;
            if (!pm.color || collab.seqNum) {
              pm.color = XmiBehaviorParser.getGroupColor(pm.sequenceNumber);
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
            XmiBehaviorParser.compareSequenceNumbers(a.sequenceNumber, b.sequenceNumber),
          );
        }
      }
    }

    return conns;
  }

  /**
   * Reconstruye tablas intermedias y clases de asociación (uml:AssociationClass) con nodo ancla y enlace discontinuo.
   */
  public static resolveAssociationClasses(
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
        mainConn = connections.find((c) => c.id === pair.mainConnId);
      }
      if (!mainConn && pair.sourceId && pair.targetId) {
        mainConn = connections.find(
          (c) =>
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
}
