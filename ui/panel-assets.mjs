// 移植自 photocraft/filmcraft 的 Craft 适配层：面板资源分块传输。
// MCP Apps 面板不能直接 fetch 大文件，统一走 meta（长度/分片数/sha256）+ chunk（1MiB 分片），
// 面板侧校验 sha256 后再组装，避免传输半个文件就当成加载成功。
import { readFile, realpath } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { createHash } from 'node:crypto';

const CHUNK = 1024 * 1024;

export async function panelAsset(root, uri, prefix) {
  const tail = uri.slice(prefix.length);
  const match = /^(meta|chunk)\/([^/]+)(?:\/(\d+))?$/.exec(tail);
  if (!uri.startsWith(prefix) || !match) throw Error('Unknown panel resource');
  const path = decodeURIComponent(match[2]);
  const base = await realpath(root);
  const file = await realpath(resolve(base, path));
  if (!file.startsWith(base + sep)) throw Error('Asset outside editor');
  const bytes = await readFile(file);
  if (bytes.length > 256 * 1024 * 1024) throw Error('Asset exceeds 256 MiB');
  if (match[1] === 'meta') {
    const mime = {
      '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm',
      '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
    }[extname(file).toLowerCase()] ?? 'application/octet-stream';
    return {
      contents: [{
        uri, mimeType: 'application/json',
        text: JSON.stringify({
          bytes: bytes.length,
          parts: Math.ceil(bytes.length / CHUNK),
          sha256: createHash('sha256').update(bytes).digest('hex'),
          mime,
        }),
      }],
    };
  }
  const part = Number(match[3]);
  if (!Number.isSafeInteger(part) || part * CHUNK >= bytes.length) throw Error('Invalid asset chunk');
  return { contents: [{ uri, mimeType: 'application/octet-stream', blob: bytes.subarray(part * CHUNK, (part + 1) * CHUNK).toString('base64') }] };
}

/**
 * 把上游 HTML 改写成可嵌在 MCP Apps 面板里的形式（photocraft 复用上游编辑器时使用）。
 * JianyingCraft 的面板是自研的，默认不走这里；保留函数是为了将来复用上游 Web 发行版时不用重写。
 */
export function panelHtml(html, boot, application) {
  const modules = [...html.matchAll(/<script\b[^>]*type=["']module["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  if (modules.length !== 1) throw Error('Unsupported upstream module layout');
  let source = modules[0];
  source = source.replace(/import\s+(\w+),\s*\*\s+as\s+(\w+)\s+from\s+["']([^"']+)["'];/g,
    (_, init, ns, path) => `const ${ns}=await window.__craftImport(${JSON.stringify(path)}); const ${init}=${ns}.default;`);
  source = source.replace(/import\s+(\w+),\s*\{([^}]+)\}\s+from\s+["']([^"']+)["'];/g,
    (_, init, names, path) => `const {default:${init},${names}}=await window.__craftImport(${JSON.stringify(path)});`);
  source = source.replace(/import\((["']\.\/[^"']+\.js["'])(?:\s*\+\s*\w+)?\)/g, 'window.__craftImport($1)');
  // 面板没有 PWA 生命周期；不在宿主协议域注册 service worker。
  source = source.replace(/if\s*\("serviceWorker" in navigator/g, 'if (false && "serviceWorker" in navigator');
  const settings = JSON.stringify({ application, source }).replaceAll('<', '\\u003c');
  return html
    .replace(/<script\b[^>]*type=["']module["'][^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace('</body>', () => `<script type="module">const panelSettings=${settings};\n${boot.replaceAll('</script', '<\\/script')}</script></body>`);
}

/**
 * 把派生引擎的编辑器页改写成单文档 MCP App 资源：
 * `editor-boot.mjs` 的源码内联进页面（去掉模块导出），再用页面里的 `__jianyingcraftEngine` 建桥。
 *
 * 为什么内联：MCP App 资源是单个 HTML 文档，`ui://` 下的相对 `import` 取不到同目录模块；
 * 面板资产另有 `assets/meta|chunk` 分块通道，但那需要面板侧先拿到资源引用。
 */
export function editorHtml(html, bootSource) {
  if (!html.includes('id="editor-canvas"')) throw Error('editor page has no #editor-canvas');
  if (!/export function createEditorBridge/.test(bootSource)) throw Error('boot module has no createEditorBridge');
  const bridge = bootSource
    .replace(/\/\/[^\n]*\n/g, '\n') // 注释里可能有 `export`，先去掉行注释再处理关键字
    .replace(/^export function /gm, 'function ')
    .replace(/^export const /gm, 'const ')
    .replace(/^export \{[^}]*\};?$/gm, '');
  const bootstrap = `
// --- editor-boot.mjs（内联）---
${bridge}
// --- 启动 ---
const status = (id, text, ok) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = 'badge ' + (ok ? 'ok' : 'bad');
};
try {
  // 宿主可以直接给模块，也可以给一个"初始化完成后 resolve 成模块"的 Promise
  // （wasm-bindgen 的 init() 是异步的，早于它读取会拿到空对象）。
  const provided = globalThis.__jianyingcraftEngineReady ?? globalThis.__jianyingcraftEngine;
  const engine = provided && typeof provided.then === 'function' ? await provided : provided;
  if (!engine) throw new Error('no engine: build the derived wasm and pass it as window.__jianyingcraftEngine');
  const bridge = createEditorBridge(engine);
  globalThis.__jianyingcraftBridge = bridge;
  status('engine', '引擎已加载', true);
  status('bridge', '面板桥就绪 · ' + bridge.catalog().commands.length + ' 命令', true);
  const boot = document.getElementById('boot');
  if (boot) boot.remove();
  globalThis.__jianyingcraftReady = true;
} catch (error) {
  status('engine', '引擎未加载', false);
  status('bridge', '面板桥未连接', false);
  const detail = document.getElementById('boot-detail');
  if (detail) detail.textContent = String(error && error.message ? error.message : error);
  globalThis.__jianyingcraftError = String(error && error.message ? error.message : error);
}
`;
  return html.replace('</body>', () => `<script type="module">${bootstrap.replaceAll('</script', '<\\/script')}</script></body>`);
}
