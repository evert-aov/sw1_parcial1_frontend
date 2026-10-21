import { InjectionToken, inject } from '@angular/core';
import { PluginRegistryService } from '../plugin-registry.service';
import { UmlClassNode, UmlConnection } from '../../models/diagram.model';
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
  convertImageDataToBmp(imageData: ImageData): ArrayBuffer;
}
export const BmpExportService: InjectionToken<BmpExportService> =
  new InjectionToken<BmpExportService>('BmpExportService', {
    providedIn: 'root',
    factory: () => inject(PluginRegistryService).resolve(BmpExportService),
  });
