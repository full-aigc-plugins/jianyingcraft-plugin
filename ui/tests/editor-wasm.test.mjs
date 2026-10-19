// 跨仓契约测试：插件侧 `editor-boot.mjs` × 派生引擎的 wasm 产物。
//
// 需要先构建引擎的 node 目标绑定：
//   cd ../../jianyingcraft
//   cargo xtask web
//   wasm-bindgen --target nodejs --out-dir target/web/node target/wasm32-unknown-unknown/release/filmcraft_web.wasm
// 然后：
//   JIANYINGCRAFT_WASM_JS=<绝对路径>/filmcraft_web.js node --test ui/tests/editor-wasm.test.mjs
//
// 未设置该变量时整组跳过（不把"没构建"误报成"通过"）。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { createEditorBridge } from '../editor-boot.mjs';

const wasmJs = process.env.JIANYINGCRAFT_WASM_JS;

test('the engine wasm satisfies the panel bridge contract', { skip: wasmJs ? false : 'JIANYINGCRAFT_WASM_JS is not set' }, () => {
  const require = createRequire(import.meta.url);
  const engine = require(wasmJs);
  const bridge = createEditorBridge(engine);

  // 1) 目录同源：wasm 的命令数与 CLI 一致（701）。
  const catalog = bridge.catalog();
  assert.ok(catalog.commands.length >= 700, `expected the full command catalog, got ${catalog.commands.length}`);
  assert.ok(catalog.commands.every((c) => typeof c.id === 'string' && c.id.includes('.')), 'every command needs a namespaced id');

  // 2) 受理：形状正确的请求被接受。
  assert.deepEqual(bridge.submit({ id: 'x-1', command: 'file.newBin', params: {} }), { accepted: true });

  // 3) 失败回包：没有运行中的 App 时，引擎回错误信封而不是静默丢弃。
  const reply = bridge.poll();
  assert.ok(reply, 'the engine must answer every accepted request');
  assert.equal(reply.id, 'x-1');
  assert.equal(reply.ok, false);
  assert.equal(reply.error.code, 'command_failed');
  assert.match(reply.error.message, /not running yet/i);
  assert.equal(bridge.idle(), true);

  // 4) 形状错误在进入引擎前就被挡住。
  assert.deepEqual(bridge.submit({ id: 'x-2' }), { accepted: false, reason: 'missing_command' });
  assert.deepEqual(bridge.submit('not json'), { accepted: false, reason: 'invalid_json' });
});
