// JianyingCraft 编辑器适配器（photocraft 架构对齐版）。
//
// 与 photocraft 完全一致的调度模型：
//   Agent → MCP 工具 → dispatch() 入队 → **可见面板里的 WASM 引擎执行** → 回报结果
// 编辑引擎跑在面板的 WASM 中，Agent 的每一次剪辑都必须落到用户看得见的那一份文档上；
// 面板没启动时引擎就是"活的"，此时执行命令会直接被拒绝，而不是改一份看不见的副本。
//
// 与 photocraft 的一处**必要差异**：剪映生态需要本机 jianying-cli 做宿主侧动作
// （render proxy 出预览、verify 结构校验、publish 进草稿库）。这些动作发生在宿主侧，
// 不经过面板引擎，因此独立成 engine_cli_run / engine_diagnose，与 command_run 分开，
// 避免把"宿主侧批处理"伪装成"编辑器里的操作"。
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListResourcesRequestSchema, ListToolsRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { existsSync } from 'node:fs';
import { readFile, writeFile, realpath, mkdir, readdir, cp, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { authorizeRequest, workspacePath } from './security.mjs';
import { panelAsset, editorHtml } from './panel-assets.mjs';
import { resolveCli, runCli, diagnose } from './cli-runtime.mjs';
import { TOOL_DESCRIPTIONS as descriptions, TOOL_SCHEMAS as schemas } from './tools.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const APPLICATION = 'jianyingcraft';
const HEARTBEAT_MS = 15000;
const MAX_TRANSFER = 50 * 1024 * 1024;
const REQUEST_MAX = 72 * 1024 * 1024;
const config = JSON.parse(await readFile(join(here, 'config.json'), 'utf8'));

// ---------------------------------------------------------------- 会话状态
let workspace = null;
let opened = false;
let engine = null;        // 宿主侧 jianying-cli 运行时
let catalog = null;       // jianying-cli 命令目录
let runtime = { source: 'bundled', version: config.version, reason: 'not checked' };
const jobs = new Map();
const queue = [];
let origin = null;
let http = null;
let token = null;
let attached = 0;
let activePage = null;

const ok = value => ({
  content: [{ type: 'text', text: JSON.stringify(value ?? null) }],
  structuredContent: value !== null && typeof value === 'object' && !Array.isArray(value) ? value : { value: value ?? null },
});
const fail = e => ({ isError: true, content: [{ type: 'text', text: e.message || String(e) }] });

// ---------------------------------------------------------------- 路径边界
async function scoped(path, writing = false) {
  if (typeof path !== 'string' || !path || isAbsolute(path)) throw new Error('Use a workspace-relative path');
  const root = await realpath(workspace);
  const candidate = resolve(root, path);
  const rel = relative(root, candidate);
  if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) throw new Error('Path escapes workspace');
  if (writing) {
    let current = root;
    for (const part of relative(root, dirname(candidate)).split(sep).filter(Boolean)) {
      current = join(current, part);
      await mkdir(current, { recursive: true });
      const actual = await realpath(current);
      const r = relative(root, actual);
      if (r === '..' || r.startsWith('..' + sep) || isAbsolute(r)) throw new Error('Symlink escapes workspace');
    }
    return candidate;
  }
  const actual = await realpath(candidate);
  const r = relative(root, actual);
  if (r === '..' || r.startsWith('..' + sep) || isAbsolute(r)) throw new Error('Symlink escapes workspace');
  return actual;
}

// ---------------------------------------------------------------- 引擎调度
/** 把动作派发给可见引擎执行。面板未就绪时直接拒绝，绝不静默改一份不可见的文档。 */
async function dispatch(action, args = {}) {
  if (Date.now() - attached > HEARTBEAT_MS) {
    throw new Error('Open the editor panel and wait for editor_status.ready before executing commands');
  }
  if (jobs.size >= 16) throw new Error('Editor queue full');
  return new Promise((accept, reject) => {
    const id = randomUUID();
    const timer = setTimeout(() => {
      jobs.delete(id);
      // 面板已掉线：队列里这条也要拿掉，否则面板回来会把它当新请求重放
      const index = queue.findIndex(x => x.id === id);
      if (index >= 0) queue.splice(index, 1);
      reject(new Error('Editor operation timed out; state is uncertain. Inspect before retrying.'));
    }, HEARTBEAT_MS);
    jobs.set(id, { accept, reject, timer });
    queue.push({ id, action, args });
  });
}

async function ensureCli() {
  if (!engine) engine = await resolveCli();
  return engine;
}

async function ensureCatalog() {
  if (!catalog) {
    const cli = await ensureCli();
    const { stdout } = await runCli(cli.path, ['commands'], { platform: process.platform });
    catalog = JSON.parse(stdout);
  }
  return catalog;
}

/** argv 前若干 token 构成命令路径，其余是参数；取最长匹配。 */
function resolveCliCommand(argv) {
  let best = null;
  for (const candidate of catalog.commands) {
    const tokens = candidate.path.split(' ');
    if (tokens.length > argv.length) continue;
    if (!tokens.every((token, i) => token === argv[i])) continue;
    if (!best || tokens.length > best.tokens) best = { meta: candidate, tokens: tokens.length };
  }
  if (best) return { meta: best.meta, commandArgs: argv.slice(best.tokens) };
  const suggestion = catalog.commands.map(c => c.path).filter(p => p.startsWith(argv[0] ?? '')).slice(0, 8);
  throw new Error(
    `命令目录中没有 ${JSON.stringify(argv.join(' '))}。可用命令共 ${catalog.commands.length} 个。`
    + (suggestion.length ? `\n相近命令：${suggestion.join(', ')}` : '')
    + '\n用 engine_cli_list 查看完整目录。');
}

function validateArgv(argv) {
  if (!Array.isArray(argv) || argv.length === 0) {
    throw new Error('engine_cli_run 需要 argv 数组，例如 ["render","proxy","draft-a","--json"]');
  }
  for (const arg of argv) {
    if (typeof arg !== 'string') throw new Error('argv 每个元素必须是字符串');
    if (/[;&|`$<>\n\r]/.test(arg)) throw new Error(`参数含 shell 元字符，已拒绝: ${arg}`);
  }
  return argv;
}

// ---------------------------------------------------------------- 工具
// 工具面与说明的唯一来源是 `ui/tools.mjs`；`dist/tools.json` 由 `ui/build-tools.mjs` 生成。
// 这里只保留别名（schemas / descriptions），避免调用点扩散。

async function call(name, args = {}) {
  if (name.startsWith('_panel_')) {
    if (typeof args.pageId !== 'string' || !args.pageId) throw new Error('Missing panel identity');
    const stale = Date.now() - attached >= HEARTBEAT_MS;
    if (activePage && activePage !== args.pageId && !stale) throw new Error('Editor already has an active page');
    activePage = args.pageId;
    attached = Date.now();
    if (name === '_panel_poll') {
      return ok(queue.shift() ?? null);
    }
    if (name === '_panel_reply') {
      const pending = jobs.get(args.id);
      if (pending) {
        jobs.delete(args.id);
        clearTimeout(pending.timer);
        args.error ? pending.reject(new Error(args.error)) : pending.accept(args.result);
      }
      return ok({});
    }
    if (name === '_panel_download') {
      const bytes = Buffer.from(args.data, 'base64');
      if (bytes.length > MAX_TRANSFER) throw new Error('Export exceeds 50 MiB');
      const target = await scoped(`craft-exports/${randomUUID().slice(0, 8)}-${basename(args.name || 'export').replace(/[^\p{L}\p{N}._ -]/gu, '_')}`, true);
      await writeFile(target, bytes, { flag: 'wx' });
      return ok({ path: target });
    }
    throw new Error('Unknown panel operation');
  }

  if (name === 'engine_diagnose') return ok(await diagnose());

  if (name === 'open_editor' || name === 'open_browser_editor') {
    if (args.workspace && resolve(args.workspace) !== workspace) {
      if (opened) throw new Error('Save and close this instance before changing workspace');
      workspace = await realpath(workspacePath(args.workspace));
    }
    if (!workspace) throw new Error('Set an absolute workspace path before opening the editor');
    await ensureHttp();
    // 打开编辑器就把宿主侧运行时解析好：open_editor 的 engineRuntime 必须能反映真实版本。
    // CLI 不可用不影响面板启动，此时 engineRuntime 为 null，由调用方决定是否降级。
    try { await ensureCli(); } catch { /* 保持 null，不阻塞打开 */ }
    opened = true;
    const result = {
      editor: APPLICATION,
      workspace,
      runtime,
      engineRuntime: engine ? { version: engine.version, platform: engine.platform, source: engine.source } : null,
      editorUrl: `${origin}/${token}/app/`,
      ready: Date.now() - attached < HEARTBEAT_MS,
    };
    if (args.path) result.openAfterReady = { tool: 'open_file', arguments: { path: args.path } };
    return ok(result);
  }

  if (!opened) throw new Error('Call open_editor first');

  if (name === 'editor_status') {
    return ok({
      editor: APPLICATION,
      workspace,
      runtime,
      engineRuntime: engine ? { version: engine.version, platform: engine.platform, source: engine.source } : null,
      ready: Date.now() - attached < HEARTBEAT_MS,
      queued: queue.length,
      pending: jobs.size,
    });
  }

  if (name === 'command_list') {
    const result = await dispatch('command_list');
    return ok(result);
  }

  if (name === 'command_run') {
    if (typeof args.id !== 'string' || !args.id) throw new Error('command_run requires an engine command id');
    const result = await dispatch('command_run', { id: args.id, params: args.params ?? {} });
    return ok(result);
  }

  if (name === 'inspect') {
    return ok(await dispatch('inspect'));
  }

  if (name === 'open_file') {
    const data = await readFile(await scoped(args.path));
    if (data.length > MAX_TRANSFER) throw new Error('Input exceeds 50 MiB');
    return ok(await dispatch('open_file', { name: basename(args.path), data: data.toString('base64') }));
  }

  if (name === 'save_project') {
    const target = await scoped(args.path, true);
    const result = await dispatch('save_project');
    if (!result?.base64) throw new Error('Editor returned no file');
    const bytes = Buffer.from(result.base64, 'base64');
    if (bytes.length > MAX_TRANSFER) throw new Error('Output exceeds 50 MiB');
    await writeFile(target, bytes, { flag: 'wx' });
    return ok({ path: target, bytes: bytes.length });
  }

  if (name === 'save_file') {
    const source = await scoped(args.source);
    const target = await scoped(args.path, true);
    await cp(source, target, { errorOnExist: true, force: false });
    return ok({ path: target });
  }

  if (name === 'list_files') {
    const root = await realpath(workspace);
    const out = [];
    const walk = async (dir, depth) => {
      if (depth > 3) return;
      let entries = [];
      try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        if (entry.name === '.git' || entry.name === 'node_modules') continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) await walk(full, depth + 1);
        else out.push(relative(root, full).split(sep).join('/'));
      }
    };
    await walk(root, 0);
    return ok({ workspace: root, files: out.slice(0, 2000), count: out.length });
  }

  if (name === 'screenshot') {
    const shot = await dispatch('capture');
    if (!shot?.base64) throw new Error('Panel returned no frame');
    return { content: [{ type: 'image', mimeType: 'image/png', data: shot.base64 }] };
  }

  if (name === 'engine_cli_list') {
    const cat = await ensureCatalog();
    const search = typeof args.search === 'string' ? args.search.toLowerCase() : null;
    const commands = search
      ? cat.commands.filter(c => c.path.toLowerCase().includes(search) || String(c.summary ?? '').toLowerCase().includes(search))
      : cat.commands;
    return ok({
      schema: cat.schema,
      cli_version: cat.cli_version,
      catalogueTotal: cat.commands.length,
      search: search ?? null,
      returned: commands.length,
      commands: commands.map(c => ({
        path: c.path, summary: c.summary ?? null,
        deprecated: c.deprecated ?? false, replacement: c.replacement ?? null,
        input_schema: c.input_schema ?? null,
      })),
    });
  }

  if (name === 'engine_cli_run') {
    const argv = validateArgv(args.argv);
    const cli = await ensureCli();
    await ensureCatalog();
    const { meta, commandArgs } = resolveCliCommand(argv);
    const { stdout, stderr } = await runCli(cli.path, argv, { cwd: workspace, platform: process.platform });
    let payload = null;
    const trimmed = String(stdout).trim();
    if (trimmed) { try { payload = JSON.parse(trimmed); } catch { payload = { raw: trimmed }; } }
    if (stderr && String(stderr).trim()) payload = { ...(payload ?? {}), diagnostics: String(stderr).trim().split('\n').slice(-8) };
    if (meta.deprecated) payload = { ...(payload ?? {}), deprecation: { command: meta.path, replacement: meta.replacement ?? null } };
    return ok({ command: meta.path, commandArgs, result: payload });
  }

  throw new Error(`Unknown tool ${name}`);
}

// ---------------------------------------------------------------- 本地 HTTP 宿主
async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > REQUEST_MAX) throw new Error('Request too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString());
}

async function ensureHttp() {
  if (http) return;
  token = randomBytes(32).toString('hex');
  // dist 包里没有 engine/（40 MB，gitignored）：从 dist 运行时回退到仓库的 ui/engine。
  const engineRoot = [join(here, 'engine'), join(here, '..', 'engine')].find((dir) => existsSync(dir)) ?? join(here, 'engine');
  http = createServer(async (req, res) => {
    try {
      const path = new URL(req.url, 'http://127.0.0.1').pathname;
      const [, provided, ...rest] = path.split('/');
      if (!authorizeRequest(req, origin, token, provided)) { res.writeHead(403).end(); return; }
      const route = rest.join('/');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Referrer-Policy', 'no-referrer');
      if (req.method === 'GET' && route === 'poll') {
        const page = req.headers['x-craft-page'];
        if (!page || (activePage && activePage !== page && Date.now() - attached < HEARTBEAT_MS)) {
          res.writeHead(409).end('Editor already has an active page'); return;
        }
        activePage = page;
        attached = Date.now();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(queue.shift() ?? null));
        return;
      }
      if (req.method === 'POST' && route === 'reply') {
        if (req.headers['x-craft-page'] !== activePage) throw new Error('Inactive editor page');
        const { id, result, error } = await readBody(req);
        const pending = jobs.get(id);
        if (pending) {
          jobs.delete(id); clearTimeout(pending.timer);
          error ? pending.reject(new Error(error)) : pending.accept(result);
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({}));
        return;
      }
      if (req.method === 'GET' && route === 'connect.js') {
        res.setHeader('Content-Type', 'text/javascript');
        res.end(`globalThis.__craftStandaloneApplication=${JSON.stringify(APPLICATION)};\n` + await readFile(join(here, 'connect.js'), 'utf8'));
        return;
      }
      if (req.method === 'GET' && route.startsWith('app/')) {
        const rel = decodeURIComponent(route.slice(4)) || 'index.html';
        const file = resolve(engineRoot, rel);
        if (!file.startsWith(engineRoot + sep)) throw new Error('Invalid asset path');
        const actual = await realpath(file);
        if (!actual.startsWith(engineRoot + sep)) throw new Error('Invalid asset target');
        if (rel === 'sw.js') { res.writeHead(404).end(); return; }

        const types = {
          '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
          '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png',
          '.json': 'application/json', '.woff2': 'font/woff2',
        };
        res.setHeader('Content-Type', types[extname(file).toLowerCase()] ?? 'application/octet-stream');
        let data = await readFile(file);
        if (rel === 'index.html') data = Buffer.from(data.toString().replace('</head>', '<script type="module" src="../connect.js"></script></head>'));
        res.end(data);
        return;
      }
      res.writeHead(404).end();
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: e.message }));
    }
  });
  await new Promise(r => http.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${http.address().port}`;
}

// ---------------------------------------------------------------- MCP 服务
const uri = `ui://${APPLICATION}/panel.html`;
// 第二个界面：承载派生引擎（craft_* 桥）的编辑器页。旧 panel.html 保留为草稿查看器。
const editorUri = `ui://${APPLICATION}/editor.html`;
const extraMetadata = process.env.CRAFT_PANEL_METADATA_FILE
  ? JSON.parse(await readFile(process.env.CRAFT_PANEL_METADATA_FILE, 'utf8'))
  : {};
const metadata = { ...extraMetadata, ui: { resourceUri: uri, surface: 'editor', visibility: ['model', 'app'] } };
const server = new Server(
  { name: `${APPLICATION}-editor`, version: '0.1.0' },
  { capabilities: { tools: {}, resources: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: Object.entries(schemas).map(([name, properties]) => ({
    name,
    description: descriptions[name] ?? '面板内部通道，仅供 JianyingCraft 面板调用',
    inputSchema: { type: 'object', properties },
    ...(name === 'open_editor' ? { _meta: metadata }
      : name.startsWith('_panel_') ? { _meta: { ui: { visibility: ['app'] } } } : {}),
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
  try { return await call(params.name, params.arguments ?? {}); }
  catch (e) { return fail(e); }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    { uri, name: 'JianyingCraft editor', mimeType: 'text/html;profile=mcp-app', _meta: metadata },
    { uri: editorUri, name: 'JianyingCraft engine editor', mimeType: 'text/html;profile=mcp-app', _meta: metadata },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async ({ params }) => {
  if (params.uri.startsWith(`ui://${APPLICATION}/assets/`)) return panelAsset(join(here, 'engine'), params.uri, `ui://${APPLICATION}/assets/`);
  if (params.uri === editorUri) {
    const html = await readFile(join(here, 'panel-editor.html'), 'utf8');
    const boot = await readFile(join(here, 'editor-boot.mjs'), 'utf8');
    return { contents: [{ uri: editorUri, mimeType: 'text/html;profile=mcp-app', _meta: metadata, text: editorHtml(html, boot) }] };
  }
  if (params.uri !== uri) throw new Error('Unknown resource');
  const html = await readFile(join(here, 'panel.html'), 'utf8');
  const boot = await readFile(join(here, 'panel.js'), 'utf8');
  const text = html.replace('</body>', () => `<script type="module">\n${boot}\n</script></body>`);
  return { contents: [{ uri, mimeType: 'text/html;profile=mcp-app', _meta: metadata, text }] };
});

async function close() {
  for (const pending of jobs.values()) { clearTimeout(pending.timer); pending.reject(new Error('Editor closed')); }
  http?.closeAllConnections();
  http?.close();
  process.exit(0);
}
process.on('SIGTERM', close);
process.on('SIGINT', close);

if (process.argv.includes('--serve')) {
  console.log(JSON.stringify((await call('open_editor')).structuredContent));
} else {
  process.stdin.on('end', close);
  await server.connect(new StdioServerTransport());
}
