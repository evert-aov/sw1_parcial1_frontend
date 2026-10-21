import { provideEditorPlugins } from '../../../../../composition/editor-plugins';
import { TestBed } from '@angular/core/testing';
import { DiagramSidebarComponent } from './diagram-sidebar.component';
import { DiagramType } from '../../../../../core/models/diagram.model';
import { TranslationService } from '../../../../../core/i18n/index';

describe('DiagramSidebarComponent', () => {
  let component: DiagramSidebarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DiagramSidebarComponent],
      providers: [TranslationService, provideEditorPlugins()],
    }).compileComponents();

    const fixture = TestBed.createComponent(DiagramSidebarComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
    expect(component.isRelationshipsOpen()).toBe(true);
    expect(component.isLineStylesOpen()).toBe(true);
  });

  it('should emit setPointerMode when onSelectPointer is called', () => {
    let emitted = false;
    component.setPointerMode.subscribe(() => {
      emitted = true;
    });

    component.onSelectPointer();
    expect(emitted).toBe(true);
  });

  it('should emit selectRelationType when onSelectRelation is called', () => {
    let selected: string | null = null;
    component.selectRelationType.subscribe((val) => {
      selected = val;
    });

    component.onSelectRelation('generalization');
    expect(selected).toBe('generalization');
  });

  it('should emit setDefaultLineStyle when onSetLineStyle is called', () => {
    let style: string | null = null;
    component.setDefaultLineStyle.subscribe((val) => {
      style = val;
    });

    component.onSetLineStyle('bezier');
    expect(style).toBe('bezier');
  });

  it('should emit diagramTypeChange when onSelectDiagramType is called', () => {
    let chosen: string | null = null;
    component.diagramTypeChange.subscribe((val) => {
      chosen = val;
    });

    component.onSelectDiagramType(DiagramType.USE_CASE);
    expect(chosen).toBe(DiagramType.USE_CASE);
  });

  it('should emit closeSidebar when closeSidebar is triggered', () => {
    let closed = false;
    component.closeSidebar.subscribe(() => {
      closed = true;
    });

    component.closeSidebar.emit();
    expect(closed).toBe(true);
  });

  it('should correctly evaluate node compatibility for COMMUNICATION and CLASS_ANALYSIS', () => {
    const fixture = TestBed.createComponent(DiagramSidebarComponent);
    fixture.componentRef.setInput('activeDiagramType', DiagramType.COMMUNICATION);
    expect(fixture.componentInstance.isNodeTypeCompatibleWithCurrent('actor')).toBe(true);
    expect(fixture.componentInstance.isNodeTypeCompatibleWithCurrent('boundary')).toBe(true);
    expect(fixture.componentInstance.isNodeTypeCompatibleWithCurrent('control')).toBe(true);
    expect(fixture.componentInstance.isNodeTypeCompatibleWithCurrent('entity')).toBe(true);
    expect(fixture.componentInstance.isNodeTypeCompatibleWithCurrent('class')).toBe(false);

    fixture.componentRef.setInput('activeDiagramType', DiagramType.CLASS_ANALYSIS);
    expect(fixture.componentInstance.isNodeTypeCompatibleWithCurrent('class')).toBe(true);
    expect(fixture.componentInstance.isNodeTypeCompatibleWithCurrent('actor')).toBe(true);
    expect(fixture.componentInstance.isNodeTypeCompatibleWithCurrent('boundary')).toBe(false);
    expect(fixture.componentInstance.isNodeTypeCompatibleWithCurrent('control')).toBe(false);
    expect(fixture.componentInstance.isNodeTypeCompatibleWithCurrent('entity')).toBe(false);
  });
});
