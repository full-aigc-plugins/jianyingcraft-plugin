// 构建可分发运行制品：适配器打成单文件 ESM，面板与运行时脚本复制到 dist。
// 与 Craft 家族一致：dist/ 不入库，正式发行时才生成并校验。
import { build } from 'esbuild';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

import { buildToolCatalog } from './tools.mjs';

await mkdir('dist', { recursive: true });

await build({
  entryPoints: ['adapter.mjs'],
  outfile: 'dist/adapter.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  // 面板侧的 @modelcontextprotocol/ext-apps 必须留在浏览器侧，不能被打进 Node 目标。
  external: ['@modelcontextprotocol/ext-apps'],
  banner: { js: 'import {createRequire as __createRequire} from "node:module"; const require=__createRequire(import.meta.url);' },
  legalComments: 'linked',
});

// 面板保持独立打包，便于 MCP Apps 面板与 HTTP 宿主共用同一份脚本。
await build({
  entryPoints: ['panel.mjs'],
  outfile: 'dist/panel.js',
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: 'chrome120',
  legalComments: 'linked',
});

await copyFile('panel.html', 'dist/panel.html');
await copyFile('cli.lock.json', 'dist/cli.lock.json');
// adapter 启动第一件事就是读同目录的 config.json；漏掉它 dist 版根本起不来（e2e 会报
// "MCP error -32000: Connection closed"，因为子进程 ENOENT 直接退出）。
await copyFile('config.json', 'dist/config.json');
// 第二块界面（派生引擎编辑器）的页面与引导脚本也要随 dist 走，否则读资源时才 ENOENT。
await copyFile('panel-editor.html', 'dist/panel-editor.html');
await copyFile('editor-boot.mjs', 'dist/editor-boot.mjs');
await copyFile('connect.js', 'dist/connect.js');
// 工具目录随构建一起产出：它和 adapter 是同一份工具面，不能一个更新一个落后。
await writeFile('dist/tools.json', `${JSON.stringify(buildToolCatalog(), null, 2)}\n`, 'utf8');

// 产出逐文件摘要：发行时用它核对运行制品，避免"构建成功但内容不对"。
const files = ['adapter.mjs', 'panel.js', 'panel.html', 'panel-editor.html', 'editor-boot.mjs', 'connect.js', 'cli.lock.json', 'config.json', 'tools.json'];
const manifest = { schema: 'jianyingcraft-dist/v1', files: {} };
for (const name of files) {
  const bytes = await readFile(`dist/${name}`);
  manifest.files[name] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}
await writeFile('dist/build-info.json', JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));
