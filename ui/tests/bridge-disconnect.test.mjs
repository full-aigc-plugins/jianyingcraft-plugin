// 桥一致性 T6：面板掉线后，pending 请求必须在心跳窗口内失败，且面板回来不得重放。
//
// 这里不需要浏览器：用 `_panel_poll` 冒充面板心跳，然后停止轮询。
import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const adapterPath = resolve(here, '..', 'dist', 'adapter.mjs');

test('面板掉线：pending 在心跳窗口内失败且不重放', { timeout: 120000 }, async t => {
  const workspace = await mkdtemp(join(tmpdir(), 'jc-bridge-'));
  const transport = new StdioClientTransport({ command: process.execPath, args: [adapterPath], cwd: workspace, stderr: 'pipe' });
  const client = new Client({ name: 'bridge-harness', version: '0.1.0' }, { capabilities: {} });
  await client.connect(transport);
  t.after(async () => {
    try { await client.close(); } catch {}
    try { await transport.close(); } catch {}
    for (let i = 0; i < 5; i++) {
      try { await rm(workspace, { recursive: true, force: true }); break; }
      catch { await new Promise(r => setTimeout(r, 300)); }
    }
  });

  const call = async (name, args = {}) => {
    const result = await client.callTool({ name, arguments: args });
    const text = result.content?.find(c => c.type === 'text')?.text ?? '';
    if (result.isError) throw new Error(`${name} 失败: ${text}`);
    const value = result.structuredContent ?? JSON.parse(text);
    // null 与数组被 ok() 包成 { value }，这里拆掉。
    if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 1 && 'value' in value) {
      return value.value;
    }
    return value;
  };

  await call('open_editor', { workspace });
  // 面板报一次心跳（此刻是"在线"的）
  const beat = await call('_panel_poll', { pageId: 'page-a' });
  assert.equal(beat, null, 'empty queue: heartbeat returns null');
  const status = await call('editor_status');
  assert.equal(status.ready, true, 'a fresh heartbeat means ready');

  // 面板不再轮询；这条命令必须失败，而不是一直挂着
  const started = Date.now();
  await assert.rejects(
    () => call('command_run', { id: 'sequence.inspect', params: {} }),
    /timed out/i,
    'a pending command must fail once the panel stops heart-beating',
  );
  const elapsed = Date.now() - started;
  assert.ok(elapsed >= 14000 && elapsed <= 21000, `the failure should land in the 15 s heartbeat window, got ${elapsed} ms`);

  // 面板"回来"也不能收到这条已被放弃的请求
  const replay = await call('_panel_poll', { pageId: 'page-a' });
  assert.equal(replay, null, 'the abandoned request must not be replayed');
});