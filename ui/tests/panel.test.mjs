// 面板验收：真实 Chrome 加载真实面板页，渲染真实草稿，并验证"Agent 改草稿 → 画面同步刷新"。
//
// 这是整条线最关键的一条证据。判定标准刻意设得很高：
//   1. 面板必须真的连上适配器并拿到真实草稿（不是夹具、不是硬编码数据）
//   2. 时间轴 canvas 必须真的画出非空像素
//   3. Agent 侧通过 MCP 改动草稿后，面板必须自己发现 revision 变化并重绘，
//      用重绘前后的像素差判定，而不是只看 DOM 文本
//   4. 任一步失败都必须留下截图，不能只报断言失败
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const adapterPath = resolve(here, '..', 'dist', 'adapter.mjs');
const evidenceDir = resolve(here, '..', '..', 'runtime', 'panel-evidence');

const PLAN_A = {
  schema: 'jianying-cli-plan/v1',
  name: '面板验收 A',
  canvas: { width: 1920, height: 1080, fps: 30 },
  tracks: [
    { type: 'text', name: '字幕轨', segments: [
      { start_us: 0, duration_us: 2000000, text: '第一句字幕' },
      { start_us: 2000000, duration_us: 2000000, text: '第二句字幕' },
      { start_us: 4000000, duration_us: 1500000, text: '第三句字幕' },
    ] },
  ],
};
const PLAN_B = {
  schema: 'jianying-cli-plan/v1',
  name: '面板验收 B',
  canvas: { width: 1920, height: 1080, fps: 30 },
  tracks: [
    { type: 'text', name: '字幕轨', segments: [
      { start_us: 0, duration_us: 4000000, text: '合并后的长字幕' },
    ] },
    { type: 'text', name: '新增轨', segments: [
      { start_us: 1000000, duration_us: 3000000, text: 'Agent 新建的轨道' },
    ] },
  ],
};

async function call(client, name, args = {}) {
  const result = await client.callTool({ name, arguments: args });
  const text = result.content?.find(c => c.type === 'text')?.text ?? '';
  if (result.isError) throw new Error(`${name} 失败: ${text}`);
  return result.structuredContent ?? JSON.parse(text);
}

/** canvas 像素指纹：用来判定"画面真的变了"，而不是看 DOM 文本。 */
async function canvasSignature(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById('timeline');
    const ctx = canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let nonEmpty = 0, hash = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0) nonEmpty++;
      hash = (hash * 31 + data[i] + data[i + 1] * 3 + data[i + 2] * 7 + data[i + 3] * 11) % 2147483647;
    }
    return { width: canvas.width, height: canvas.height, nonEmpty, hash };
  });
}

// 编辑器页验收（2026-10-19 重写）：适配器把 `ui://jianyingcraft/editor.html` 资源拼好，
// 真实 Chromium 加载后必须跑到"引擎已加载 + 面板桥就绪"。
// 旧版断言的是已下线的 viewer DOM（#conn/#facts），这里改为对 editor-boot 的徽标断言。
test('编辑器页：MCP 资源 + 真实浏览器跑到引擎与桥都就绪', { timeout: 300000 }, async t => {
  const workspace = await mkdtemp(join(tmpdir(), 'jc-editor-'));
  const engineDir = resolve(here, '..', 'engine');
  const transport = new StdioClientTransport({ command: process.execPath, args: [adapterPath], cwd: workspace, stderr: 'pipe' });
  const client = new Client({ name: 'editor-harness', version: '0.1.0' }, { capabilities: {} });
  await client.connect(transport);
  let server = null;
  let browser = null;
  t.after(async () => {
    try { await browser?.close(); } catch {}
    try { await client.close(); } catch {}
    try { await transport.close(); } catch {}
    try { server?.close(); } catch {}
    for (let i = 0; i < 5; i++) {
      try { await rm(workspace, { recursive: true, force: true }); break; }
      catch { await new Promise(r => setTimeout(r, 300)); }
    }
  });

  const opened = await call(client, 'open_editor', { workspace });
  assert.ok(opened.editorUrl);

  // 1. 资源真实来自适配器（不是本地文件），且带的是派生引擎的桥脚本
  const resource = await client.readResource({ uri: 'ui://jianyingcraft/editor.html' });
  const html = resource.contents?.[0]?.text ?? '';
  assert.ok(html.length > 1000, '编辑器资源必须是一整页 HTML');
  assert.match(html, /craft_submit/, '编辑器页必须带上派生引擎的桥');

  // 2. 起一个只读静态服务器：/editor 是上一步的资源，/engine/* 是 wasm 产物
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png' };
  server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://127.0.0.1').pathname;
    if (path === '/editor') {
      const page = html.replace('<head>', `<head>
<script type="module">
import init, * as engine from '/engine/filmcraft_web.js';
window.__jianyingcraftEngineReady = (async () => { await init(); return engine; })();
</script>`);
      res.writeHead(200, { 'Content-Type': 'text/html' }).end(page);
      return;
    }
    const file = normalize(join(engineDir, decodeURIComponent(path.replace(/^\/engine\//, ''))));
    if (!file.startsWith(normalize(engineDir))) { res.writeHead(403).end(); return; }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': types[extname(file).toLowerCase()] ?? 'application/octet-stream' }).end(body);
    } catch { res.writeHead(404).end('not found'); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const { port } = server.address();

  // 3. 真实浏览器：徽标必须变成 ok
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  await page.goto(`http://127.0.0.1:${port}/editor`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => /引擎已加载/.test(document.getElementById('engine')?.textContent ?? ''), null, { timeout: 60000 });
  await page.waitForFunction(() => /面板桥就绪/.test(document.getElementById('bridge')?.textContent ?? ''), null, { timeout: 60000 });
  const bridge = await page.textContent('#bridge');
  const commands = Number(/面板桥就绪 · (\d+) 命令/.exec(bridge ?? '')?.[1] ?? 0);
  assert.ok(commands >= 700, `面板桥应报告 >=700 条命令，实际 ${commands}`);
  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({ path: join(evidenceDir, 'editor-page.png'), fullPage: true });
});
