// 浏览器冒烟：用真实的 Chromium 加载编辑器面板页，确认 wasm 引擎与面板桥都能起来。
//
// 用法（CHROME_PATH 指向 Chromium/Chrome 可执行文件；不设就跳过，退出码 0）：
//   node ui/sync-engine.mjs --source <engine>/target/web/dist
//   CHROME_PATH=.../chrome.exe node ui/browser-smoke.mjs
//
// 这不是单元测试：它真的起一个本地静态服务器、真的跑浏览器、真的读页面上的状态徽标。
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { editorHtml } from './panel-assets.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const engineDir = join(here, 'engine');
const chrome = process.env.CHROME_PATH;
if (!chrome) {
  console.log('browser-smoke: skipped (set CHROME_PATH to a Chromium/Chrome binary)');
  process.exit(0);
}

const types = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://127.0.0.1').pathname;
  if (path === '/editor') {
    const html = await readFile(join(here, 'panel-editor.html'), 'utf8');
    const boot = await readFile(join(here, 'editor-boot.mjs'), 'utf8');
    const page = editorHtml(html, boot).replace('<head>', `<head>
<script type="module">
import init, * as engine from '/engine/filmcraft_web.js';
window.__jianyingcraftEngineReady = (async () => { await init(); return engine; })();
</script>`);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(page);
    return;
  }
  const file = normalize(join(engineDir, decodeURIComponent(path.replace(/^\/engine\//, ''))));
  if (!file.startsWith(normalize(engineDir))) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file).toLowerCase()] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();

const child = spawn(chrome, [
  '--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader',
  '--window-size=1000,600', '--virtual-time-budget=45000',
  '--dump-dom', `http://127.0.0.1:${port}/editor`,
], { stdio: ['ignore', 'pipe', 'ignore'] });

// 有些 Chromium 构建在 --dump-dom 下不会自己退出；到点就杀，避免 CI 挂死。
const killer = setTimeout(() => child.kill(), 90_000);
let dom = '';
child.stdout.on('data', (chunk) => {
  dom += chunk.toString();
});
const code = await new Promise((resolve) => child.on('close', (value) => resolve(value ?? 1)));
clearTimeout(killer);
server.close();

const engineReady = /id="engine" class="badge ok">引擎已加载/.test(dom);
const bridgeReady = /id="bridge" class="badge ok">面板桥就绪 · \d+ 命令/.test(dom);
const commands = /面板桥就绪 · (\d+) 命令/.exec(dom)?.[1];
console.log(JSON.stringify({ exit: code, engineReady, bridgeReady, commands: commands ? Number(commands) : null }));
if (code !== 0 || !engineReady || !bridgeReady || Number(commands) < 700) {
  console.error('browser-smoke: the editor panel did not reach the ready state');
  process.exit(1);
}
