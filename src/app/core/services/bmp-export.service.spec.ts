import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BmpExportService } from './bmp-export.service';
import { ToastService } from './toast.service';
import { UmlClassNode, UmlConnection } from '../models/diagram.model';

describe('BmpExportService', () => {
  let service: BmpExportService;
  let mockToastService: ToastService;

  beforeEach(() => {
    mockToastService = {
      warning: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
      info: vi.fn(),
    } as unknown as ToastService;
    service = new BmpExportService(mockToastService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('debe crearse correctamente', () => {
    expect(service).toBeTruthy();
  });

  describe('getDiagramPrefix', () => {
    it('debe retornar el prefijo canónico correcto para todos los tipos de diagramas UML', () => {
      // Clases
      expect(service.getDiagramPrefix('class')).toBe('class');
      expect(service.getDiagramPrefix('clase')).toBe('class');
      expect(service.getDiagramPrefix()).toBe('class');

      // Casos de uso
      expect(service.getDiagramPrefix('use_case')).toBe('uc');
      expect(service.getDiagramPrefix('use-case')).toBe('uc');
      expect(service.getDiagramPrefix('uc')).toBe('uc');
      expect(service.getDiagramPrefix('casos_de_uso')).toBe('uc');

      // Secuencia
      expect(service.getDiagramPrefix('sequence')).toBe('sd');
      expect(service.getDiagramPrefix('secuencia')).toBe('sd');
      expect(service.getDiagramPrefix('sd')).toBe('sd');

      // Comunicación
      expect(service.getDiagramPrefix('communication')).toBe('comm');
      expect(service.getDiagramPrefix('comunicacion')).toBe('comm');
      expect(service.getDiagramPrefix('comm')).toBe('comm');

      // Paquetes
      expect(service.getDiagramPrefix('package')).toBe('pkg');
      expect(service.getDiagramPrefix('paquetes')).toBe('pkg');
      expect(service.getDiagramPrefix('pkg')).toBe('pkg');

      // Componentes
      expect(service.getDiagramPrefix('component')).toBe('cmp');
      expect(service.getDiagramPrefix('componente')).toBe('cmp');
      expect(service.getDiagramPrefix('cmp')).toBe('cmp');

      // Despliegue
      expect(service.getDiagramPrefix('deployment')).toBe('dep');
      expect(service.getDiagramPrefix('despliegue')).toBe('dep');
      expect(service.getDiagramPrefix('dep')).toBe('dep');

      // Capas
      expect(service.getDiagramPrefix('layered')).toBe('layered');
      expect(service.getDiagramPrefix('capas')).toBe('layered');
      expect(service.getDiagramPrefix('arch')).toBe('layered');

      // Análisis de Clases
      expect(service.getDiagramPrefix('class_analysis')).toBe('analysis');
      expect(service.getDiagramPrefix('analysis')).toBe('analysis');
      expect(service.getDiagramPrefix('analisis')).toBe('analysis');
    });
  });

  it('debe alertar con toast si no hay nodos válidos', () => {
    service.exportToBmp([], [], 'test');
    expect(mockToastService.warning).toHaveBeenCalledWith('No hay elementos en el diagrama para exportar.');
  });

  it('debe codificar un ImageData en un ArrayBuffer BMP válido con encabezado BM', () => {
    const width = 10;
    const height = 10;
    const dummyData = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < dummyData.length; i += 4) {
      dummyData[i] = 255;     // R
      dummyData[i + 1] = 0;   // G
      dummyData[i + 2] = 0;   // B
      dummyData[i + 3] = 255; // A
    }

    const mockImageData = {
      width,
      height,
      data: dummyData,
      colorSpace: 'srgb',
    } as unknown as ImageData;

    const buffer = service.convertImageDataToBmp(mockImageData);
    expect(buffer).toBeInstanceOf(ArrayBuffer);

    const view = new DataView(buffer);
    // Firma 'BM'
    expect(view.getUint8(0)).toBe(0x42);
    expect(view.getUint8(1)).toBe(0x4d);
    // Tamaño del header BITMAPINFOHEADER (40)
    expect(view.getUint32(14, true)).toBe(40);
    // Dimensiones
    expect(view.getInt32(18, true)).toBe(10);
    expect(view.getInt32(22, true)).toBe(10);
    // Bits por pixel (24)
    expect(view.getUint16(28, true)).toBe(24);
  });

  it('debe generar y descargar un archivo BMP con nodos y conexiones', async () => {
    const mockNodes: UmlClassNode[] = [
      {
        id: 'node_1',
        name: 'Cliente',
        position: { x: 100, y: 100 },
        width: 220,
        attributes: [
          { name: 'id', type: 'UUID' },
          { name: 'nombre', type: 'String' },
        ],
        methods: [],
      },
      {
        id: 'node_2',
        name: 'Venta',
        position: { x: 450, y: 100 },
        width: 220,
        attributes: [
          { name: 'id', type: 'UUID' },
          { name: 'total', type: 'Double' },
        ],
        methods: [],
      },
    ];

    const mockConnections: UmlConnection[] = [
      {
        id: 'conn_1',
        sourceNodeId: 'node_1',
        targetNodeId: 'node_2',
        sourceId: 'node_1_right',
        targetId: 'node_2_left',
        type: 'association',
        name: 'realiza',
        sourceMultiplicity: '1',
        targetMultiplicity: '0..*',
      },
    ];

    const clickSpy = vi.fn();
    const origCreateElement = document.createElement.bind(document);

    vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:http://localhost/dummy');
    vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        const dummyCanvas = origCreateElement('canvas');
        dummyCanvas.getContext = vi.fn().mockReturnValue({
          scale: vi.fn(),
          fillRect: vi.fn(),
          strokeRect: vi.fn(),
          rect: vi.fn(),
          beginPath: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          stroke: vi.fn(),
          fillText: vi.fn(),
          fill: vi.fn(),
          closePath: vi.fn(),
          roundRect: vi.fn(),
          save: vi.fn(),
          restore: vi.fn(),
          setLineDash: vi.fn(),
          arc: vi.fn(),
          measureText: vi.fn().mockReturnValue({ width: 30 }),
          getImageData: vi.fn().mockReturnValue({
            width: 100,
            height: 100,
            data: new Uint8ClampedArray(100 * 100 * 4),
          }),
        });
        return dummyCanvas;
      }
      if (tag === 'a') {
        const link = origCreateElement('a');
        link.click = clickSpy;
        return link;
      }
      return origCreateElement(tag);
    });

    await service.exportToBmp(mockNodes, mockConnections, 'Mi Diagrama Ferreteria');

    expect(clickSpy).toHaveBeenCalled();
  });

  it('debe dibujar correctamente una relación assembly (ball and socket) en canvas fallback', async () => {
    const mockNodes: UmlClassNode[] = [
      {
        id: 'cmp_1',
        name: 'login.component.ts',
        position: { x: 50, y: 50 },
        width: 180,
        attributes: [],
        methods: [],
      },
      {
        id: 'cmp_2',
        name: 'auth.controller.ts',
        position: { x: 50, y: 300 },
        width: 180,
        attributes: [],
        methods: [],
      },
    ];

    const mockConnections: UmlConnection[] = [
      {
        id: 'conn_assembly',
        sourceNodeId: 'cmp_1',
        targetNodeId: 'cmp_2',
        sourceId: 'cmp_1_bottom',
        targetId: 'cmp_2_top',
        type: 'assembly',
      },
    ];

    const clickSpy = vi.fn();
    const arcSpy = vi.fn();
    const origCreateElement = document.createElement.bind(document);

    vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:http://localhost/dummy');
    vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        const dummyCanvas = origCreateElement('canvas');
        dummyCanvas.getContext = vi.fn().mockReturnValue({
          scale: vi.fn(),
          fillRect: vi.fn(),
          strokeRect: vi.fn(),
          rect: vi.fn(),
          beginPath: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          stroke: vi.fn(),
          fillText: vi.fn(),
          fill: vi.fn(),
          closePath: vi.fn(),
          roundRect: vi.fn(),
          save: vi.fn(),
          restore: vi.fn(),
          setLineDash: vi.fn(),
          arc: arcSpy,
          measureText: vi.fn().mockReturnValue({ width: 30 }),
          getImageData: vi.fn().mockReturnValue({
            width: 100,
            height: 100,
            data: new Uint8ClampedArray(100 * 100 * 4),
          }),
        });
        return dummyCanvas;
      }
      if (tag === 'a') {
        const link = origCreateElement('a');
        link.click = clickSpy;
        return link;
      }
      return origCreateElement(tag);
    });

    await service.exportToBmp(mockNodes, mockConnections, 'Diagrama Componentes', 'component');

    expect(clickSpy).toHaveBeenCalled();
    // Debe haber llamado a arc al menos 2 veces (1 para la bola y 1 para el socket)
    expect(arcSpy).toHaveBeenCalledTimes(2);
  });

  it('no debe ocultar el círculo del conector Assembly durante la exportación de elemento DOM', async () => {
    const dummyContainer = document.createElement('div');
    const fConn = document.createElement('f-connection');
    fConn.className = 'uml-relation-assembly';
    fConn.innerHTML = `
      <div fConnectionContent class="uml-assembly-connector">
        <svg width="40" height="40">
          <path class="uml-assembly-socket" d="M 20,7 A 13,13 0 0,0 20,33" fill="none" stroke="#94a3b8" />
          <circle class="uml-assembly-circle" cx="20" cy="20" r="10" fill="#ffffff" stroke="#94a3b8" />
        </svg>
      </div>
      <circle class="f-connection-drag-handle" r="5" />
    `;
    dummyContainer.appendChild(fConn);
    document.body.appendChild(dummyContainer);

    let observedBallDisplay: string | undefined;
    let observedBallR: string | null = null;
    let observedDragHandleDisplay: string | undefined;

    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreateElement(tag);
      if (tag === 'canvas') {
        const dummyCanvas = el as HTMLCanvasElement;
        dummyCanvas.getContext = vi.fn().mockReturnValue({
          scale: vi.fn(),
          fillRect: vi.fn(),
          strokeRect: vi.fn(),
          rect: vi.fn(),
          beginPath: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          stroke: vi.fn(),
          fillText: vi.fn(),
          fill: vi.fn(),
          closePath: vi.fn(),
          roundRect: vi.fn(),
          save: vi.fn(),
          restore: vi.fn(),
          setLineDash: vi.fn(),
          arc: vi.fn(),
          drawImage: vi.fn(),
          measureText: vi.fn().mockReturnValue({ width: 30 }),
          getImageData: vi.fn().mockReturnValue({
            width: 100,
            height: 100,
            data: new Uint8ClampedArray(100 * 100 * 4),
          }),
        });
        return dummyCanvas;
      }
      return el;
    });

    const htmlToImage = await import('html-to-image');
    vi.spyOn(htmlToImage, 'toCanvas').mockImplementation(async (el: HTMLElement) => {
      const ball = el.querySelector('.uml-assembly-circle') as SVGCircleElement;
      const handle = el.querySelector('.f-connection-drag-handle') as SVGCircleElement;
      observedBallDisplay = ball?.style.display;
      observedBallR = ball?.getAttribute('r');
      observedDragHandleDisplay = handle?.style.display;

      const c = document.createElement('canvas');
      c.width = 100;
      c.height = 100;
      return c;
    });

    try {
      await service.generateFramedCanvas(dummyContainer, 'Diagrama Cmp', 'component');
      expect(observedBallDisplay).not.toBe('none');
      expect(observedBallR).toBe('10');
      expect(observedDragHandleDisplay).toBe('none');
    } finally {
      document.body.removeChild(dummyContainer);
    }
  });

  describe('encodeImageDataToBmp', () => {
    it('debe codificar un ImageData de forma asíncrona mediante encodeImageDataToBmp', async () => {
      const width = 4;
      const height = 4;
      const data = new Uint8ClampedArray(width * height * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 0;       // R
        data[i + 1] = 255; // G
        data[i + 2] = 0;   // B
        data[i + 3] = 255; // A
      }
      const mockImageData = {
        width,
        height,
        data,
      } as unknown as ImageData;

      const buffer = await service.encodeImageDataToBmp(mockImageData);
      expect(buffer).toBeInstanceOf(ArrayBuffer);

      const view = new DataView(buffer);
      // Validar BM
      expect(view.getUint8(0)).toBe(0x42);
      expect(view.getUint8(1)).toBe(0x4d);
      expect(view.getInt32(18, true)).toBe(width);
      expect(view.getInt32(22, true)).toBe(height);
    });
  });
});
