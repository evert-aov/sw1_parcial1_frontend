import { fixUtf8Mojibake } from '../../plugin-sdk/text-decoding';
import { PluginRegistryService } from '../../core/plugins/plugin-registry.service';
import { Injectable, inject } from '@angular/core';
import { XmiClientParser } from '../../core/plugins/contracts/xmi-client-parser.contract';
import { ToastService } from '../../core/services/toast.service';
import {
  DiagramType,
  UmlClassNode,
  UmlConnection,
  UmlLineStyle,
} from '../../core/models/diagram.model';
import { UmlDiagramProject } from '../../core/models/diagram.model';

export interface DiagramImportResult {
  format: 'xmi' | 'json';
  nodes: UmlClassNode[];
  connections: UmlConnection[];
  name?: string;
  diagramType?: DiagramType;
  defaultLineStyle?: UmlLineStyle;
}

@Injectable({
  providedIn: 'root',
})
export class DiagramImportService {
  private readonly registry = inject(PluginRegistryService);
  /** Parser XMI resuelto de forma perezosa a través del registro de plug-ins. */
  private get parser(): XmiClientParser { return this.registry.resolve(XmiClientParser); }
  private readonly toastService?: ToastService | null;

  constructor(toastService?: ToastService) {
    if (toastService !== undefined) {
      this.toastService = toastService;
    } else {
      try {
        this.toastService = inject(ToastService, { optional: true });
      } catch {
        this.toastService = null;
      }
    }
  }
  /**
   * Lee un archivo (.xml, .xmi, .json) detectando su codificación (UTF-8, Windows-1252, ISO-8859-1),
   * y parsea su contenido a nodos y conexiones normalizados.
   */
  async parseFile(
    file: File,
    normalizeDataType: (type: string) => string,
    normalizeReturnType: (type: string) => string,
  ): Promise<DiagramImportResult> {
    const fileName = file.name.toLowerCase();
    const isXmiOrXml = fileName.endsWith('.xml') || fileName.endsWith('.xmi');

    const buffer = await file.arrayBuffer();
    const content = this.decodeContent(buffer);
    const cleanedContent = fixUtf8Mojibake(content);

    if (isXmiOrXml) {
      const ast = this.parser.parse(cleanedContent);
      if (!ast.nodes || ast.nodes.length === 0) {
        throw new Error('El archivo XMI no contiene clases UML legibles.');
      }

      const nodes: UmlClassNode[] = ast.nodes.map((n: any) => {
        const isBce = n.nodeType === 'boundary' || n.nodeType === 'control' || n.nodeType === 'entity';
        return {
          ...n,
          width: n.width || (n.nodeType === 'actor' ? 65 : (n.nodeType === 'use_case' ? 140 : (n.nodeType === 'package' ? 200 : (isBce ? 70 : 220)))),
          height: n.height || (n.nodeType === 'actor' ? 95 : (n.nodeType === 'use_case' ? 60 : (n.nodeType === 'package' ? 120 : (isBce ? 70 : 120)))),
          attributes: (n.attributes || []).map((a: any) => ({
            ...a,
            name: a.name,
            type: normalizeDataType(a.type),
            nullable: a.nullable !== undefined ? a.nullable : true,
            unique: a.unique !== undefined ? a.unique : false,
            length: a.length !== undefined ? a.length : 255,
            defaultValue: a.defaultValue ?? a.default ?? null,
          })),
          methods: (n.methods || []).map((m: any) => ({
            name: m.name,
            parameters: m.parameters || '',
            returnType: normalizeReturnType(m.returnType),
          })),
        };
      });

      return {
        format: 'xmi',
        nodes,
        connections: (ast.connections || []) as UmlConnection[],
        name: ast.name,
        diagramType: ast.diagramType as DiagramType | undefined,
      };
    } else {
      const project = JSON.parse(cleanedContent) as UmlDiagramProject;
      if (!project.nodes || !project.connections) {
        throw new Error('El archivo JSON no contiene un diagrama válido.');
      }

      const nodes: UmlClassNode[] = project.nodes.map((n) => ({
        ...n,
        width: n.width || 220,
        attributes: (n.attributes || []).map((a) => ({
          ...a,
          name: a.name,
          type: normalizeDataType(a.type),
          nullable: a.nullable !== undefined ? a.nullable : true,
          unique: a.unique !== undefined ? a.unique : false,
          length: a.length !== undefined ? a.length : 255,
          defaultValue: a.defaultValue ?? a.default ?? null,
        })),
        methods: (n.methods || []).map((m) => ({
          name: m.name,
          parameters: m.parameters,
          returnType: normalizeReturnType(m.returnType),
        })),
      }));

      return {
        format: 'json',
        nodes,
        connections: project.connections,
        defaultLineStyle: project.defaultLineStyle,
      };
    }
  }

  /**
   * Decodifica el búfer binario de un archivo respetando la codificación declarada (UTF-8, Windows-1252 o ISO-8859-1).
   * @param buffer Búfer binario del archivo leído.
   * @returns Cadena de texto decodificada correctamente.
   */
  private decodeContent(buffer: ArrayBuffer): string {
    const headerBytes = new Uint8Array(buffer.slice(0, Math.min(buffer.byteLength, 300)));
    const asciiHeader = String.fromCharCode(...headerBytes);
    const match = asciiHeader.match(/encoding=["']([^"']+)["']/i);
    const declaredEncoding = match ? match[1].toLowerCase() : '';

    if (declaredEncoding.includes('1252') || declaredEncoding.includes('ansi')) {
      try {
        return new TextDecoder('windows-1252').decode(buffer);
      } catch {
        return new TextDecoder('utf-8').decode(buffer);
      }
    } else if (declaredEncoding.includes('8859-1')) {
      try {
        return new TextDecoder('iso-8859-1').decode(buffer);
      } catch {
        return new TextDecoder('utf-8').decode(buffer);
      }
    } else {
      try {
        return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      } catch {
        try {
          return new TextDecoder('windows-1252').decode(buffer);
        } catch {
          return new TextDecoder('utf-8').decode(buffer);
        }
      }
    }
  }

  parseJsonProject(
    jsonString: string,
    normalizeDataType: (type: string) => string,
    normalizeReturnType: (type: string) => string,
  ): DiagramImportResult {
    const project = JSON.parse(jsonString) as UmlDiagramProject;
    if (!project.nodes || !project.connections) {
      throw new Error('Estructura JSON inválida: faltan nodos o conexiones.');
    }
    const nodes: UmlClassNode[] = project.nodes.map((n) => ({
      ...n,
      width: n.width || 220,
      attributes: (n.attributes || []).map((a) => ({
        ...a,
        name: a.name,
        type: normalizeDataType(a.type),
        nullable: a.nullable !== undefined ? a.nullable : true,
        unique: a.unique !== undefined ? a.unique : false,
        length: a.length !== undefined ? a.length : 255,
        defaultValue: a.defaultValue ?? (a as any).default ?? null,
      })),
      methods: (n.methods || []).map((m) => ({
        name: m.name,
        parameters: m.parameters,
        returnType: normalizeReturnType(m.returnType),
      })),
    }));
    return {
      format: 'json',
      nodes,
      connections: project.connections,
      defaultLineStyle: project.defaultLineStyle,
    };
  }

  /**
   * Ejecuta el proceso de importación desde una cadena de texto en formato JSON.
   * @param options Opciones de validación, permisos y callback de éxito.
   */
  executeJsonImport(options: {
    jsonString: string;
    isReadOnly: boolean;
    hasMultipleActiveUsers: boolean;
    multiUserBlockedMsg: string;
    normalizeDataType: (type: string) => string;
    normalizeReturnType: (type: string) => string;
    onSuccess: (result: DiagramImportResult) => void;
  }): void {
    const { isReadOnly, hasMultipleActiveUsers, multiUserBlockedMsg, jsonString, normalizeDataType, normalizeReturnType, onSuccess } = options;
    if (isReadOnly) return;
    if (hasMultipleActiveUsers) {
      this.toastService?.warning(multiUserBlockedMsg);
      return;
    }
    try {
      const result = this.parseJsonProject(jsonString, normalizeDataType, normalizeReturnType);
      onSuccess(result);
    } catch (e: any) {
      this.toastService?.error('Error en el formato JSON: ' + (e?.message || e));
    }
  }

  /**
   * Ejecuta la lectura e importación de un archivo desde un evento input HTML.
   * @param options Configuración de evento, control concurrente y callback.
   */
  async executeFileImport(options: {
    event: Event;
    isReadOnly: boolean;
    hasMultipleActiveUsers: boolean;
    multiUserBlockedMsg: string;
    normalizeDataType: (type: string) => string;
    normalizeReturnType: (type: string) => string;
    onSuccess: (result: DiagramImportResult) => void;
  }): Promise<void> {
    const { event, isReadOnly, hasMultipleActiveUsers, multiUserBlockedMsg, normalizeDataType, normalizeReturnType, onSuccess } = options;
    if (isReadOnly) return;
    const target = event.target as HTMLInputElement;
    if (hasMultipleActiveUsers) {
      this.toastService?.warning(multiUserBlockedMsg);
      if (target) target.value = '';
      return;
    }
    const file = target?.files?.[0];
    if (!file) return;

    try {
      const result = await this.parseFile(file, normalizeDataType, normalizeReturnType);
      onSuccess(result);
    } catch (err: any) {
      this.toastService?.error('Error al leer el archivo: ' + (err.message || err));
    } finally {
      if (target) target.value = '';
    }
  }
}
