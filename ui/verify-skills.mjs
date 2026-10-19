// 校验技能里引用的命令 id 都真实存在于引擎命令目录。
//
// 技能是写给 Agent 的操作手册：写错一个 id，Agent 就会在运行时撞墙。
// 因此把"技能里的 id ⊆ 真实目录"做成可重复执行的检查，而不是一次性人工核对。
//
// 用法：
//   node ui/verify-skills.mjs --catalog <commands.json>
// 其中 <commands.json> 由引擎仓生成：
//   filmcraft-cli commands --json > target/commands.json
//
// 退出码：0 全部存在；1 有缺失；2 用法错误。

import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const skillsRoot = join(here, '..', 'skills');

const args = process.argv.slice(2);
const at = args.indexOf('--catalog');
if (at === -1 || !args[at + 1]) {
  console.error('usage: node ui/verify-skills.mjs --catalog <commands.json>');
  process.exit(2);
}

const raw = await readFile(args[at + 1], 'utf8');
// Windows 上 `Out-File -Encoding utf8` 会带 BOM，JSON.parse 会因此失败。
const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
const catalog = new Set((Array.isArray(parsed) ? parsed : parsed.commands ?? []).map((entry) => entry.id));
if (catalog.size === 0) {
  console.error('catalog is empty; is this the output of `filmcraft-cli commands --json`?');
  process.exit(2);
}

/** 技能里 `namespace.command` 形式的反引号 id；"禁止"章节里的原型命令不算引用。 */
function citedIds(markdown) {
  const body = markdown.split(/^##\s*禁止/m)[0];
  const ids = new Set();
  for (const match of body.matchAll(/`([a-z][a-zA-Z0-9]*\.[a-zA-Z0-9]+)`/g)) {
    ids.add(match[1]);
  }
  return [...ids].sort();
}

const entries = await readdir(skillsRoot, { withFileTypes: true });
let missingTotal = 0;
let checked = 0;
for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  let markdown;
  try {
    markdown = await readFile(join(skillsRoot, entry.name, 'SKILL.md'), 'utf8');
  } catch {
    continue;
  }
  const ids = citedIds(markdown);
  if (ids.length === 0) continue;
  checked += 1;
  const missing = ids.filter((id) => !catalog.has(id));
  missingTotal += missing.length;
  console.log(`${entry.name}: ${ids.length} ids, missing=${missing.length}`);
  for (const id of missing) console.log(`   MISSING ${id}`);
}
console.log(`checked ${checked} skills against ${catalog.size} commands`);
process.exit(missingTotal === 0 ? 0 : 1);
