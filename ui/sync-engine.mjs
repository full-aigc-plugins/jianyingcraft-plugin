// 把派生引擎的 Web 发行版同步进插件 `ui/engine/`（面板页从 `/app/` 读它）。
//
// 为什么需要：`cargo xtask web` 产出 ~40 MB wasm，不能进 git；但面板要能加载同一份产物。
// 本模块只做搬运与校验，不构建：源目录由调用方给出（默认 `JIANYINGCRAFT_WEB_DIST`），
// 目标目录写 `build-info.json`（文件列表 + 字节数 + sha256），`--check` 只比对不写。
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** 面板加载引擎时必需的文件；缺一个就拒绝同步。 */
export const REQUIRED = ['index.html', 'filmcraft_web.js', 'filmcraft_web_bg.wasm'];

/** 默认上限：面板一次要下载整份 wasm，超过 60 MiB 先停下来问清楚。 */
export const MAX_BYTES = 60 * 1024 * 1024;

const SKIP = new Set(['build-info.json']);

async function walk(root, dir = root, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(root, full, out);
    } else {
      const rel = relative(root, full).split(sep).join('/');
      if (!SKIP.has(rel)) out.push(rel);
    }
  }
  return out.sort();
}

async function digest(path) {
  const bytes = await readFile(path);
  return { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}

/**
 * 同步引擎发行版。
 * @param {{source: string, dest: string, check?: boolean, maxBytes?: number}} options
 * @returns {Promise<{copied: string[], removed: string[], files: Record<string, {bytes:number, sha256:string}>, totalBytes: number}>}
 */
export async function syncEngine({ source, dest, check = false, maxBytes = MAX_BYTES }) {
  if (!source) throw new Error('syncEngine needs a source directory (JIANYINGCRAFT_WEB_DIST)');
  if (!dest) throw new Error('syncEngine needs a destination directory');

  const available = new Set(await walk(source));
  const missing = REQUIRED.filter((name) => !available.has(name));
  if (missing.length > 0) throw new Error(`engine build is missing ${missing.join(', ')}; run cargo xtask web first`);

  const wanted = [...available];
  const files = {};
  let totalBytes = 0;
  for (const rel of wanted) {
    const info = await digest(join(source, rel));
    files[rel] = info;
    totalBytes += info.bytes;
  }
  if (totalBytes > maxBytes) {
    throw new Error(`engine build is ${totalBytes} bytes, above the ${maxBytes}-byte panel budget`);
  }

  const previous = await readBuildInfo(dest);
  const copied = [];
  const removed = [];
  if (!check) {
    await mkdir(dest, { recursive: true });
    for (const rel of wanted) {
      const target = join(dest, rel);
      await mkdir(join(target, '..'), { recursive: true });
      await copyFile(join(source, rel), target);
      copied.push(rel);
    }
    for (const rel of previous.files ?? []) {
      if (!wanted.includes(rel)) {
        await rm(join(dest, rel), { force: true });
        removed.push(rel);
      }
    }
    await writeFile(join(dest, 'build-info.json'), `${JSON.stringify({ files, totalBytes, syncedAt: new Date().toISOString() }, null, 2)}\n`);
  }

  return { copied, removed, files, totalBytes };
}

/** 读回目标目录的 build-info.json；没有或损坏时返回 `{files: []}`。 */
export async function readBuildInfo(dest) {
  try {
    const parsed = JSON.parse(await readFile(join(dest, 'build-info.json'), 'utf8'));
    const files = parsed && typeof parsed.files === 'object' && parsed.files !== null ? Object.keys(parsed.files) : [];
    return { files, raw: parsed };
  } catch {
    return { files: [] };
  }
}

/** `--check`：目标目录是否与源一致（缺文件、多文件、哈希不同都算 drift）。 */
export async function engineDrift({ source, dest }) {
  const { files } = await syncEngine({ source, dest, check: true });
  const info = await readBuildInfo(dest);
  const present = new Map();
  for (const rel of info.files) {
    try {
      present.set(rel, await digest(join(dest, rel)));
    } catch {
      // 目标目录里登记了但文件不见了，当作 drift
    }
  }
  const drift = [];
  for (const [rel, want] of Object.entries(files)) {
    const got = present.get(rel);
    if (!got) drift.push({ path: rel, reason: 'missing' });
    else if (got.sha256 !== want.sha256) drift.push({ path: rel, reason: 'sha256' });
  }
  for (const rel of await walk(dest)) {
    if (!Object.hasOwn(files, rel)) drift.push({ path: rel, reason: 'extra' });
  }
  return drift;
}

/** 目标目录里有没有同步过的引擎（供面板启动时判断）。 */
export async function hasEngine(dest) {
  try {
    const info = await stat(join(dest, 'filmcraft_web.js'));
    return info.isFile();
  } catch {
    return false;
  }
}

// 命令行：node ui/sync-engine.mjs [--check] [--source DIR] [--dest DIR]
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const flag = (name) => args.includes(name);
  const value = (name, fallback) => {
    const index = args.indexOf(name);
    return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
  };
  const here = dirname(fileURLToPath(import.meta.url));
  const source = value('--source', process.env.JIANYINGCRAFT_WEB_DIST ?? join(here, '..', '..', 'jianyingcraft', 'target', 'web', 'dist'));
  const dest = value('--dest', join(here, 'engine'));
  try {
    if (flag('--check')) {
      const drift = await engineDrift({ source, dest });
      console.log(JSON.stringify({ check: true, source, dest, drift }, null, 2));
      process.exitCode = drift.length === 0 ? 0 : 1;
    } else {
      const result = await syncEngine({ source, dest });
      console.log(JSON.stringify({ source, dest, copied: result.copied.length, removed: result.removed, totalBytes: result.totalBytes }, null, 2));
    }
  } catch (error) {
    console.error(`sync-engine: ${error.message}`);
    process.exitCode = 2;
  }
}
