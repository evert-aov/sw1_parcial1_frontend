import { TestBed } from '@angular/core/testing';
import { DiagramCanvasGeometryService } from './diagram-canvas-geometry.service';
import { DiagramAssemblyConnectionService } from '../../../services/diagram-assembly-connection.service';
import { UmlClassNode } from '../../../../../../core/models/diagram.model';

describe('DiagramCanvasGeometryService - Z-Index Hierarchy', () => {
  let service: DiagramCanvasGeometryService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DiagramCanvasGeometryService, DiagramAssemblyConnectionService],
    });
    service = TestBed.inject(DiagramCanvasGeometryService);
  });

  const createDummyNode = (partial: Partial<UmlClassNode>): UmlClassNode => ({
    id: 'test_node',
    name: 'Test',
    position: { x: 0, y: 0 },
    width: 100,
    height: 100,
    attributes: [],
    methods: [],
    ...partial,
  });

  it('debe ordenar el z-index de menor a mayor: boundary_box < device < executionEnvironment < component < class', () => {
    const boundaryBox = createDummyNode({ nodeType: 'boundary_box' });
    const device = createDummyNode({ nodeType: 'device' });
    const executionEnv = createDummyNode({ nodeType: 'executionEnvironment' });
    const component = createDummyNode({ nodeType: 'component' });
    const regularClass = createDummyNode({ nodeType: 'class' });

    const zBoundary = service.getNodeZIndex(boundaryBox, false);
    const zDevice = service.getNodeZIndex(device, false);
    const zExec = service.getNodeZIndex(executionEnv, false);
    const zComponent = service.getNodeZIndex(component, false);
    const zClass = service.getNodeZIndex(regularClass, false);

    expect(zBoundary).toBeLessThan(zDevice);
    expect(zDevice).toBeLessThan(zExec);
    expect(zExec).toBeLessThan(zComponent);
    expect(zComponent).toBeLessThan(zClass);
  });

  it('debe mantener los contenedores detrás de sus hijos incluso cuando el contenedor está seleccionado', () => {
    const boundaryBox = createDummyNode({ nodeType: 'boundary_box' });
    const device = createDummyNode({ nodeType: 'device' });
    const executionEnv = createDummyNode({ nodeType: 'executionEnvironment' });
    const component = createDummyNode({ nodeType: 'component' });

    // Cuando el boundary box está seleccionado, debe seguir detrás del device
    expect(service.getNodeZIndex(boundaryBox, true)).toBeLessThan(service.getNodeZIndex(device, false));

    // Cuando el device está seleccionado, debe seguir detrás del execution environment
    expect(service.getNodeZIndex(device, true)).toBeLessThan(service.getNodeZIndex(executionEnv, false));

    // Cuando el execution environment está seleccionado, debe seguir detrás del component
    expect(service.getNodeZIndex(executionEnv, true)).toBeLessThan(service.getNodeZIndex(component, false));
  });

  it('debe reconocer variantes de estereotipo o nombres de executionEnvironment', () => {
    const execNode = createDummyNode({ nodeType: 'node' });
    const execStereotype = createDummyNode({ stereotype: 'executionEnvironment' });

    expect(service.getNodeZIndex(execNode, false)).toBe(10);
    expect(service.getNodeZIndex(execStereotype, false)).toBe(10);
  });

  it('debe asignar la prioridad más alta a los anclas flotantes', () => {
    const anchor = createDummyNode({ isAnchor: true });
    expect(service.getNodeZIndex(anchor, false)).toBe(45);
  });
});
