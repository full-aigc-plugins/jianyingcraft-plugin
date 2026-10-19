// 编辑器面板页（③）：把派生引擎的桥接模块内联成单文档 MCP App 资源。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { editorHtml } from '../panel-assets.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ui = join(here, '..');

const page = await readFile(join(ui, 'panel-editor.html'), 'utf8');
const boot = await readFile(join(ui, 'editor-boot.mjs'), 'utf8');

test('the editor resource carries the page, the bridge and the startup', () => {
  const html = editorHtml(page, boot);
  assert.match(html, /id="editor-canvas"/);
  assert.match(html, /<script type="module">/);
  assert.match(html, /function createEditorBridge\(/, 'the bridge module is inlined');
  assert.match(html, /createEditorBridge\(engine\)/, 'the page builds the bridge at startup');
  assert.match(html, /__jianyingcraftBridge/, 'the bridge is exposed for the panel script');
  assert.match(html, /__jianyingcraftReady/, 'readiness is observable');
  assert.match(html, /catalog\(\)\.commands\.length/, 'the ready badge reports the real command count');
  assert.match(html, /<\/script><\/body>/, 'the script is injected before the closing body');
});

test('the inlined bridge keeps no module exports', () => {
  const html = editorHtml(page, boot);
  const script = html.slice(html.indexOf('<script type="module">') + '<script type="module">'.length);
  assert.doesNotMatch(script, /^export /m, 'export syntax would break inside a classic inline module scope');
});

test('a page without the canvas is rejected instead of shipping a broken editor', () => {
  assert.throws(() => editorHtml('<html><body></body></html>', boot), /#editor-canvas/);
});

test('a boot module without createEditorBridge is rejected', () => {
  assert.throws(() => editorHtml(page, 'export const x = 1;'), /createEditorBridge/);
});
