// `dist/tools.json` 的同步与形状校验。
//
// 单一来源是 `ui/tools.mjs`；目录过期时这里会失败，修复方式是：
//   node ui/build-tools.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildToolCatalog, TOOL_SCHEMAS, isPublic } from '../tools.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const catalogPath = join(here, '..', 'dist', 'tools.json');

test('dist/tools.json matches the single source', async () => {
  const onDisk = JSON.parse(await readFile(catalogPath, 'utf8'));
  assert.deepEqual(onDisk, buildToolCatalog(), 'run node ui/build-tools.mjs');
});

test('every public tool carries a description; internal ones are marked internal', () => {
  const catalog = buildToolCatalog();
  assert.equal(catalog.toolCount, Object.keys(TOOL_SCHEMAS).length);
  assert.equal(catalog.publicToolCount, catalog.tools.filter((tool) => tool.public).length);
  for (const tool of catalog.tools) {
    assert.ok(tool.name, 'tool without a name');
    assert.equal(tool.public, isPublic(tool.name), `${tool.name} public flag`);
    if (tool.public) {
      assert.ok(tool.description.length > 0, `${tool.name} has no description`);
    }
  }
});

test('the panel-internal protocol tools stay out of the public surface', () => {
  const catalog = buildToolCatalog();
  const internal = catalog.tools.filter((tool) => tool.name.startsWith('_panel_'));
  assert.equal(internal.length, 3, 'expected poll/reply/download');
  assert.ok(internal.every((tool) => tool.public === false));
  assert.ok(!catalog.tools.some((tool) => tool.public && tool.name.startsWith('_panel_')));
});

test('command_run documents that ids come from command_list', () => {
  const catalog = buildToolCatalog();
  const run = catalog.tools.find((tool) => tool.name === 'command_run');
  assert.ok(run, 'command_run missing');
  assert.match(run.params.id.description, /command_list/);
  assert.equal(run.params.params.type, 'object');
});
