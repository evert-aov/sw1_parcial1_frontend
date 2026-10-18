import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiagramExportService } from './diagram-export.service';
import { BmpExportService } from '../../../../core/services/bmp-export.service';
import { ToastService } from '../../../../core/services/toast.service';
import { DiagramType, UmlClassNode, UmlConnection } from '../../../../core/models/diagram.model';
import { DiagramCanvasComponent } from '../components/diagram-canvas/diagram-canvas.component';

describe('DiagramExportService', () => {
  let service: DiagramExportService;
  let mockBmpService: BmpExportService;
  let mockToastService: ToastService;

  beforeEach(() => {
    mockBmpService = {
      exportCanvasToPng: vi.fn().mockResolvedValue(undefined),
      exportCanvasToBmp: vi.fn().mockResolvedValue(undefined),
      exportElementToPng: vi.fn().mockResolvedValue(undefined),
      exportElementToBmp: vi.fn().mockResolvedValue(undefined),
      exportToPng: vi.fn(),
      exportToBmp: vi.fn().mockResolvedValue(undefined),
    } as unknown as BmpExportService;

    mockToastService = {
      warning: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
      info: vi.fn(),
    } as unknown as ToastService;

    service = new DiagramExportService(mockBmpService, {} as any, mockToastService);
  });

  it('debe crearse correctamente', () => {
    expect(service).toBeTruthy();
  });

  describe('exportDiagramImage con Konva native exportContentCanvas', () => {
    it('debe utilizar exportContentCanvas del DiagramCanvasComponent y delegar a exportCanvasToPng para formato PNG', async () => {
      const dummyCanvas = document.createElement('canvas');
      dummyCanvas.width = 600;
      dummyCanvas.height = 400;

      const mockDiagramCanvas = {
        clearSelection: vi.fn(),
        exportContentCanvas: vi.fn().mockReturnValue(dummyCanvas),
      } as unknown as DiagramCanvasComponent;

      const nodes: UmlClassNode[] = [
        { id: '1', name: 'User', width: 200, position: { x: 50, y: 50 }, attributes: [], methods: [] },
      ];
      const connections: UmlConnection[] = [];

      await service.exportDiagramImage(
        mockDiagramCanvas,
        'png',
        'Sistema Autenticación',
        DiagramType.CLASS,
        nodes,
        connections,
      );

      expect(mockDiagramCanvas.clearSelection).toHaveBeenCalled();
      expect(mockDiagramCanvas.exportContentCanvas).toHaveBeenCalledWith(2, 40);
      expect(mockBmpService.exportCanvasToPng).toHaveBeenCalledWith(
        dummyCanvas,
        'Sistema Autenticación',
        DiagramType.CLASS,
      );
      expect(mockBmpService.exportCanvasToBmp).not.toHaveBeenCalled();
    });

    it('debe utilizar exportContentCanvas del DiagramCanvasComponent y delegar a exportCanvasToBmp para formato BMP', async () => {
      const dummyCanvas = document.createElement('canvas');
      dummyCanvas.width = 600;
      dummyCanvas.height = 400;

      const mockDiagramCanvas = {
        clearSelection: vi.fn(),
        exportContentCanvas: vi.fn().mockReturnValue(dummyCanvas),
      } as unknown as DiagramCanvasComponent;

      const nodes: UmlClassNode[] = [
        { id: '1', name: 'User', width: 200, position: { x: 50, y: 50 }, attributes: [], methods: [] },
      ];
      const connections: UmlConnection[] = [];

      await service.exportDiagramImage(
        mockDiagramCanvas,
        'bmp',
        'Sistema Autenticación',
        DiagramType.CLASS,
        nodes,
        connections,
      );

      expect(mockDiagramCanvas.clearSelection).toHaveBeenCalled();
      expect(mockDiagramCanvas.exportContentCanvas).toHaveBeenCalledWith(2, 40);
      expect(mockBmpService.exportCanvasToBmp).toHaveBeenCalledWith(
        dummyCanvas,
        'Sistema Autenticación',
        DiagramType.CLASS,
      );
      expect(mockBmpService.exportCanvasToPng).not.toHaveBeenCalled();
    });

    it('debe alertar con toast de advertencia si no hay nodos en el diagrama', async () => {
      await service.exportDiagramImage(
        undefined,
        'png',
        'Diagrama Vacío',
        DiagramType.CLASS,
        [],
        [],
      );

      expect(mockToastService.warning).toHaveBeenCalledWith('No hay elementos en el diagrama para exportar.');
      expect(mockBmpService.exportCanvasToPng).not.toHaveBeenCalled();
      expect(mockBmpService.exportToPng).not.toHaveBeenCalled();
    });

    it('debe usar fallback exportToPng cuando no hay canvas component', async () => {
      const nodes: UmlClassNode[] = [
        { id: '1', name: 'Order', width: 200, position: { x: 10, y: 10 }, attributes: [], methods: [] },
      ];
      const connections: UmlConnection[] = [];

      await service.exportDiagramImage(
        undefined,
        'png',
        'Pedidos',
        DiagramType.CLASS,
        nodes,
        connections,
      );

      expect(mockBmpService.exportToPng).toHaveBeenCalledWith(nodes, connections, 'Pedidos', DiagramType.CLASS);
    });
  });

  describe('buildProjectJson y downloadJsonFile', () => {
    it('debe construir un objeto JSON exportable válido', () => {
      const nodes: UmlClassNode[] = [
        { id: '1', name: 'Test', width: 200, position: { x: 0, y: 0 }, attributes: [], methods: [] },
      ];
      const connections: UmlConnection[] = [];

      const result = service.buildProjectJson('Proyecto Test', 'solid' as any, nodes, connections);

      expect(result.version).toBe('1.0');
      expect(result.name).toBe('Proyecto Test');
      expect(result.nodes).toEqual(nodes);
      expect(result.connections).toEqual(connections);
    });

    it('debe descargar el archivo JSON con nombre sanitizado', () => {
      const downloadBlobSpy = vi.spyOn(service, 'downloadBlob').mockImplementation(() => {});
      service.downloadJsonFile('Mi Diagrama Ventas', 'solid' as any, [], []);

      expect(downloadBlobSpy).toHaveBeenCalledWith(
        expect.any(Blob),
        'mi_diagrama_ventas_diagrama.json',
      );
    });
  });
});
