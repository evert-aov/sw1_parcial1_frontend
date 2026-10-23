import { vi } from 'vitest';
import { UmlNodeNormalizerUtil } from '../../../../../core/plugins/contracts/uml-node-normalizer.util.contract';
import { provideEditorPlugins } from '../../../../../composition/editor-plugins';
import { TestBed } from '@angular/core/testing';
import { DiagramSidebarComponent } from './diagram-sidebar.component';
import { DiagramDto, DiagramType } from '../../../../../core/models/diagram.model';
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

  it('filters names without accents, hides empty categories and preserves ordering and folder state', async () => {
    const fixture = TestBed.createComponent(DiagramSidebarComponent);
    const sidebar = fixture.componentInstance;
    const diagrams: DiagramDto[] = [
      { id: 'one', name: 'Gestión de ventas', type: DiagramType.CLASS },
      { id: 'two', name: 'Clientes', type: DiagramType.CLASS },
      { id: 'three', name: 'Despliegue', type: DiagramType.DEPLOYMENT },
    ].map(diagram => ({ ...diagram, projectId: null, version: '1', defaultLineStyle: 'segment', nodes: [], connections: [], createdAt: '', updatedAt: '' }));
    fixture.componentRef.setInput('projectDiagrams', diagrams);
    fixture.componentRef.setInput('isOpen', true);
    await fixture.whenStable();
    sidebar.customDiagramOrder.set(['two', 'one', 'three']);
    expect(sidebar.visibleDiagramTypes().map(type => type.id)).toEqual([DiagramType.CLASS, DiagramType.DEPLOYMENT]);
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="search"]');
    input.value = '  GESTION  ';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(sidebar.getVisibleDiagramsForType(DiagramType.CLASS).map(diagram => diagram.id)).toEqual(['one']);
    expect(sidebar.visibleDiagramTypes().map(type => type.id)).toEqual([DiagramType.CLASS]);
    expect(sidebar.isFolderExpanded(DiagramType.CLASS)).toBe(true);
    sidebar.moveDiagram('one', 'up', DiagramType.CLASS);
    expect(sidebar.customDiagramOrder()).toEqual(['two', 'one', 'three']);
    sidebar.diagramSearch.set('');
    await fixture.whenStable();
    expect(sidebar.getVisibleDiagramsForType(DiagramType.CLASS).map(diagram => diagram.id)).toEqual(['two', 'one']);
    expect(sidebar.isFolderExpanded(DiagramType.CLASS)).toBe(false);
    expect(sidebar.projectDiagrams()).toEqual(diagrams);
    fixture.destroy();
  });

  it('keeps diagram creation available with no matches and removes the UML category selector from the toolbox', async () => {
    const fixture = TestBed.createComponent(DiagramSidebarComponent);
    fixture.componentRef.setInput('isOpen', true);
    await fixture.whenStable();
    const sidebar = fixture.componentInstance;
    const create = vi.fn();
    vi.spyOn(sidebar, 'onCreateDiagramGeneral').mockImplementation(create);
    expect(fixture.nativeElement.querySelector('[role="status"]')).not.toBeNull();
    fixture.nativeElement.querySelector('input[type="search"]').nextElementSibling.click();
    expect(create).toHaveBeenCalledOnce();
    sidebar.diagramSearch.set('missing');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="status"]')).not.toBeNull();
    sidebar.activeTab.set('toolbox');
    await fixture.whenStable();
    const translations = TestBed.inject(TranslationService);
    expect(fixture.nativeElement.textContent).not.toContain(translations.translate('editor.toolbox.umlDiagrams'));
    expect(fixture.nativeElement.querySelector('app-diagram-tool-item-button')).not.toBeNull();
    fixture.destroy();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
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

describe('Editor sidebar visibility', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('collapses the active panel and restores either section from the icon rail', () => {
    TestBed.configureTestingModule({
      imports: [DiagramSidebarComponent],
      providers: [{ provide: UmlNodeNormalizerUtil, useValue: {} }],
    });
    const fixture = TestBed.createComponent(DiagramSidebarComponent);
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    const sidebar = fixture.componentInstance;
    const close = vi.fn();
    const open = vi.fn();
    sidebar.closeSidebar.subscribe(close);
    sidebar.openSidebar.subscribe(open);
    sidebar.selectPanel('explorer');
    expect(close).toHaveBeenCalledTimes(1);
    fixture.componentRef.setInput('isOpen', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('aside')).toBeNull();
    const controls = fixture.nativeElement.querySelectorAll('nav button');
    expect(controls.length).toBe(2);
    controls[0].click();
    expect(sidebar.activeTab()).toBe('toolbox');
    expect(open).toHaveBeenCalledTimes(1);
    controls[1].click();
    expect(sidebar.activeTab()).toBe('explorer');
    expect(open).toHaveBeenCalledTimes(2);
    fixture.destroy();
  });
});
