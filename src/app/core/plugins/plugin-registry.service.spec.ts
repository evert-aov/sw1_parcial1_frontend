import { Injectable, InjectionToken, OnDestroy } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PluginDefinition } from './plugin.contract';
import { PluginRegistryService } from './plugin-registry.service';

const API = new InjectionToken<{ run(): string }>('test API');
function plugin(id = 'test'): PluginDefinition {
  return { metadata: { id, apiVersion: 1, version: '1.0.0', category: 'tool', labelKey: 'test' } };
}

describe('PluginRegistryService', () => {
  let registry: PluginRegistryService;
  beforeEach(() => {
    TestBed.configureTestingModule({});
    registry = TestBed.inject(PluginRegistryService);
  });

  it('starts with an empty core and discovers dynamically registered plug-ins', () => {
    expect(registry.plugins()).toEqual([]);
    registry.register(plugin());
    expect(registry.find('test')?.metadata.id).toBe('test');
    expect(registry.discover('tool')).toHaveLength(1);
    expect(registry.discover('node')).toHaveLength(0);
  });

  it('creates a capability once, only on demand, and rejects missing capabilities', () => {
    const create = vi.fn(() => ({ run: () => 'ok' }));
    registry.register({ ...plugin(), capabilities: [{ token: API, create }] });
    expect(create).not.toHaveBeenCalled();
    expect(registry.resolve(API).run()).toBe('ok');
    expect(registry.resolve(API)).toBe(registry.resolve(API));
    expect(create).toHaveBeenCalledTimes(1);
    registry.unregister('test');
    expect(() => registry.resolve(API)).toThrow('No plug-in');
  });

  it('rejects duplicate ids, capability collisions and incompatible API versions atomically', () => {
    registry.register({
      ...plugin(),
      capabilities: [{ token: API, create: () => ({ run: () => 'first' }) }],
    });
    expect(() => registry.register(plugin())).toThrow('Duplicate plug-in');
    expect(() =>
      registry.register({
        ...plugin('other'),
        capabilities: [{ token: API, create: () => ({ run: () => 'other' }) }],
      }),
    ).toThrow('Duplicate capability');
    expect(() =>
      registry.register({ metadata: { ...plugin('v2').metadata, apiVersion: 2 as 1 } }),
    ).toThrow('Unsupported');
    expect(registry.plugins()).toHaveLength(1);
    expect(registry.resolve(API).run()).toBe('first');
  });

  it('destroys scoped providers and calls deactivation exactly once on removal', () => {
    const destroy = vi.fn();
    @Injectable()
    class Resource implements OnDestroy {
      ngOnDestroy(): void {
        destroy();
      }
    }
    const deactivate = vi.fn();
    registry.register({
      ...plugin(),
      providers: [Resource],
      activate: (injector) => {
        injector.get(Resource);
      },
      deactivate,
    });
    expect(registry.unregister('test')).toBe(true);
    expect(registry.unregister('test')).toBe(false);
    expect(deactivate).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('rolls back failed activation and detects cyclic capability factories', () => {
    expect(() =>
      registry.register({
        ...plugin(),
        activate: () => {
          throw new Error('activation failed');
        },
      }),
    ).toThrow('activation failed');
    expect(registry.plugins()).toHaveLength(0);
    registry.register({
      ...plugin(),
      capabilities: [{ token: API, create: () => registry.resolve(API) }],
    });
    expect(() => registry.resolve(API)).toThrow('Circular');
    registry.unregister('test');
    registry.register({
      ...plugin(),
      capabilities: [{ token: API, create: () => ({ run: () => 'recovered' }) }],
    });
    expect(registry.resolve(API).run()).toBe('recovered');
  });
});
