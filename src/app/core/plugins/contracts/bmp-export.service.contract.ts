import { InjectionToken, inject } from '@angular/core';
import { PluginRegistryService } from '../plugin-registry.service';
import { UmlClassNode, UmlConnection, UmlLineStyle } from '../../models/diagram.model';
import { ToastService } from '../../services/toast.service';
export interface BmpExportService {
  encodeImageDataToBmp(imageData: ImageData): Promise<ArrayBuffer>;
  exportElementToBmp(
    element: HTMLElement,
    diagramName?: string,
    diagramType?: string,
  ): Promise<void>;
  exportElementToPng(
    element: HTMLElement,
    diagramName?: string,
    diagramType?: string,
  ): Promise<void>;
  exportElementToSvg(
    element: HTMLElement,
    diagramName?: string,
    diagramType?: string,
  ): Promise<void>;
  generateFramedCanvas(
    element: HTMLElement,
    diagramName?: string,
    diagramType?: string,
  ): Promise<HTMLCanvasElement>;
  getDiagramPrefix(diagramType?: string): string;
  exportToBmp(
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    diagramName?: string,
    diagramType?: string,
  ): Promise<void>;
  exportToPng(
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    diagramName?: string,
    diagramType?: string,
  ): void;
  exportToSvg(
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    diagramName?: string,
    diagramType?: string,
  ): void;
  generateSvgString(
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    diagramName?: string,
    diagramType?: string,
  ): string;
  generatePngBlob(
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    diagramName?: string,
    diagramType?: string,
    element?: HTMLElement,
  ): Promise<Blob | null>;
  exportProjectImagesToZip(
    diagrams: Array<{
      id?: string;
      name: string;
      type?: string;
      defaultLineStyle?: UmlLineStyle;
      captureCanvas?: boolean;
      nodes: UmlClassNode[];
      connections: UmlConnection[];
    }>,
    format: 'png' | 'svg',
    projectName?: string,
    activeDiagramCanvas?: HTMLElement,
    activeDiagramId?: string,
    captureDiagram?: (index: number) => Promise<{ element: HTMLElement; dispose: () => void }>,
  ): Promise<void>;
  convertImageDataToBmp(imageData: ImageData): ArrayBuffer;
}
export const BmpExportService: InjectionToken<BmpExportService> =
  new InjectionToken<BmpExportService>('BmpExportService', {
    providedIn: 'root',
    factory: () => inject(PluginRegistryService).resolve(BmpExportService),
  });
