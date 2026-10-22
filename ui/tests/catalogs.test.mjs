// 资源目录 / 查询器 / 资源技能的契约测试。
//
// 这些 JSON 是从上游 pyJianYingDraft 原样复制的快照，技能与 action plan 都依赖它们。
// 一旦某个文件被手工改坏、index 计数漂移、技能引用了不存在的目录，这里必须失败。
//
// 运行（在 ui 目录）：
//   node --test tests/catalogs.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const CATALOG_DIR = join(REPO_ROOT, 'catalogs');
const SKILLS_DIR = join(REPO_ROOT, 'skills');
const QUERY = join(CATALOG_DIR, 'query.mjs');
const DOCS_PLAN = join(REPO_ROOT, 'docs', 'action-plan.md');

const SKILLS = [
  'jianyingcraft-resource-audio',
  'jianyingcraft-resource-text',
  'jianyingcraft-resource-sticker',
  'jianyingcraft-resource-effect',
  'jianyingcraft-resource-transition',
  'jianyingcraft-resource-caption',
  'jianyingcraft-resource-filter',
];

/** 已知的字体同编号别名：同一 md5、两个语言名。 */
const FONT_ALIAS_ID = '6766524209620324877';

async function readJson(path) {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw.replace(/^\uFEFF/, ''));
}

async function loadIndex() {
  return readJson(join(CATALOG_DIR, 'index.json'));
}

function runQuery(args, options = {}) {
  return spawnSync(process.execPath, [QUERY, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 60_000,
    ...options,
  });
}

function tableDataRows(stdout) {
  return stdout
    .split(/\r?\n/)
    .filter((line) => line.startsWith('|'))
    .filter((line) => !line.includes('编号'))
    .filter((line) => !/^\|[\s\-|]+\|$/.test(line));
}

test('index.json 声明了全部 16 个资源目录，且每个文件都可解析', async () => {
  const index = await loadIndex();
  assert.equal(index.source.startsWith('GuanYixuan/pyJianYingDraft'), true);
  assert.match(index.source, /Apache-2\.0/);

  const files = (await readdir(CATALOG_DIR))
    .filter((name) => name.endsWith('.json') && name !== 'index.json')
    .map((name) => name.slice(0, -5))
    .sort();
  assert.deepEqual(files, Object.keys(index.catalogs).sort(), 'catalogs/ 文件与 index.json 键不一致');

  for (const category of Object.keys(index.catalogs)) {
    const entries = await readJson(join(CATALOG_DIR, `${category}.json`));
    assert.ok(Array.isArray(entries), `${category}.json 顶层必须是数组`);
    assert.ok(entries.length > 0, `${category}.json 不能为空`);
  }
});

test('每个目录的条目都有 resource_id 与 name，且编号唯一（字体别名例外）', async () => {
  const index = await loadIndex();
  for (const category of Object.keys(index.catalogs)) {
    const entries = await readJson(join(CATALOG_DIR, `${category}.json`));
    const seen = new Set();
    for (const [offset, entry] of entries.entries()) {
      assert.equal(typeof entry.name, 'string', `${category}[${offset}] name 必须是字符串`);
      assert.ok(entry.name.length > 0, `${category}[${offset}] name 不能为空`);
      assert.equal(typeof entry.resource_id, 'string', `${category}[${offset}] resource_id 必须是字符串`);
      assert.match(entry.resource_id, /^\d{6,}$/, `${category}[${offset}] resource_id 必须是数字串`);
      if (seen.has(entry.resource_id)) {
        if (category === 'fonts' && entry.resource_id === FONT_ALIAS_ID) continue;
        assert.fail(`${category} 出现重复 resource_id: ${entry.resource_id} (${entry.name})`);
      }
      seen.add(entry.resource_id);
    }

    if (category === 'fonts') {
      const aliases = entries.filter((entry) => entry.resource_id === FONT_ALIAS_ID);
      assert.equal(aliases.length, 2, '字体别名应恰好两条');
      assert.deepEqual(
        [...new Set(aliases.map((entry) => entry.md5))].length,
        1,
        '字体别名必须是同一 md5，否则不是同一份资源',
      );
    }
  }
});

test('index.json 的 count 与文件长度一致，sha256 也一致', async () => {
  const index = await loadIndex();
  for (const [category, meta] of Object.entries(index.catalogs)) {
    const path = join(CATALOG_DIR, `${category}.json`);
    const entries = await readJson(path);
    assert.equal(entries.length, meta.count, `${category} count 漂移：index=${meta.count} file=${entries.length}`);
    assert.equal(
      entries.filter((entry) => entry.vip === true).length,
      meta.vip,
      `${category} vip 计数漂移`,
    );

    if (typeof meta.sha256 === 'string' && /^[0-9a-f]{64}$/.test(meta.sha256)) {
      const bytes = await readFile(path);
      const digest = createHash('sha256').update(bytes).digest('hex');
      assert.equal(digest, meta.sha256, `${category} sha256 与 index 不一致（文件被改动或复制不完整）`);
    }
  }
});

test('7 个资源技能存在，frontmatter 与目录名一致', async () => {
  for (const skill of SKILLS) {
    const path = join(SKILLS_DIR, skill, 'SKILL.md');
    assert.ok(existsSync(path), `缺少技能文件: skills/${skill}/SKILL.md`);
    const markdown = await readFile(path, 'utf8');
    assert.match(markdown, /^---\n/, `${skill} 缺少 frontmatter`);
    assert.match(markdown, new RegExp(`^name:\\s*${skill}\\s*$`, 'm'), `${skill} frontmatter name 不匹配`);
    assert.match(markdown, /^description:\s*\S+/m, `${skill} 缺少 description`);
    assert.match(markdown, /^license:\s*Apache-2\.0\s*$/m, `${skill} license 必须是 Apache-2.0`);
  }
});

test('每个技能都写清字段含义、20 条编号与查询命令', async () => {
  const index = await loadIndex();
  const allIds = new Set();
  for (const category of Object.keys(index.catalogs)) {
    const entries = await readJson(join(CATALOG_DIR, `${category}.json`));
    for (const entry of entries) allIds.add(entry.resource_id);
  }

  for (const skill of SKILLS) {
    const markdown = await readFile(join(SKILLS_DIR, skill, 'SKILL.md'), 'utf8');

    for (const field of ['resource_id', 'name', 'vip', 'params']) {
      assert.ok(markdown.includes(field), `${skill} 没有解释字段 ${field}`);
    }

    const citedIds = [...markdown.matchAll(/\b\d{16,}\b/g)].map((match) => match[0]);
    const unique = [...new Set(citedIds)];
    assert.ok(unique.length >= 20, `${skill} 只引用了 ${unique.length} 个编号，要求至少 20 条`);
    for (const id of unique) {
      assert.ok(allIds.has(id), `${skill} 引用了目录里不存在的编号: ${id}`);
    }

    assert.match(markdown, /node catalogs\/query\.mjs/, `${skill} 没有写明完整清单的查询命令`);
    assert.match(markdown, /不要凭记忆编造编号/, `${skill} 没有禁止凭记忆编号`);
    assert.match(markdown, /action plan/i, `${skill} 没有说明 action plan 用法`);
  }
});

test('技能里引用的 catalog JSON 文件名都真实存在', async () => {
  const available = new Set(
    (await readdir(CATALOG_DIR)).filter((name) => name.endsWith('.json')),
  );
  for (const skill of SKILLS) {
    const markdown = await readFile(join(SKILLS_DIR, skill, 'SKILL.md'), 'utf8');
    const referenced = new Set(
      [...markdown.matchAll(/catalogs\/([a-z][a-z0-9_]+\.json)/g)].map((match) => match[1]),
    );
    for (const file of referenced) {
      assert.ok(available.has(file), `${skill} 引用了不存在的 catalog 文件: ${file}`);
    }
  }
});

test('query.mjs: transitions --query 3D --limit 3 输出 3 行且包含真实编号', () => {
  const result = runQuery(['transitions', '--query', '3D', '--limit', '3']);
  assert.equal(result.status, 0, result.stderr);
  const lines = result.stdout.trimEnd().split(/\r?\n/);
  // 表头 + 分隔行 + 1 条真实命中（transitions 里只有「3D空间」含 3D）
  assert.equal(lines.length, 3, `期望 3 行，实际 ${lines.length} 行:\n${result.stdout}`);
  assert.match(result.stdout, /7049979667406656014/, '输出必须包含 3D空间 的真实 resource_id');
  assert.match(result.stdout, /3D空间/, '输出必须包含真实名称');
  assert.equal(tableDataRows(result.stdout).length, 1, '只有一个名称命中 3D');
});

test('query.mjs: --limit 截断、--json 数组、--free 过滤、未知分类 exit 1', async () => {
  const limited = runQuery(['transitions', '--query', '翻页', '--limit', '3']);
  assert.equal(limited.status, 0, limited.stderr);
  assert.equal(tableDataRows(limited.stdout).length, 3, '--limit 3 应输出 3 条数据行');

  const json = runQuery(['transitions', '--query', '翻页', '--limit', '2', '--json']);
  assert.equal(json.status, 0, json.stderr);
  const parsed = JSON.parse(json.stdout);
  assert.ok(Array.isArray(parsed));
  assert.equal(parsed.length, 2);
  for (const entry of parsed) {
    assert.equal(typeof entry.resource_id, 'string');
    assert.match(entry.name, /翻页/);
  }

  const defaultLimit = runQuery(['filters', '--json']);
  assert.equal(defaultLimit.status, 0, defaultLimit.stderr);
  assert.equal(JSON.parse(defaultLimit.stdout).length, 20, '默认 limit 必须是 20');

  const free = runQuery(['audio_scene_effects', '--free', '--limit', '0', '--json']);
  assert.equal(free.status, 0, free.stderr);
  const freeEntries = JSON.parse(free.stdout);
  assert.ok(freeEntries.length > 0);
  assert.ok(freeEntries.every((entry) => entry.vip !== true), '--free 不能包含 VIP 条目');
  const all = await readJson(join(CATALOG_DIR, 'audio_scene_effects.json'));
  assert.equal(freeEntries.length, all.filter((entry) => entry.vip !== true).length);

  const unknown = runQuery(['not_a_category']);
  assert.equal(unknown.status, 1, '未知分类必须 exit 1');
  assert.match(unknown.stderr, /可用分类/);
});

test('docs/action-plan.md 定义了 schema，并给出 8 个可解析、编号真实的 action', async () => {
  const markdown = await readFile(DOCS_PLAN, 'utf8');
  assert.match(markdown, /jianyingcraft-action-plan\/v1/);

  const blocks = [...markdown.matchAll(/```json\n([\s\S]*?)```/g)].map((match) => match[1]);
  const planText = blocks.find(
    (block) => block.includes('chuanxi-3day-v1') && block.includes('"id": "a01"') && block.includes('"id": "a08"'),
  );
  assert.ok(planText, '没有找到包含 8 个 action 的示例 JSON');
  const plan = JSON.parse(planText);

  assert.equal(plan.schema, 'jianyingcraft-action-plan/v1');
  assert.equal(plan.actions.length, 8, `示例应有 8 个 action，实际 ${plan.actions.length}`);

  const index = await loadIndex();
  const byId = new Map();
  for (const category of Object.keys(index.catalogs)) {
    const entries = await readJson(join(CATALOG_DIR, `${category}.json`));
    for (const entry of entries) byId.set(entry.resource_id, { ...entry, category });
  }

  const required = ['id', 'action', 'target', 'resource_id', 'resource_name', 'at', 'duration', 'params', 'ui_hint'];
  for (const action of plan.actions) {
    for (const field of required) {
      assert.ok(Object.hasOwn(action, field), `action ${action.id} 缺少字段 ${field}`);
    }
    assert.equal(typeof action.ui_hint, 'string');
    assert.ok(action.ui_hint.length > 0, `action ${action.id} ui_hint 不能为空`);
    assert.equal(typeof action.at, 'object');
    assert.equal(typeof action.duration, 'object');
    assert.equal(Object.keys(action.at).length, 1, `action ${action.id} at 只能有一个时间单位`);
    assert.equal(Object.keys(action.duration).length, 1, `action ${action.id} duration 只能有一个时间单位`);

    if (action.resource_id !== null) {
      const hit = byId.get(action.resource_id);
      assert.ok(hit, `action ${action.id} 的 resource_id 不在任何 catalog 里: ${action.resource_id}`);
      assert.equal(hit.name, action.resource_name, `action ${action.id} 的名称与编号不匹配`);
    }
  }

  // 需求点名要覆盖的动作类型
  const kinds = new Set(plan.actions.map((action) => action.action));
  for (const kind of ['text.animate', 'timeline.transition', 'effects.apply', 'captions.import', 'timeline.place']) {
    assert.ok(kinds.has(kind), `示例缺少动作类型 ${kind}`);
  }
  assert.equal(plan.actions.filter((action) => action.action === 'timeline.transition').length, 2);
});
