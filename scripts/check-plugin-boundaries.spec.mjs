import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { checkPluginBoundaries } from './check-plugin-boundaries.mjs';

function fixture(t, files) {
  const root = mkdtempSync(path.join(tmpdir(), 'plugin-boundaries-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(root, name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  return root;
}

test('rejects feature dependencies in plug-in imports, reexports and dynamic imports', (t) => {
  const root = fixture(t, {
    'features/editor.ts': 'export class Editor {}',
    'plugins/sample/plugin.ts': `
      import type { Editor } from '../../features/editor';
      export { Editor } from '../../features/editor';
      const load = () => import('../../features/editor');
      type Host = import('../../features/editor').Editor;
    `,
  });
  const { errors } = checkPluginBoundaries(root);
  assert.equal(errors.length, 4);
  assert.ok(errors.every((error) => error.includes('outside Core/SDK')));
});

test('rejects feature references in Core contracts and the SDK', (t) => {
  const root = fixture(t, {
    'features/editor.ts': 'export class Editor {}',
    'core/contract.ts': "import type { Editor } from '../features/editor';",
    'plugin-sdk/helper.ts': "export { Editor } from '../features/editor';",
  });
  assert.equal(checkPluginBoundaries(root).errors.length, 2);
});

test('checks spec imports and prevents plug-ins bypassing isolation through composition', (t) => {
  const root = fixture(t, {
    'plugins/a/plugin.spec.ts': "import { b } from '../b/plugin';",
    'plugins/b/plugin.ts': 'export const b = 1;',
    'plugins/a/plugin.ts': "import '../../composition/plugins';",
    'features/editor.spec.ts': "import { b } from '../plugins/b/plugin';",
    'composition/plugins.ts': "export { b } from '../plugins/b/plugin';",
  });
  assert.equal(checkPluginBoundaries(root).errors.length, 3);
});

test('resolves TypeScript path aliases before checking boundaries', (t) => {
  const root = fixture(t, {
    'features/editor.ts': 'export class Editor {}',
    'plugins/a/plugin.ts': "import { Editor } from '@host/editor';",
  });
  const { errors } = checkPluginBoundaries(root, {
    paths: { '@host/*': [path.join(root, 'features/*')] },
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /outside Core\/SDK/);
});

test('allows contracts, SDK helpers, package internals and composition wiring', (t) => {
  const root = fixture(t, {
    'core/contract.ts': 'export interface Contract {}',
    'plugin-sdk/helper.ts': "import type { Contract } from '../core/contract';",
    'plugins/a/internal.ts': 'export const internal = 1;',
    'plugins/a/plugin.ts': `
      import './internal';
      import '../../core/contract';
      import '../../plugin-sdk/helper';
    `,
    'plugins/a/plugin.spec.ts': "import './plugin';",
    'composition/plugins.ts': "export * from '../plugins/a/plugin';",
    'features/editor.spec.ts': "import '../composition/plugins';",
  });
  assert.deepEqual(checkPluginBoundaries(root).errors, []);
});

test('keeps concrete node-type branching out of production host code', (t) => {
  const root = fixture(t, {
    'features/editor.ts': "if (node.nodeType === 'actor') {}; switch(node.nodeType) {}",
    'features/editor.spec.ts': "if (node.nodeType === 'actor') {};",
    'plugins/a/plugin.ts': "if (node.nodeType === 'actor') {};",
  });
  assert.equal(checkPluginBoundaries(root).errors.length, 2);
});
