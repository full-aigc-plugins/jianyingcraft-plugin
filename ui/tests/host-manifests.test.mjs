// 三宿主清单的**静态一致性**校验（ZCode / Codex / Kimi，加 Claude Code 与 marketplace）。
//
// 这**不是**真机验收：没有安装宿主、没有启动 MCP、没有截图。它只证明"清单存在、能解析、
// 指向同一份 adapter、没有上游品牌残留、技能目录齐全"。真机步骤见
// javaScriptdocs:../docs/host-acceptance.md 与 docs/runbooks/three-host-install.md（在引擎仓）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (relative) => JSON.parse(readFileSync(join(root, relative), 'utf8'));
const text = (relative) => readFileSync(join(root, relative), 'utf8');

const HOSTS = {
  'claude code': '.claude-plugin/plugin.json',
  codex: '.codex-plugin/plugin.json',
  zcode: '.zcode-plugin/plugin.json',
  kimi: 'kimi.plugin.json',
  marketplace: '.agents/plugins/marketplace.json',
};

const SEMVER = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

test('每个宿主都有一份可解析、版本一致的清单', () => {
  const versions = new Map();
  for (const [host, file] of Object.entries(HOSTS)) {
    const manifest = read(file);
    assert.equal(manifest.name, 'jianyingcraft', `${host}: name`);
    assert.match(manifest.version, SEMVER, `${host}: version ${manifest.version}`);
    versions.set(host, manifest.version);
    assert.ok(manifest.description && manifest.description.length > 10, `${host}: description`);
    assert.equal(manifest.license, 'Apache-2.0', `${host}: license`);
    assert.equal(manifest.author?.name, 'Full AIGC Plugins', `${host}: author.name`);
    assert.match(manifest.homepage ?? manifest.repository ?? '', /full-aigc-plugins\/jianyingcraft-plugin/, `${host}: homepage`);
  }
  const distinct = new Set(versions.values());
  assert.equal(distinct.size, 1, `host manifests disagree on the version: ${JSON.stringify([...versions])}`);
});

test('清单没有上游品牌残留', () => {
  for (const file of Object.values(HOSTS)) {
    assert.doesNotMatch(text(file), /filmcraft/i, `${file} still mentions FilmCraft`);
  }
});

test('MCP 条目指向同一份 adapter', () => {
  const entries = {
    codex: read('.codex-plugin/mcp.json'),
    kimi: read('kimi.plugin.json'),
    zcode: read('.mcp.json'),
  };
  for (const [host, manifest] of Object.entries(entries)) {
    const server = manifest.mcpServers?.['jianyingcraft-editor'];
    assert.ok(server, `${host}: jianyingcraft-editor is declared`);
    assert.equal(server.command, 'node', `${host}: command`);
    assert.equal(server.type, 'stdio', `${host}: stdio transport`);
    const target = server.args?.[0] ?? '';
    assert.match(target, /ui\/dist\/adapter\.mjs$/, `${host}: adapter path ${target}`);
    if (host === 'zcode') {
      assert.match(target, /^\$\{CLAUDE_PLUGIN_ROOT\}\//, 'zcode expands the plugin root');
      assert.match(server.env?.CRAFT_PANEL_METADATA_FILE ?? '', /panel-meta\.json$/, 'zcode panel metadata');
    }
  }
});

test('codex 与 zcode 的清单引用自己的 mcp 文件', () => {
  assert.equal(read('.codex-plugin/plugin.json').mcpServers, './.codex-plugin/mcp.json');
  assert.equal(read('.zcode-plugin/plugin.json').mcpServers, './.mcp.json');
});

test('技能目录齐全且每个技能都有 frontmatter', () => {
  const dir = join(root, 'skills');
  const skills = readdirSync(dir).filter((name) => statSync(join(dir, name)).isDirectory());
  assert.ok(skills.length >= 6, `expected at least 6 skills, found ${skills.length}: ${skills}`);
  for (const name of skills) {
    const body = readFileSync(join(dir, name, 'SKILL.md'), 'utf8');
    assert.match(body, /^---\r?\n/, `${name}: frontmatter opens`);
    assert.match(body, /\nname:\s*\S+/, `${name}: frontmatter has a name`);
    assert.match(body, /\ndescription:\s*\S+/, `${name}: frontmatter has a description`);
  }
});

test('每个技能目录名与 frontmatter name 一致', () => {
  const dir = join(root, 'skills');
  for (const name of readdirSync(dir)) {
    if (!statSync(join(dir, name)).isDirectory()) continue;
    const body = readFileSync(join(dir, name, 'SKILL.md'), 'utf8');
    const declared = /^name:\s*(\S+)/m.exec(body)?.[1];
    assert.equal(declared, name, `${name}/SKILL.md declares ${declared}`);
  }
});

test('静态校验不冒充真机验收', () => {
  // 这条用例的意义是提醒：本文件通过 ≠ 三宿主装过。真机证据必须另存。
  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  const hasHostDoc = /(ZCode|Codex|Kimi)/i.test(readme);
  assert.ok(hasHostDoc, 'the README should name the supported hosts so the gap is visible');
});
test('Kimi 的项目级 MCP 配置指向同一份 adapter', () => {
  const cfg = read('.kimi-code/mcp.json');
  const server = cfg.mcpServers?.['jianyingcraft-editor'];
  assert.ok(server, 'kimi mcp.json 应注册 jianyingcraft-editor');
  assert.equal(server.command, 'node');
  assert.deepEqual(server.args, ['ui/dist/adapter.mjs']);
});