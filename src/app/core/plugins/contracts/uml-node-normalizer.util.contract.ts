import { UmlClassNode } from '../../models/diagram.model';
import { InjectionToken, inject } from '@angular/core';
import { PluginRegistryService } from '../plugin-registry.service';
import { UmlConnection } from '../../models/diagram.model';
import { DiagramType, UmlMessage, UmlNodeType } from '../../models/diagram.model';
export interface UmlNodeNormalizerUtil {
  isExplicitSizeType(type: string): boolean;
  isNodeTypeCompatible(nodeType: string | undefined, diagramType: DiagramType | string): boolean;
  inferNodeType(
    n: {
      id?: string;
      name?: string;
      nodeType?: UmlNodeType | string;
    },
    options?: {
      isSequence?: boolean;
      diagramType?: string;
      inspectNameForUseCase?: boolean;
    },
  ): UmlNodeType | string;
  resolveNodeColor(
    currentColor: string | null | undefined,
    nodeType: string,
    stereotype?: string | null,
    getDefaultColor?: (nodeType?: any, stereotype?: any) => string,
  ): string | undefined;
  getDefaultDimensions(
    nodeType: string,
    bceDimensions?: {
      width: number;
      height: number;
    },
  ): {
    defaultWidth: number;
    defaultHeight: number | undefined;
  };
  normalizeUmlMessage(m: any, defaultSeq?: string): UmlMessage;
  mapServerDiagramToLocal(
    diagram: any,
    getDefaultColor?: (nodeType?: string, stereotype?: string | null) => string,
    normalizeDataType?: (type: string) => string,
    normalizeReturnType?: (type: string) => string,
  ): {
    nodes: UmlClassNode[];
    connections: UmlConnection[];
  };
  normalizeDraftNode(
    n: UmlClassNode & {
      positionX?: string | number;
      positionY?: string | number;
    },
    isSequence?: boolean,
    getDefaultColor?: (nodeType?: string, stereotype?: string | null) => string,
  ): UmlClassNode;
}
export const UmlNodeNormalizerUtil: InjectionToken<UmlNodeNormalizerUtil> =
  new InjectionToken<UmlNodeNormalizerUtil>('UmlNodeNormalizerUtil', {
    providedIn: 'root',
    factory: () => inject(PluginRegistryService).resolve(UmlNodeNormalizerUtil),
  });
