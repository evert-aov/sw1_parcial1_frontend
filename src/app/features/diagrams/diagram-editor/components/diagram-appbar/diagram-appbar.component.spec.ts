import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../../../core/services/auth.service';
import { CollaborationService } from '../../../../../core/services/collaboration.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { PluginRegistryService } from '../../../../../core/plugins/plugin-registry.service';
import { DiagramAppbarComponent } from './diagram-appbar.component';

describe('Workspace action ownership', () => {
  let fixture: ComponentFixture<DiagramAppbarComponent>;
  const plugins = { find: vi.fn(() => ({})), component: vi.fn(() => ({})), has: vi.fn(() => false), resolve: vi.fn() };

  beforeEach(async () => {
    plugins.has.mockReturnValue(false);
    TestBed.configureTestingModule({ providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { currentUser: signal(null), logout: vi.fn() } },
      { provide: CollaborationService, useValue: { activeRoomCode: signal(null), collaborators: signal([]), isConnected: signal(false), isMultiUserEditing: signal(false) } },
      { provide: ToastService, useValue: { warning: vi.fn(), success: vi.fn() } },
      { provide: PluginRegistryService, useValue: plugins },
    ] });
    fixture = TestBed.createComponent(DiagramAppbarComponent);
    fixture.componentRef.setInput('diagramId', 'diagram-1');
    fixture.componentRef.setInput('projectId', 'project-1');
    await fixture.whenStable();
  });

  afterEach(() => { fixture.destroy(); vi.clearAllMocks(); });

  it('shows styling and alignment only for applicable selections, retaining read-only guards', async () => {
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('[data-context-tools]')).toBeNull();
    fixture.componentRef.setInput('selectedNodeId', 'node-1');
    fixture.componentRef.setInput('selectedNodesCount', 1);
    fixture.componentRef.setInput('selectedNodeColor', '#ff0000');
    await fixture.whenStable();
    expect(root.querySelector<HTMLInputElement>('input[type="color"]')?.value).toBe('#ff0000');
    const picker = root.querySelector<HTMLInputElement>('input[type="color"]')!;
    picker.dispatchEvent(new Event('focus'));
    fixture.componentRef.setInput('selectedNodeColor', '#00ff00');
    await fixture.whenStable();
    expect(picker.value).toBe('#ff0000');
    picker.dispatchEvent(new Event('blur'));
    expect(picker.value).toBe('#00ff00');
    expect(root.querySelector('[data-context-tools="alignment"]')).toBeNull();
    fixture.componentRef.setInput('selectedNodesCount', 2);
    await fixture.whenStable();
    expect(root.querySelector('[data-context-tools="alignment"]')).toBeNull();
    fixture.componentRef.setInput('isReadOnly', true);
    await fixture.whenStable();
    expect(root.querySelector('[data-context-tools]')).toBeNull();
    fixture.componentRef.setInput('isReadOnly', false);
    fixture.componentRef.setInput('selectedNodeId', null);
    fixture.componentRef.setInput('selectedNodesCount', 0);
    await fixture.whenStable();
    expect(root.querySelector('[data-context-tools]')).toBeNull();
    fixture.componentInstance.toggleMenu('file');
    await fixture.whenStable();
    expect(root.querySelector('.model-info')?.textContent).toContain('XMI 2.1');
  });

  it('opens help and toggles the assistant from the header without putting help in export', async () => {
    const root: HTMLElement = fixture.nativeElement;
    const guide = { openGuide: vi.fn() };
    plugins.has.mockReturnValue(true);
    plugins.resolve.mockReturnValue(guide);
    const toggle = vi.fn();
    fixture.componentInstance.toggleAi.subscribe(toggle);
    const assistant = root.querySelector<HTMLButtonElement>('.workspace-bar [data-action="assistant"]')!;
    assistant.click();
    expect(toggle).toHaveBeenCalledOnce();
    fixture.componentRef.setInput('isAiPanelOpen', true);
    await fixture.whenStable();
    expect(assistant.getAttribute('aria-pressed')).toBe('true');
    assistant.click();
    expect(toggle).toHaveBeenCalledTimes(2);

    fixture.componentInstance.showPublish();
    await fixture.whenStable();
    expect(root.querySelector('.export-menu [data-action="manual"]')).toBeNull();
    expect(root.querySelector('.export-menu')?.textContent).not.toContain('Manual');
    root.querySelector<HTMLButtonElement>('.workspace-bar [data-action="manual"]')!.click();
    expect(guide.openGuide).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.menu()).toBeNull();
  });

  it('offers four task tabs, generation only in Develop and saving only in File', async () => {
    const root: HTMLElement = fixture.nativeElement;
    expect(Array.from(root.querySelectorAll('[data-tab]')).map(tab => tab.getAttribute('data-tab')))
      .toEqual(['design', 'develop', 'collaborate', 'publish']);
    expect(root.querySelector('[data-action="save"]')).toBeNull();
    expect(root.querySelector('[data-action="generate"]')).toBeNull();
    const generate = vi.fn();
    fixture.componentInstance.openSpringBoot.subscribe(generate);
    fixture.componentInstance.onTabClick('develop');
    await fixture.whenStable();
    root.querySelector<HTMLButtonElement>('[data-action="generate"]')!.click();
    expect(generate).toHaveBeenCalledOnce();
    fixture.componentInstance.onTabClick('publish');
    await fixture.whenStable();
    expect(root.querySelector('[data-action="generate"]')).toBeNull();
    fixture.componentInstance.toggleMenu('file');
    await fixture.whenStable();
    expect(root.querySelectorAll('[data-action="save"]')).toHaveLength(1);
    expect(root.querySelector('.file-trigger img')?.getAttribute('src')).toBe('logo.png');
    const settings = root.querySelector<HTMLAnchorElement>('a[href*="panel=settings"]');
    expect(settings?.href).toContain('projectId=project-1');
  });

  it('routes File export to the single Publish menu and preserves export guards', async () => {
    const png = vi.fn();
    fixture.componentInstance.exportPng.subscribe(png);
    fixture.componentInstance.showPublish();
    await fixture.whenStable();
    expect(fixture.componentInstance.activeTab()).toBe('publish');
    expect(fixture.nativeElement.querySelectorAll('.export-menu')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.file-menu')).toBeNull();
    fixture.componentInstance.handleExportPng();
    expect(png).toHaveBeenCalledOnce();
    fixture.componentRef.setInput('isMultiUserEditing', true);
    fixture.componentInstance.handleExportPng();
    expect(png).toHaveBeenCalledOnce();
    fixture.componentInstance.onTabClick('collaborate');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('a[href*="panel=members"]')?.getAttribute('href')).toContain('projectId=project-1');
  });

  it('blocks saving and imports for viewers without hiding export choices', async () => {
    const save = vi.fn();
    const importJson = vi.fn();
    fixture.componentInstance.saveDiagram.subscribe(save);
    fixture.componentInstance.openImportJson.subscribe(importJson);
    fixture.componentRef.setInput('isReadOnly', true);
    fixture.componentInstance.toggleMenu('file');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[data-action="save"]').disabled).toBe(true);
    fixture.componentInstance.saveProject();
    fixture.componentInstance.handleOpenImportJson();
    expect(save).not.toHaveBeenCalled();
    expect(importJson).not.toHaveBeenCalled();
    fixture.componentRef.setInput('isReadOnly', false);
    fixture.componentInstance.saveProject();
    expect(save).toHaveBeenCalledOnce();
  });

  it('isolates menu keystrokes, restores focus with Escape and dismisses outside', async () => {
    fixture.componentInstance.toggleMenu('file');
    await fixture.whenStable();
    const menu: HTMLElement = fixture.nativeElement.querySelector('.file-menu');
    const actions = menu.querySelectorAll<HTMLElement>('[role="menuitem"]');
    actions[0].focus();
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(actions[1]);
    const key = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    menu.dispatchEvent(key);
    expect(fixture.componentInstance.menu()).toBeNull();
    expect(key.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('.file-trigger'));
    fixture.componentInstance.toggleMenu('file');
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(fixture.componentInstance.menu()).toBeNull();
  });

  it('keeps Ctrl+S available inside File without letting Delete reach the editor', async () => {
    const save = vi.fn();
    const windowKey = vi.fn();
    fixture.componentInstance.saveDiagram.subscribe(save);
    fixture.componentInstance.toggleMenu('file');
    await fixture.whenStable();
    window.addEventListener('keydown', windowKey);
    try {
      const menu: HTMLElement = fixture.nativeElement.querySelector('.file-menu');
      menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
      menu.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }));
      expect(windowKey).not.toHaveBeenCalled();
      expect(save).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener('keydown', windowKey);
    }
  });

  it('emite toggleGrid al hacer clic en el botón de cuadrícula del lienzo', async () => {
    const toggleGridSpy = vi.fn();
    fixture.componentInstance.toggleGrid.subscribe(toggleGridSpy);
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const gridBtn = buttons.find((b) => b.title?.includes('Cuadrícula') || b.textContent?.includes('Cuadrícula') || b.title?.includes('Grid') || b.textContent?.includes('Grid'));
    expect(gridBtn).toBeTruthy();
    gridBtn!.click();
    expect(toggleGridSpy).toHaveBeenCalledOnce();
  });

  it('displays integrity protection banners and fires toast warnings on click when 2+ users edit concurrently', async () => {
    const toast = TestBed.inject(ToastService);
    const png = vi.fn();
    fixture.componentInstance.exportPng.subscribe(png);
    fixture.componentRef.setInput('isMultiUserEditing', true);
    fixture.componentInstance.showPublish();
    await fixture.whenStable();
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('[data-integrity-banner="publish"]')).not.toBeNull();
    expect(root.querySelector('[data-integrity-banner="export"]')).not.toBeNull();

    const pngButton = root.querySelector<HTMLButtonElement>('[data-export-action="png"]')!;
    expect(pngButton.getAttribute('aria-disabled')).toBe('true');
    pngButton.click();
    expect(png).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledOnce();

    fixture.componentInstance.toggleMenu('file');
    fixture.componentInstance.toggleImport();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.querySelector('[data-integrity-banner="import"]')).not.toBeNull();
  });
});
