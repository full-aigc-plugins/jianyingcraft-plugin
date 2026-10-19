// 生成 `ui/dist/tools.json`：面板桥的工具目录。
//
// 单一来源是 `ui/tools.mjs`；本脚本只负责序列化，不在这里添加或改造工具。
// 用法：node ui/build-tools.mjs [--check]
//   --check  只比较，不写文件；不一致时以非零码退出（CI 用）。

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildToolCatalog } from './tools.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, 'dist', 'tools.json');
const check = process.argv.includes('--check');
const serialized = `${JSON.stringify(buildToolCatalog(), null, 2)}\n`;

if (check) {
  let current = '';
  try {
    current = await readFile(target, 'utf8');
  } catch {
    console.error(`tools.json missing: ${target}`);
    process.exit(1);
  }
  if (current !== serialized) {
    console.error(`tools.json is out of date: run node ui/build-tools.mjs`);
    process.exit(1);
  }
  console.log(`tools.json is up to date (${buildToolCatalog().toolCount} tools)`);
  process.exit(0);
}

await mkdir(dirname(target), { recursive: true });
await writeFile(target, serialized, 'utf8');
const catalog = buildToolCatalog();
console.log(`wrote ${target}: ${catalog.toolCount} tools (${catalog.publicToolCount} public)`);
