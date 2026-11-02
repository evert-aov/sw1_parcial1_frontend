import { TestBed } from '@angular/core/testing';
import { provideEditorPlugins } from './editor-plugins';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BmpExportService } from '../plugins/image-export/bmp-export.service';
import { ToastService } from '../core/services/toast.service';
import { UmlClassNode, UmlConnection } from '../core/models/diagram.model';
import JSZip from 'jszip';

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
    TestBed.configureTestingModule({ providers: [provideEditorPlugins(), { provide: ToastService, useValue: mockToastService }] });
    service = TestBed.runInInjectionContext(() => new BmpExportService(mockToastService));
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

  describe('generateSvgString & exportToSvg', () => {
    const mockNodes: UmlClassNode[] = [
      {
        id: 'c1',
        name: 'Cliente',
        position: { x: 50, y: 50 },
        width: 200,
        attributes: [{ name: 'id', type: 'Integer' }],
        methods: [{ name: 'obtenerNombre', returnType: 'String', parameters: '' }],
      },
      {
        id: 'c2',
        name: 'Pedido',
        position: { x: 350, y: 50 },
        width: 200,
        attributes: [{ name: 'total', type: 'Double' }],
        methods: [],
      },
    ];

    const mockConnections: UmlConnection[] = [
      {
        id: 'rel1',
        sourceId: 'c1',
        targetId: 'c2',
        type: 'association',
        name: 'realiza',
        sourceMultiplicity: '1',
        targetMultiplicity: '*',
      },
    ];

    it('debe generar una cadena SVG válida con el marco UML 2.5 y los elementos del diagrama', () => {
      const svg = service.generateSvgString(mockNodes, mockConnections, 'Ventas', 'class');
      expect(svg).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
      expect(svg).toContain('class Ventas');
      expect(svg).toContain('Cliente');
      expect(svg).toContain('Pedido');
      expect(svg).toContain('obtenerNombre');
      expect(svg).toContain('realiza');
      expect(svg).toContain('</svg>');
    });

    it('debe retornar cadena vacía y advertir si no hay nodos para exportar en SVG', () => {
      const svg = service.generateSvgString([], [], 'Vacio', 'class');
      expect(svg).toBe('');
      expect(mockToastService.warning).toHaveBeenCalledWith('No hay elementos en el diagrama para exportar.');
    });

    it('debe escapar correctamente caracteres XML en nodos y atributos', () => {
      const nodesWithXml: UmlClassNode[] = [
        {
          id: 'c3',
          name: 'Repositorio<T>',
          position: { x: 10, y: 10 },
          width: 200,
          stereotype: 'interface & contract',
          attributes: [{ name: 'items<String>', type: 'List<T>' }],
          methods: [{ name: 'filtrar<U>', returnType: 'List<U>', parameters: 'cond: (T) -> Boolean' }],
        },
      ];
      const svg = service.generateSvgString(nodesWithXml, [], 'Prueba & XML', 'class');
      expect(svg).toContain('Repositorio&lt;T&gt;');
      expect(svg).toContain('&lt;&lt;interface &amp; contract&gt;&gt;');
      expect(svg).toContain('items&lt;String&gt;');
      expect(svg).toContain('filtrar&lt;U&gt;');
      expect(svg).not.toContain('<T>');
    });

    it('debe generar una cadena SVG para diagramas de secuencia con líneas de vida y mensajes', () => {
      const seqNodes: UmlClassNode[] = [
        {
          id: 'adm',
          name: 'adm:Administrador',
          nodeType: 'actor',
          position: { x: 50, y: 50 },
          width: 90,
          attributes: [],
          methods: [],
        },
        {
          id: 'ui',
          name: 'ui:ProposalDiffModalView',
          nodeType: 'lifeline',
          position: { x: 250, y: 50 },
          width: 160,
          attributes: [],
          methods: [],
        },
      ];
      const seqConns: UmlConnection[] = [
        {
          id: 'msg1',
          sourceId: 'adm_slot_0',
          targetId: 'ui_slot_0',
          type: 'message',
          messages: [
            {
              id: 'm1',
              sequenceNumber: '1',
              functionName: 'selectProposal',
              parameters: 'proposalId',
            },
          ],
        },
      ];
      const svg = service.generateSvgString(seqNodes, seqConns, 'Secuencia', 'sequence');
      expect(svg).toContain('sd Secuencia');
      expect(svg).toContain('id="sequence-lifelines"');
      expect(svg).toContain('id="sequence-messages"');
      expect(svg).toContain('1: selectProposal(proposalId)');
      expect(svg).toContain('stroke-dasharray="6,4"');
    });

    it('debe generar un diagrama de comunicación sin líneas de vida de secuencia y con mensajes direccionales', () => {
      const commNodes: UmlClassNode[] = [
        {
          id: 'ctrl',
          name: 'ctrl:ProjectController',
          nodeType: 'lifeline',
          position: { x: 50, y: 50 },
          width: 180,
          attributes: [],
          methods: [],
        },
        {
          id: 'repo',
          name: 'repo:ProjectRepository',
          nodeType: 'lifeline',
          position: { x: 300, y: 200 },
          width: 180,
          attributes: [],
          methods: [],
        },
      ];
      const commConns: UmlConnection[] = [
        {
          id: 'c1',
          sourceId: 'ctrl_bottom',
          targetId: 'repo_left',
          type: 'association',
          lineStyle: 'orthogonal_square',
          messages: [
            {
              id: 'm1',
              sequenceNumber: '1.2',
              functionName: 'createProject',
              parameters: 'projectDto',
              direction: 'forward',
            },
            {
              id: 'm2',
              sequenceNumber: '1.4',
              functionName: 'projectSaved',
              returnType: 'ProjectEntity',
              direction: 'reverse',
            },
          ],
        },
      ];
      const svg = service.generateSvgString(commNodes, commConns, 'FlujoProyectos', 'communication');
      expect(svg).toContain('comm FlujoProyectos');
      expect(svg).not.toContain('id="sequence-lifelines"');
      expect(svg).not.toContain('id="sequence-messages"');
      expect(svg).toContain('ctrl:ProjectController');
      expect(svg).toContain('1.2: createProject(projectDto) →');
      expect(svg).toContain('← 1.4: projectSaved()');
      expect(svg).toContain('<tspan fill-opacity="0.75"> : ProjectEntity</tspan>');
      expect(svg).not.toContain('font-weight="bold" fill="#0284C7"');
      // Codo en L con anclaje en los puertos: ctrl_bottom (centro inferior) → repo_left (centro izquierdo)
      expect(svg).toMatch(/<path d="M 162 152 L 162 280 L 322 280"/);
    });

    it('debe usar barras de activación continuas y mensajes con peso normal en secuencia', () => {
      const nodes: UmlClassNode[] = [
        {
          id: 'a',
          name: 'a:A',
          nodeType: 'lifeline',
          position: { x: 50, y: 50 },
          width: 160,
          attributes: [],
          methods: [],
          activations: [{ id: 'act1', startY: 97, height: 120 }],
        },
        {
          id: 'b',
          name: 'b:B',
          nodeType: 'lifeline',
          position: { x: 300, y: 50 },
          width: 160,
          attributes: [],
          methods: [],
        },
      ];
      const conns: UmlConnection[] = [
        {
          id: 'm1',
          sourceId: 'a_slot_0',
          targetId: 'b_slot_0',
          type: 'sync',
          messages: [{ id: 'x', sequenceNumber: '1', functionName: 'run', parameters: '', returnType: 'Ok' }],
        },
        {
          id: 'm2',
          sourceId: 'b_slot_1',
          targetId: 'a_slot_1',
          type: 'reply',
          messages: [{ id: 'y', sequenceNumber: '1.1', functionName: 'done', isReturn: true }],
        },
      ];
      const svg = service.generateSvgString(nodes, conns, 'Seq', 'sequence');
      expect(svg).toContain('id="sequence-activations"');
      // Llamada (slot 0) + retorno (slot 1): barra continua de 50 + 20 px, igual que la plataforma
      expect(svg).toContain('height="70"');
      expect(svg).toContain('font-weight="normal"');
      expect(svg).not.toMatch(/class="uml-code" font-size="11" font-weight="bold"/);
    });

    it('debe renderizar clases sin atributos sin espacio vacío ni recuadros en multiplicidades', () => {
      const classNodes: UmlClassNode[] = [
        {
          id: 'auth',
          name: 'AuthController',
          stereotype: 'Controller',
          position: { x: 50, y: 50 },
          width: 180,
          attributes: [],
          methods: [{ name: 'login', parameters: 'dto: LoginDto', returnType: 'void' }],
        },
        {
          id: 'usr',
          name: 'User',
          stereotype: 'Entity',
          position: { x: 300, y: 50 },
          width: 180,
          attributes: [{ name: 'id', type: 'UUID' }],
          methods: [{ name: 'save', parameters: '', returnType: 'void' }],
        },
      ];
      const classConns: UmlConnection[] = [
        {
          id: 'c1',
          sourceId: 'auth',
          targetId: 'usr',
          sourceNodeId: 'auth',
          targetNodeId: 'usr',
          type: 'association',
          sourceMultiplicity: '1',
          name: 'sesiones',
          targetMultiplicity: '0..*',
        },
      ];
      const svg = service.generateSvgString(classNodes, classConns, 'DiagramaClases', 'class');
      expect(svg).toContain('AuthController');
      expect(svg).toContain('&lt;&lt;Controller&gt;&gt;');
      expect(svg).toContain('+ login(dto: LoginDto): void');
      // No debe contener recuadros <rect rx="3" alrededor de las multiplicidades o nombres
      expect(svg).not.toContain('rx="3"');
      expect(svg).toContain('sesiones');
      expect(svg).toContain('0..*');
    });
  });

  describe('exportProjectImagesToZip', () => {
    it('captures every diagram with the supplied renderer and releases it even on failure', async () => {
      const dispose = vi.fn();
      const capture = vi.fn().mockResolvedValue({ element: document.createElement('div'), dispose });
      vi.spyOn(service, 'generateFramedCanvas').mockRejectedValue(new Error('capture failed'));
      const fallback = vi.spyOn(service, 'generateSvgString');
      await expect(service.exportProjectImagesToZip([
        { name: 'Example', nodes: [], connections: [] },
      ], 'svg', 'Project', undefined, undefined, capture)).rejects.toThrow('capture failed');
      expect(capture).toHaveBeenCalledWith(0);
      expect(dispose).toHaveBeenCalledOnce();
      expect(fallback).not.toHaveBeenCalled();
    });
    it('preserva el estilo predeterminado y el estilo explícito en conexiones de comunicación del ZIP', async () => {
      const download = vi.spyOn(service as any, 'triggerDownload').mockImplementation(() => {});
      const nodes: UmlClassNode[] = [
        { id: 'a', name: 'A', position: { x: 20, y: 20 }, width: 100, attributes: [], methods: [] },
        { id: 'b', name: 'B', position: { x: 280, y: 180 }, width: 100, attributes: [], methods: [] },
      ];
      const connections: UmlConnection[] = [
        { id: 'default', sourceNodeId: 'a', targetNodeId: 'b', sourceId: 'a', targetId: 'b', type: 'association' },
        { id: 'explicit', sourceNodeId: 'b', targetNodeId: 'a', sourceId: 'b', targetId: 'a', type: 'association', lineStyle: 'segment' },
      ];
      await service.exportProjectImagesToZip([
        { id: 'comm', name: 'Comunicación', type: 'communication', defaultLineStyle: 'straight', nodes, connections },
      ], 'svg', 'Proyecto');
      const zip = await JSZip.loadAsync(download.mock.calls[0][0] as Blob);
      const svg = await Object.values(zip.files)[0].async('string');
      const lines = svg.match(/<line x1=/g) ?? [];
      const paths = svg.match(/<path d="M /g) ?? [];
      expect(lines.length).toBeGreaterThanOrEqual(1);
      expect(paths.length).toBeGreaterThanOrEqual(1);
      expect(connections[0].lineStyle).toBeUndefined();
    });
    it('debe advertir si la lista de diagramas para empaquetar está vacía', async () => {
      await service.exportProjectImagesToZip([], 'svg', 'ProyectoTest');
      expect(mockToastService.warning).toHaveBeenCalledWith('No hay diagramas en el proyecto para exportar.');
    });

    it('debe empaquetar diagramas en un zip SVG correctamente', async () => {
      const triggerDownloadSpy = vi.spyOn(service as any, 'triggerDownload').mockImplementation(() => {});
      const projectDiagrams = [
        {
          id: 'd1',
          name: 'Clases',
          type: 'class',
          nodes: [
            { id: 'n1', name: 'User', position: { x: 10, y: 10 }, width: 150, attributes: [], methods: [] },
          ],
          connections: [],
        },
      ];

      await service.exportProjectImagesToZip(projectDiagrams, 'svg', 'MiSistema');
      expect(triggerDownloadSpy).toHaveBeenCalled();
      const [blob, filename] = triggerDownloadSpy.mock.calls[0] as [Blob, string];
      expect(filename).toBe('misistema_diagramas_svg.zip');
      expect(blob.type).toBe('application/zip');
      expect(mockToastService.success).toHaveBeenCalledWith(
        expect.stringContaining('Se exportaron 1 diagramas en misistema_diagramas_svg.zip'),
      );
    });
  });
});
