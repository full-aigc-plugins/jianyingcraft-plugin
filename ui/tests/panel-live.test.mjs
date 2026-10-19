// 浏览器面板端到端：adapter 提供页面与队列，页面自己轮询 /poll，用 wasm 引擎执行命令再回 /reply。
// 这是"命令落在可见引擎上"在浏览器里的证明（T5 的浏览器版）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const adapterPath = resolve(here, '..', 'dist', 'adapter.mjs');

test('浏览器面板：页面轮询并在 wasm 里执行命令', { skip: process.env.CHROME_PATH ? false : 'CHROME_PATH is not set', timeout: 300000 }, async t => {
  const workspace = await mkdtemp(join(tmpdir(), 'jc-live-'));
  const transport = new StdioClientTransport({ command: process.execPath, args: [adapterPath], cwd: workspace, stderr: 'pipe' });
  const client = new Client({ name: 'live', version: '0.1.0' }, { capabilities: {} });
  await client.connect(transport);
  let browser = null;
  t.after(async () => {
    try { await browser?.close(); } catch {}
    try { await client.close(); } catch {}
    try { await transport.close(); } catch {}
    for (let i = 0; i < 5; i++) { try { await rm(workspace, { recursive: true, force: true }); break; } catch { await new Promise(r => setTimeout(r, 300)); } }
  });
  const call = async (name, args = {}) => {
    const result = await client.callTool({ name, arguments: args });
    const text = result.content?.[0]?.text ?? 'null';
    if (result.isError) throw new Error(`${name}: ${text}`);
    return JSON.parse(text);
  };

  const opened = await call('open_editor', { workspace });
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH, args: ['--enable-unsafe-swiftshader', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  await page.goto(opened.editorUrl, { waitUntil: 'domcontentloaded' });
  // 页面把页面自己初始化好的 wasm 模块挂到 window.__jianyingcraftEngine，连接脚本复用它
  await page.waitForFunction(() => globalThis.__jianyingcraftEngine?.craft_submit, null, { timeout: 120000 });
  await page.waitForTimeout(1500);

  const status = await call('editor_status');
  assert.equal(status.ready, true, 'the served page must poll the adapter');

  await call('command_run', { id: 'file.openDemoProject', params: {} });
  const sequence = await call('command_run', { id: 'sequence.inspect', params: {} });
  const clips = (sequence.video ?? []).reduce((n, track) => n + (track.items ?? []).length, 0);
  assert.ok(clips > 0, `the page engine ran the demo command: ${JSON.stringify(sequence).slice(0, 160)}`);
});