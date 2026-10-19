// 浏览器端到端：在真实 Chromium 里启动 JianyingCraft（wasm），用控制通道执行命令并检查结果。
//
// 用法：
//   cargo xtask web                                   # 产出 target/web/dist
//   CHROME_PATH=.../chrome.exe \
//   JIANYINGCRAFT_WEB_DIST=<abs>/target/web/dist \
//   node ui/browser-app-smoke.mjs
//
// 缺 CHROME_PATH 或 dist 时 skip（退出 0），不把"没装浏览器/没构建"报告成通过。
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const chrome = process.env.CHROME_PATH;
const dist = process.env.JIANYINGCRAFT_WEB_DIST;
if (!chrome || !dist) {
  console.log('browser-app-smoke: skipped (set CHROME_PATH and JIANYINGCRAFT_WEB_DIST)');
  process.exit(0);
}

const types = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png' };
const page = `<!doctype html><html><body>
<canvas id="filmcraft_canvas" width="960" height="540"></canvas>
<script type="module">
const report = { ok: false };
const send = () => fetch('/result', { method: 'POST', body: JSON.stringify(report) }).catch(() => {});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  const module = await import('/app/filmcraft_web.js');
  await module.default({ module_or_path: new URL('/app/filmcraft_web_bg.wasm', location.href) });
  await module.start('filmcraft_canvas');
  report.started = true;
  for (let i = 0; i < 60 && typeof window.filmcraft !== 'object'; i += 1) await wait(250);
  report.hasApi = typeof window.filmcraft === 'object';
  report.demo = await window.filmcraft.execute('file.openDemoProject', {});
  const before = await window.filmcraft.execute('sequence.inspect', {});
  report.videoClipsBefore = before.video.reduce((n, t) => n + t.items.length, 0);
  report.durationFrames = before.durationFrames;
  report.split = await window.filmcraft.execute('sequence.addEdit', {});
  const after = await window.filmcraft.execute('sequence.inspect', {});
  report.videoClipsAfterSplit = after.video.reduce((n, t) => n + t.items.length, 0);
  report.undo = await window.filmcraft.execute('edit.undo', {});
  const restored = await window.filmcraft.execute('sequence.inspect', {});
  report.videoClipsAfterUndo = restored.video.reduce((n, t) => n + t.items.length, 0);
  report.ok = true;
} catch (error) {
  report.error = String(error && error.stack ? error.stack : error);
}
send();
</script></body></html>`;

let resolveResult;
const result = new Promise((resolve) => {
  resolveResult = resolve;
});
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://127.0.0.1').pathname;
  if (req.method === 'POST' && path === '/result') {
    let body = '';
    for await (const chunk of req) body += chunk;
    res.writeHead(200).end('ok');
    resolveResult(JSON.parse(body));
    return;
  }
  if (path === '/' || path === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(page);
    return;
  }
  if (!path.startsWith('/app/')) {
    res.writeHead(404).end('not found');
    return;
  }
  const file = normalize(join(dist, decodeURIComponent(path.slice('/app/'.length))));
  if (!file.startsWith(normalize(dist))) {
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

const child = spawn(chrome, ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=960,540', `http://127.0.0.1:${port}/`], {
  stdio: 'ignore',
});
const timeout = setTimeout(() => {
  console.error('browser-app-smoke: the app did not report within 180 s');
  child.kill();
  server.close();
  process.exit(1);
}, 180_000);

const report = await result;
clearTimeout(timeout);
child.kill();
server.close();
console.log(JSON.stringify(report));

const pass =
  report.ok === true &&
  report.hasApi === true &&
  typeof report.videoClipsBefore === 'number' &&
  // `cuts` 统计的是所有轨道上的切口；只比较视频片段数是否增加，以及撤销是否完全还原。
  report.videoClipsAfterSplit > report.videoClipsBefore &&
  report.videoClipsAfterUndo === report.videoClipsBefore;
if (!pass) {
  console.error('browser-app-smoke: the command round-trip did not hold');
  process.exit(1);
}
