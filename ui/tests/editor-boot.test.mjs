// `editor-boot.mjs` 的单元测试：用假的 wasm 引擎验证形状校验、回复解析与超时。
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createEditorBridge } from '../editor-boot.mjs';

/** 假引擎：队列 + 一条可编程回复。 */
function fakeEngine({ accept = true, reply = null } = {}) {
  const submitted = [];
  let pending = reply;
  return {
    submitted,
    craft_submit(text) {
      submitted.push(text);
      return accept;
    },
    craft_take_reply() {
      const out = pending;
      pending = null;
      return out ? JSON.stringify(out) : undefined;
    },
    craft_idle() {
      return pending === null;
    },
    craft_catalog() {
      return JSON.stringify({ commands: [{ id: 'file.newBin', label: 'Bin…' }] });
    },
  };
}

test('accepts a well-formed request and reports the engine verdict', () => {
  const engine = fakeEngine();
  const bridge = createEditorBridge(engine);
  assert.deepEqual(bridge.submit({ id: 'q-1', command: 'file.newBin', params: {} }), { accepted: true });
  assert.equal(engine.submitted.length, 1);
  assert.equal(JSON.parse(engine.submitted[0]).id, 'q-1');
});

test('rejects malformed payloads before they reach the engine', () => {
  const engine = fakeEngine();
  const bridge = createEditorBridge(engine);
  assert.equal(bridge.submit('not json').reason, 'invalid_json');
  assert.equal(bridge.submit({ command: 'file.newBin' }).reason, 'missing_id');
  assert.equal(bridge.submit({ id: 'x' }).reason, 'missing_command');
  assert.equal(bridge.submit({ id: 'x', command: 'file.newBin', params: [1] }).reason, 'bad_params');
  assert.equal(engine.submitted.length, 0, 'nothing malformed may reach the engine');
});

test('reports a full queue as a rejection, not a silent drop', () => {
  const bridge = createEditorBridge(fakeEngine({ accept: false }));
  assert.deepEqual(bridge.submit({ id: 'q', command: 'file.newBin' }), { accepted: false, reason: 'queue_full' });
});

test('parses replies and treats an empty queue as null', () => {
  const bridge = createEditorBridge(fakeEngine({ reply: { id: 'q-1', ok: true, result: { cuts: 2 } } }));
  assert.deepEqual(bridge.poll(), { id: 'q-1', ok: true, result: { cuts: 2 } });
  assert.equal(bridge.poll(), null);
  assert.equal(bridge.idle(), true);
});

test('a corrupt reply becomes an error envelope instead of throwing', () => {
  const engine = fakeEngine();
  engine.craft_take_reply = () => '{not json';
  const bridge = createEditorBridge(engine);
  const reply = bridge.poll();
  assert.equal(reply.ok, false);
  assert.equal(reply.error.code, 'bad_reply');
});

test('run() submits, polls and returns the engine reply', async () => {
  const bridge = createEditorBridge(fakeEngine({ reply: { id: 'q-9', ok: false, error: { code: 'command_failed', message: 'no clips selected' } } }));
  const reply = await bridge.run({ id: 'q-9', command: 'timeline.razor' });
  assert.equal(reply.id, 'q-9');
  assert.equal(reply.ok, false);
  assert.equal(reply.error.code, 'command_failed');
});

test('run() times out with a structured error rather than hanging', async () => {
  const bridge = createEditorBridge(fakeEngine({ reply: null }));
  const reply = await bridge.run({ id: 'q-10', command: 'file.newBin' }, { timeoutMs: 60, intervalMs: 10 });
  assert.equal(reply.id, 'q-10');
  assert.equal(reply.ok, false);
  assert.equal(reply.error.code, 'timeout');
});

test('catalog() returns the parsed command list', () => {
  const bridge = createEditorBridge(fakeEngine());
  const catalog = bridge.catalog();
  assert.equal(catalog.commands.length, 1);
  assert.equal(catalog.commands[0].id, 'file.newBin');
});
