import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { createEnvironmentInjector, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { DiagramSidebarComponent } from './diagram-sidebar.component';

describe('DiagramSidebarComponent', () => {
  let component: DiagramSidebarComponent;
  let injector: EnvironmentInjector;

  beforeEach(() => {
    injector = createEnvironmentInjector([], null as any);
    runInInjectionContext(injector, () => {
      component = new DiagramSidebarComponent();
    });
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

    component.onSelectDiagramType('use_case');
    expect(chosen).toBe('use_case');
  });

  it('should emit closeSidebar when closeSidebar is triggered', () => {
    let closed = false;
    component.closeSidebar.subscribe(() => {
      closed = true;
    });

    component.closeSidebar.emit();
    expect(closed).toBe(true);
  });
});
