// 端到端验收：真的拉起 dist 适配器（MCP stdio），真的调 jianying-cli，真的产出草稿。
//
// 这不是模拟：适配器作为子进程运行，工具调用走 MCP 协议，command_run 走真实 CLI 子进程，
// 草稿文件真实落在磁盘。断言只针对可观察事实（命令目录条数、草稿轨道数、revision 推进）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const adapterPath = resolve(here, '..', 'dist', 'adapter.mjs');

const PLAN = {
  schema: 'jianying-cli-plan/v1',
  name: 'JianyingCraft 验收草稿',
  canvas: { width: 1920, height: 1080, fps: 30 },
  tracks: [
    { type: 'text', name: '字幕轨', segments: [
      { start_us: 0, duration_us: 2000000, text: '第一句字幕' },
      { start_us: 2000000, duration_us: 2000000, text: '第二句字幕' },
      { start_us: 4000000, duration_us: 1500000, text: '第三句字幕' },
    ] },
    { type: 'text', name: '片头轨', segments: [
      { start_us: 0, duration_us: 900000, text: '片头标题' },
    ] },
  ],
};

/** 关闭客户端并等待子进程真正退出，否则 Windows 上删临时目录会 EBUSY。 */
async function shutdown(client, transport, workspace) {
  try { await client.close(); } catch { /* 已断开 */ }
  try { await transport?.close(); } catch { /* 已断开 */ }
  // 给子进程一点时间释放文件句柄，再重试清理
  for (let i = 0; i < 5; i++) {
    try { await rm(workspace, { recursive: true, force: true }); return; }
    catch { await new Promise(r => setTimeout(r, 300)); }
  }
}

async function connect(cwd) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [adapterPath],
    cwd,
    env: { ...process.env, JIANYINGCRAFT_CLI_UPDATE: process.env.JIANYINGCRAFT_CLI_UPDATE ?? 'on' },
    stderr: 'pipe',
  });
  const client = new Client({ name: 'e2e-harness', version: '0.1.0' }, { capabilities: {} });
  await client.connect(transport);
  return { client, transport };
}

/** 工具调用的统一取值：失败时抛出可读错误，测试因此能区分"断言失败"和"调用失败"。 */
async function call(client, name, args = {}) {
  const result = await client.callTool({ name, arguments: args });
  const text = result.content?.find(c => c.type === 'text')?.text ?? '';
  if (result.isError) throw new Error(`${name} 失败: ${text}`);
  return result.structuredContent ?? JSON.parse(text);
}

test('端到端：宿主 CLI 诊断 → 打开工作区 → 真实构建 → 产物落盘', { timeout: 300000 }, async t => {
  const workspace = await mkdtemp(join(tmpdir(), 'jc-e2e-'));
  const { client, transport } = await connect(workspace);
  t.after(() => shutdown(client, transport, workspace));
  await writeFile(join(workspace, 'plan.json'), JSON.stringify(PLAN, null, 2), 'utf8');

  // 1. 引擎诊断：锁定版本与本机可用性都来自真实探测
  const diag = await call(client, 'engine_diagnose');
  assert.equal(diag.lockedVersion, '1.6.31');
  assert.equal(diag.platform, 'win32-x64');
  assert.equal(diag.supported, true);
  assert.equal(diag.cached.ok, true, '真实二进制应已就绪且 sha256 匹配');
  assert.match(diag.cached.sha256, /^[0-9a-f]{64}$/);

  // 2. 未打开编辑器时目录不可用（边界先于能力）
  await assert.rejects(() => call(client, 'engine_cli_list'), /Call open_editor first/);

  // 3. 打开编辑器：宿主运行时就绪，但面板没连接前不得谎报 ready
  const opened = await call(client, 'open_editor', { workspace });
  assert.equal(opened.editor, 'jianyingcraft');
  assert.equal(opened.workspace, resolve(workspace));
  assert.match(opened.editorUrl, /^http:\/\/127\.0\.0\.1:\d+\/[0-9a-f]{64}\/app\/$/);
  assert.equal(opened.engineRuntime.version, '1.6.31');
  assert.equal(opened.ready, false, '没有面板连接时不得谎报 ready');

  // 4. 工作区锁定：已打开后不得换工作区
  await assert.rejects(() => call(client, 'open_editor', { workspace: 'C:/elsewhere' }), /Save and close this instance/);

  // 5. 命令目录来自真实 CLI，且是可读目录而不是猜测
  const catalogue = await call(client, 'engine_cli_list');
  assert.equal(catalogue.schema, 'jianying-command-catalog/v1');
  assert.ok(catalogue.catalogueTotal >= 150, `命令目录过少: ${catalogue.catalogueTotal}`);
  assert.equal(catalogue.returned, catalogue.catalogueTotal);
  assert.ok(catalogue.commands.some(c => c.path === 'render proxy'));
  assert.ok(catalogue.commands.some(c => c.path === 'project build'));
  const filtered = await call(client, 'engine_cli_list', { search: 'render' });
  assert.ok(filtered.returned < catalogue.catalogueTotal, '过滤后返回条数必须少于目录规模');
  assert.equal(filtered.catalogueTotal, catalogue.catalogueTotal);

  // 6. 不存在的命令必须被拒绝，并给出目录规模
  await assert.rejects(() => call(client, 'engine_cli_run', { argv: ['definitely-not-a-command', 'x'] }), /命令目录中没有/);

  // 7. shell 元字符必须被拒绝
  await assert.rejects(() => call(client, 'engine_cli_run', { argv: ['project', 'build', 'plan.json; rm -rf /'] }), /shell 元字符/);

  // 8. 真实构建：草稿文件必须真的落盘
  const built = await call(client, 'engine_cli_run', { argv: ['project', 'build', 'plan.json', '--out', 'draft-a', '--json'] });
  assert.equal(built.result.ok, true, `真实构建应成功: ${JSON.stringify(built.result)}`);
  assert.equal(built.result.data.tracks, 2);
  assert.equal(built.result.data.segments, 4);
  const draft = JSON.parse(await readFile(join(workspace, 'draft-a', 'draft_content.json'), 'utf8'));
  assert.equal(draft.tracks.length, 2);

  // 9. 只读命令同样走真实 CLI
  const inspected = await call(client, 'engine_cli_run', { argv: ['inspect', 'draft-a', '--json'] });
  assert.equal(inspected.result.ok, true, `inspect 应成功: ${JSON.stringify(inspected.result)}`);

  // 10. 文件列表包含真实产物
  const files = await call(client, 'list_files');
  assert.ok(files.files.some(f => f === 'draft-a/draft_content.json'));

  // 11. 路径逃逸必须被拒绝
  await assert.rejects(() => call(client, 'save_file', { source: '../escape', path: 'x.json' }), /escapes workspace/);

  // 12. 复制到新路径，且不覆盖
  const copied = await call(client, 'save_file', { source: 'plan.json', path: 'plan-copy.json' });
  assert.match(copied.path, /plan-copy\.json$/);
  await assert.rejects(() => call(client, 'save_file', { source: 'plan.json', path: 'plan-copy.json' }), /EEXIST/);

  // 13. 状态自述一致
  const status = await call(client, 'editor_status');
  assert.equal(status.workspace, resolve(workspace));
  assert.equal(status.ready, false);
  assert.equal(status.engineRuntime.version, '1.6.31');
});
test('端到端：面板通道需要 pageId，且单活页保护生效', { timeout: 300000 }, async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'jc-panel-'));
  const { client, transport } = await connect(workspace);
  const stderr = [];
  transport.stderr?.on('data', chunk => stderr.push(String(chunk)));
  try {
    await call(client, 'open_editor', { workspace });

    // 先断言"从未有面板连过"的状态：此时心跳为 0，截图必须立即给出可诊断错误，
    // 而不是挂到宿主超时，更不能返回假图片。
    await assert.rejects(() => call(client, 'screenshot'), /Open the editor panel/);
    const cold = await call(client, 'editor_status');
    assert.equal(cold.ready, false);

    await assert.rejects(() => call(client, '_panel_poll', {}), /Missing panel identity/);
    await assert.rejects(() => call(client, '_panel_poll', { pageId: '' }), /Missing panel identity/);

    // 面板一旦取过状态，心跳就新鲜：这是真实语义，ready 必须翻转为 true
    await call(client, '_panel_poll', { pageId: 'page-A' });
    const warm = await call(client, 'editor_status');
    assert.equal(warm.ready, true, '面板刚回报过状态，ready 必须为 true');
    await assert.rejects(() => call(client, '_panel_poll', { pageId: 'page-B' }), /already has an active page/);
  } finally {
    await shutdown(client, transport, workspace);
  }
});
