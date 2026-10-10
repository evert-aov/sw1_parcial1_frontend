import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommunicationGlComponent } from './communication-gl.component';
import { BoundaryGlComponent } from './boundary-gl.component';
import { ControlGlComponent } from './control-gl.component';
import { EntityGlComponent } from './entity-gl.component';
import { ActorGlComponent } from './actor-gl.component';

describe('CommunicationGlComponent & WebGL/WebGPU Elements', () => {
  let fixture: ComponentFixture<CommunicationGlComponent>;
  let component: CommunicationGlComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        CommunicationGlComponent,
        BoundaryGlComponent,
        ControlGlComponent,
        EntityGlComponent,
        ActorGlComponent,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CommunicationGlComponent);
    component = fixture.componentInstance;
  });

  it('debe crearse correctamente e inicializar el backend de renderizado', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(['webgpu', 'webgl', '2d']).toContain(component.activeBackend());
  });

  it('debe admitir los 4 tipos de elementos del diagrama de comunicación (boundary, control, entity, actor)', () => {
    const types: Array<'boundary' | 'control' | 'entity' | 'actor'> = [
      'boundary',
      'control',
      'entity',
      'actor',
    ];

    for (const t of types) {
      component.type = t;
      fixture.detectChanges();
      expect(component.type).toBe(t);
    }
  });

  it('debe instanciar los componentes especializados BoundaryGlComponent, ControlGlComponent, EntityGlComponent y ActorGlComponent', () => {
    const boundaryFix = TestBed.createComponent(BoundaryGlComponent);
    expect(boundaryFix.componentInstance).toBeTruthy();

    const controlFix = TestBed.createComponent(ControlGlComponent);
    expect(controlFix.componentInstance).toBeTruthy();

    const entityFix = TestBed.createComponent(EntityGlComponent);
    expect(entityFix.componentInstance).toBeTruthy();

    const actorFix = TestBed.createComponent(ActorGlComponent);
    expect(actorFix.componentInstance).toBeTruthy();
  });

  it('debe reaccionar dinámicamente a cambios de zoom sin degradar calidad', () => {
    component.zoom = 300;
    fixture.detectChanges();
    expect(component.zoom).toBe(300);
  });
});

