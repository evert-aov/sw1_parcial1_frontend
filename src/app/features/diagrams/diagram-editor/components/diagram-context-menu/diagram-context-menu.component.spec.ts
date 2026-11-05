import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DiagramContextMenuComponent } from './diagram-context-menu.component';
import { UmlConnection } from '../../../../../core/models/diagram.model';

describe('DiagramContextMenuComponent', () => {
  let component: DiagramContextMenuComponent;
  let fixture: ComponentFixture<DiagramContextMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DiagramContextMenuComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DiagramContextMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debe crearse correctamente', () => {
    expect(component).toBeTruthy();
    expect(component.lineStyles.length).toBeGreaterThan(0);
  });

  it('debe emitir setAllConnectionsLineStyle y close al llamar onSetAllLineStyle', () => {
    let emittedStyle: string | null = null;
    let closed = false;
    component.setAllConnectionsLineStyle.subscribe((s) => (emittedStyle = s));
    component.close.subscribe(() => (closed = true));

    component.onSetAllLineStyle('straight');

    expect(emittedStyle).toBe('straight');
    expect(closed).toBe(true);
  });

  it('debe identificar correctamente el estilo activo de una conexión', () => {
    const conn1: UmlConnection = {
      id: 'c1',
      sourceNodeId: 'n1',
      targetNodeId: 'n2',
      sourceId: 'n1_1',
      targetId: 'n2_1',
      type: 'association',
      lineStyle: 'straight',
    };
    expect(component.isActiveLineStyle(conn1, 'straight')).toBe(true);
    expect(component.isActiveLineStyle(conn1, 'bezier')).toBe(false);

    const connDefault: UmlConnection = {
      id: 'c2',
      sourceNodeId: 'n1',
      targetNodeId: 'n2',
      sourceId: 'n1_1',
      targetId: 'n2_1',
      type: 'association',
    };
    expect(component.isActiveLineStyle(connDefault, 'orthogonal_square')).toBe(true);
  });
});
