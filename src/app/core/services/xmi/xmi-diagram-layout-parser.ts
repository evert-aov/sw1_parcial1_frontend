import { UmlLineStyle } from '../../models/diagram.model';
import { XmiStringUtils } from './xmi-string-utils';

export interface EaElementMeta {
  sType?: string;
  stereotype?: string;
  name?: string;
  color?: string;
  documentation?: string;
}

export interface EaGeometryInfo {
  left: number;
  top: number;
  width: number;
  height: number;
  color?: string;
}

export interface EaDiagramMeta {
  name?: string;
  type?: string;
}

export class XmiDiagramLayoutParser {
  /**
   * Mapea el valor numérico o textual de linemode de Enterprise Architect al estilo de línea del editor.
   */
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

  /**
   * Extrae metadatos de elementos desde <xmi:Extension><elements> y perfiles UML personalizados en EA.
   */
  public static extractEaElementMeta(xmiRoot: any): Map<string, EaElementMeta> {
    const metaMap = new Map<string, EaElementMeta>();
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
        const name = el['@_name'] ? XmiStringUtils.fixUtf8Mojibake(el['@_name']) : undefined;
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
              color = XmiStringUtils.eaColorToHex(val);
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
              entry['@_base_Component'] ||
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

  /**
   * Extrae geometrías espaciales, estilos y orden de diagramas desde <xmi:Extension><diagrams><diagram>.
   */
  public static extractGeometry(
    xmiRoot: any,
    geometryMap: Map<string, EaGeometryInfo>,
    labelsMap: Map<string, any>,
    connLineStyleMap?: Map<string, UmlLineStyle>,
    diagramMetaRef?: EaDiagramMeta,
    sequenceOrderMap?: Map<string, number>,
    readSequenceOrderFn?: (raw: unknown) => number | undefined,
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
      if (readSequenceOrderFn) {
        const sequenceOrder = readSequenceOrderFn(geometry);
        if (subject && sequenceOrder !== undefined) {
          sequenceOrderMap?.set(subject, sequenceOrder);
        }
      }

      let color: string | undefined;
      if (style) {
        const bcolMatch = style.match(/BCol=(-?\d+)/);
        if (bcolMatch && bcolMatch[1] !== '-1' && bcolMatch[1] !== '0') {
          const val = parseInt(bcolMatch[1], 10);
          if (!isNaN(val) && val > 0) {
            color = XmiStringUtils.eaColorToHex(val);
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
}
