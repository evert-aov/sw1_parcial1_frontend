import { By } from '@angular/platform-browser';
import { FFlowModule, FConnectorDirective } from '@foblex/flow';
import { ApplicationRef, EnvironmentInjector, createComponent, Component, ChangeDetectionStrategy, input, inject, InjectionToken } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DiagramType, UmlClassNode } from '../core/models/diagram.model';
import { PluginRegistryService } from '../core/plugins/plugin-registry.service';
import { NodePluginRegistryService } from '../core/plugins/node-plugin-registry.service';
import { NodePlugin } from '../core/plugins/node-plugin.contract';
import { EDITOR_PLUGINS } from '../core/plugins/plugin.contract';
import { NodeMetricsService } from '../features/diagrams/diagram-editor/utils/node-metrics.util';
import { DiagramNodeFactoryService } from '../plugin-sdk/diagram-node-factory.service';
import { DiagramCanvasComponent } from '../features/diagrams/diagram-editor/components/diagram-canvas/diagram-canvas.component';
import { DiagramExportService } from '../core/plugins/contracts/diagram-export.service.contract';
import { DiagramDocumentSyncService } from '../core/plugins/contracts/diagram-document-sync.service.contract';
import { UmlNodeNormalizerUtil } from '../core/plugins/contracts/uml-node-normalizer.util.contract';
import { provideEditorPlugins } from './editor-plugins';
import { NODE_PLUGINS } from './node-plugins';
import { umlLanguagePlugin } from '../plugins/uml-language/uml-language.plugin';
import { documentIoPlugin } from '../plugins/document-io/document-io.plugin';

const RENDERER_BADGE = new InjectionToken<string>('renderer badge');
@Component({ standalone: true, imports: [FFlowModule], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span fConnector fConnectorType="source-target" [fConnectorId]="node().id + '_plugin'">{{ badge }} {{ node().name }}</span>` })
class ExtensionRenderer {
  readonly badge = inject(RENDERER_BADGE);
  readonly node = input.required<UmlClassNode>();
}
const node: UmlClassNode = {
  id: 'sample',
  name: 'Sample',
  nodeType: 'sample',
  position: { x: 50, y: 60 },
  width: 190,
  attributes: [],
  methods: [],
};
const extension: NodePlugin = {
  metadata: {
    id: 'example.sample',
    version: '1.0.0',
    apiVersion: 1,
    category: 'node',
    labelKey: 'example.sample',
  },
  providers: [{ provide: RENDERER_BADGE, useValue: 'extension' }],
  nodeTypes: ['sample'],
  renderer: ExtensionRenderer,
  defaultColor: '#123456',
  tools: [{ id: 'sample', labelKey: 'example.sample', diagramTypes: [DiagramType.CLASS] }],
  geometry: {
    width: () => 190,
    height: () => 80,
    dynamicWidth: () => 190,
    minWidth: 50,
    minHeight: 30,
    bottomOffset: -6,
    zIndex: [20, 25],
    cssClass: 'sample',
    transparent: true,
  },
  create: () => structuredClone(node),
  inputs: (context) => ({ node: context.node }),
};

describe('Editor microkernel composition', () => {
  it('mounts consecutive export canvases with every installed node renderer', () => {
    vi.stubGlobal('ResizeObserver', class { observe(): void {} unobserve(): void {} disconnect(): void {} });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 2400, 1600));
    vi.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(1600);
    const registry = TestBed.inject(PluginRegistryService);
    NODE_PLUGINS.forEach(plugin => registry.register(plugin));
    const app = TestBed.inject(ApplicationRef);
    for (const plugin of NODE_PLUGINS) {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const ref = createComponent(DiagramCanvasComponent, {
        hostElement: host, environmentInjector: TestBed.inject(EnvironmentInjector),
      });
      app.attachView(ref.hostView);
      try {
        ref.setInput('exportSize', { width: 2400, height: 1600 });
        ref.setInput('nodes', [{ ...structuredClone(node), nodeType: plugin.nodeTypes[0] }]);
        ref.setInput('interactionDisabled', true);
        expect(() => ref.changeDetectorRef.detectChanges(), plugin.metadata.id).not.toThrow();
        expect(() => ref.changeDetectorRef.detectChanges(), plugin.metadata.id).not.toThrow();
        const originalNode = ref.instance.nodes()[0];
        const initialInputs = ref.instance.nodePluginInputs(originalNode);
        expect(ref.instance.nodePluginInputs(originalNode)).toBe(initialInputs);
        const updatedNode = { ...originalNode, color: '#123456', name: 'Updated' };
        ref.setInput('nodes', [updatedNode]);
        expect(() => ref.changeDetectorRef.detectChanges(), plugin.metadata.id).not.toThrow();
        expect(ref.instance.nodePluginInputs(updatedNode)).not.toBe(initialInputs);
        expect(ref.instance.nodePluginInputs(updatedNode)['node']).toBe(updatedNode);
      } finally {
        app.detachView(ref.hostView);
        ref.destroy();
        host.remove();
      }
    }
  });

  it('constructs an empty canvas with no UML or utility plug-ins installed', async () => {
    const fixture = TestBed.createComponent(DiagramCanvasComponent);
    await fixture.whenStable();
    expect(fixture.componentInstance.hasNoRealNodes()).toBe(true);
    expect(TestBed.inject(PluginRegistryService).plugins()).toEqual([]);
    fixture.destroy();
  }, 15000);

  it('discovers, creates and measures an unknown extension without changing any core dispatch table', () => {
    const registry = TestBed.inject(PluginRegistryService);
    const nodes = TestBed.inject(NodePluginRegistryService);
    const factory = TestBed.inject(DiagramNodeFactoryService);
    const metrics = TestBed.inject(NodeMetricsService);
    registry.register(extension);
    expect(nodes.find('sample')?.renderer).toBe(ExtensionRenderer);
    expect(
      nodes
        .plugins()
        .flatMap((p) => p.tools)
        .map((t) => t.id),
    ).toEqual(['sample']);
    expect(factory.create('sample', { nodes: [], diagramType: DiagramType.CLASS })).toEqual(node);
    expect(metrics.getNodeWidth(node)).toBe(190);
    expect(metrics.getNodeHeight(node)).toBe(80);
    expect(() =>
      registry.register({ ...extension, metadata: { ...extension.metadata, id: 'duplicate' } }),
    ).toThrow('Duplicate or empty node type');
    registry.unregister('example.sample');
    expect(nodes.find('sample')).toBeUndefined();
    expect(() => factory.create('sample', { nodes: [], diagramType: DiagramType.CLASS })).toThrow(
      'Unknown node type',
    );
    expect(metrics.getNodeWidth(node)).toBe(190); // Persisted geometry survives a missing renderer.
  });

  it('renders a dynamically registered Foblex connector in its node and plug-in injector, then removes it', async () => {
    // jsdom has no layout engine or ResizeObserver. This test verifies connector
    // ownership and injector ancestry; pixel geometry remains browser-dependent.
    vi.stubGlobal('ResizeObserver', class { observe(): void {} unobserve(): void {} disconnect(): void {} });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 800, 600));
    vi.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(600);
    const registry = TestBed.inject(PluginRegistryService);
    registry.register(extension);
    const fixture = TestBed.createComponent(DiagramCanvasComponent);
    fixture.componentRef.setInput('nodes', [structuredClone(node)]);
    await fixture.whenStable();
    await new Promise(requestAnimationFrame);
    const connectors = () => fixture.debugElement.queryAll(By.directive(FConnectorDirective)).map(element => element.injector.get(FConnectorDirective));
    const rendered = connectors().find(connector => connector.fId() === 'sample_plugin');
    expect(rendered?.fNodeId).toBe('sample');
    expect(rendered?.fConnectorType()).toBe('source-target');
    expect(fixture.nativeElement.textContent).toContain('extension Sample');
    registry.unregister(extension.metadata.id);
    await fixture.whenStable();
    expect(connectors().map(connector => connector.fId())).not.toContain('sample_plugin');
    expect(fixture.componentInstance.nodes()[0].name).toBe('Sample');
    fixture.destroy();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('registers every existing node type and preserves aliases, geometry and independent identities', () => {
    TestBed.configureTestingModule({ providers: [provideEditorPlugins()] });
    const nodes = TestBed.inject(NodePluginRegistryService);
    const metrics = TestBed.inject(NodeMetricsService);
    for (const plugin of NODE_PLUGINS) {
      const created = plugin.create({ nodes: [], diagramType: DiagramType.CLASS });
      expect(nodes.forNode(created)).toBeDefined();
      expect(created.position.x).toBeGreaterThanOrEqual(20);
      expect(plugin.geometry.width(created)).toBeGreaterThan(0);
    }
    expect(nodes.find('node')?.metadata.id).toBe('uml.node');
    expect(metrics.getNodeHeight({ ...node, nodeType: 'lifeline', customHeight: 300 })).toBe(60);
    expect(metrics.getDefaultColorForNodeType('class', 'UI')).toBe('#DDF4F5');
    const created = nodes.require('actor').create({ nodes: [], diagramType: DiagramType.SEQUENCE });
    expect(created.position.y).toBe(50);
    expect(created.width).toBe(65);
    expect(created.height).toBe(65);
    expect(nodes.require('actor').geometry.width(created)).toBe(65);
    expect(nodes.require('actor').geometry.height(created)).toBe(65);
    expect(
      nodes.require('actor').create({ nodes: [], diagramType: DiagramType.SEQUENCE }).id,
    ).not.toBe(created.id);
  });

  it('garantiza que el actor mide 65x65 y sus slots de secuencia alinean en la misma recta Y que la lifeline', () => {
    TestBed.configureTestingModule({
      providers: [provideEditorPlugins()],
    });
    const nodes = TestBed.inject(NodePluginRegistryService);
    const actorPluginDef = nodes.require('actor');
    const lifelinePluginDef = nodes.require('lifeline');

    const actorNode = actorPluginDef.create({ nodes: [], diagramType: DiagramType.SEQUENCE });
    const lifelineNode = lifelinePluginDef.create({ nodes: [], diagramType: DiagramType.SEQUENCE });

    expect(actorPluginDef.geometry.width(actorNode)).toBe(65);
    expect(actorPluginDef.geometry.height(actorNode)).toBe(65);

    const actorFixture = TestBed.createComponent(actorPluginDef.renderer as any);
    const lifelineFixture = TestBed.createComponent(lifelinePluginDef.renderer as any);
    const actorComp = actorFixture.componentInstance as any;
    const lifelineComp = lifelineFixture.componentInstance as any;

    expect(actorComp.getSlotTopFn(0)).toBe(150);
    expect(lifelineComp.getSlotTopFn(0)).toBe(150);
    for (let slot = 0; slot < 5; slot++) {
      expect(actorComp.getSlotTopFn(slot)).toBe(lifelineComp.getSlotTopFn(slot));
    }

    actorFixture.destroy();
    lifelineFixture.destroy();
  });

  it('saves and normalizes documents with AI, XMI and image exporters absent', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: EDITOR_PLUGINS,
          useValue: [...NODE_PLUGINS, umlLanguagePlugin, documentIoPlugin],
        },
      ],
    });
    const exporter = TestBed.inject(DiagramExportService);
    const metrics = TestBed.inject(NodeMetricsService);
    const normalizer = TestBed.inject(UmlNodeNormalizerUtil);
    const sync = TestBed.inject(DiagramDocumentSyncService);
    const payload = exporter.buildSaveAstPayload(
      DiagramType.CLASS,
      'straight',
      [{ ...node, nodeType: 'class' }],
      [],
      (n) => metrics.getNodeWidth(n),
      (n) => metrics.getNodeHeight(n),
      (t, s) => metrics.getDefaultColorForNodeType(t, s),
      (m) => normalizer.normalizeUmlMessage(m),
    );
    expect(payload.nodes[0].name).toBe('Sample');
    expect(
      sync.normalizeIncomingNodes([{ ...node, nodeType: 'class' }], (t, s) =>
        metrics.getDefaultColorForNodeType(t, s),
      )[0].id,
    ).toBe('sample');
    expect(TestBed.inject(PluginRegistryService).find('ai-assistant')).toBeUndefined();
  });
});
