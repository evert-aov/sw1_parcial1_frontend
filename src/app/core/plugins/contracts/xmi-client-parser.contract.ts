import { InjectionToken, inject } from '@angular/core';
import { PluginRegistryService } from '../plugin-registry.service';
import { UmlClassNode, UmlConnection, UmlLineStyle, UmlMessage } from '../../models/diagram.model';
export interface ParsedDiagramResult {
  name: string;
  diagramType?: string;
  nodes: UmlClassNode[];
  connections: UmlConnection[];
  defaultLineStyle: string;
}
export interface XmiClientParser {
  fixUtf8Mojibake(str: string): string;
  parseCommunicationMessages(rawText?: string): UmlMessage[];
  getGroupColor(sequenceNumber?: string): string;
  compareSequenceNumbers(seqA?: string, seqB?: string): number;
  mapEaModeToLineStyle(mode: string | number | undefined): UmlLineStyle;
  eaColorToHex(val: number): string;
  parse(xmlContent: string): ParsedDiagramResult;
}
export const XmiClientParser: InjectionToken<XmiClientParser> = new InjectionToken<XmiClientParser>(
  'XmiClientParser',
  { providedIn: 'root', factory: () => inject(PluginRegistryService).resolve(XmiClientParser) },
);
