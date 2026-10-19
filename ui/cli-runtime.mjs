// jianying-cli 运行时解析：定位、校验、拉取并拉起剪映引擎。
//
// 与 photocraft 的根本差异：photocraft 引用上游 Web 编辑器产物（editor.lock.json 是"引用清单"），
// 而 JianyingCraft 的引擎是自有的 Rust 二进制，所以 cli.lock.json 是"自产清单"——
// 本模块必须自己负责：找到二进制、校验 sha256、必要时按锁下载、最后拉起 MCP server。
//
// 失败原则：缺资源必须返回**可诊断错误**，绝不返回伪造的成功。
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rm, rename, chmod, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, dirname, resolve, sep } from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** 把 Node 的 platform/arch 映射到 lock 里登记的键。返回 null 表示该平台没有锁定产物。 */
export function platformKey(platform = process.platform, arch = process.arch) {
  if (platform === 'darwin') return arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
  if (platform === 'win32') return arch === 'x64' ? 'win32-x64' : null;
  if (platform === 'linux') return arch === 'x64' ? 'linux-x64' : null;
  return null;
}

/** 二进制文件名。Windows 是 .exe，其余平台无扩展名。 */
export function binaryName(platform = process.platform) {
  return platform === 'win32' ? 'jianying.exe' : 'jianying';
}

/** 缓存目录：沿用 Craft 家族既有的 ~/.cache/full-aigc/editors/<name>/ 约定。 */
export function cacheRoot(name = 'jianyingcraft', home = homedir()) {
  return join(home, '.cache', 'full-aigc', 'editors', name);
}

export function binaryPath(name, version, home = homedir(), platform = process.platform) {
  return join(cacheRoot(name, home), `${version}-${platformKey(platform)}`, binaryName(platform));
}

export async function sha256File(path) {
  const { createReadStream } = await import('node:fs');
  const hash = createHash('sha256');
  await new Promise((resolveStream, rejectStream) => {
    const stream = createReadStream(path);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', rejectStream);
    stream.on('end', resolveStream);
  });
  return hash.digest('hex');
}

async function exists(path) {
  try { await access(path, constants.X_OK); return true; } catch { return false; }
}

export async function readLock(path = join(here, 'cli.lock.json')) {
  const lock = JSON.parse(await readFile(path, 'utf8'));
  if (lock.schema !== 'jianying-plugin-cli-lock/v1') throw new Error(`不支持的 CLI lock 协议: ${lock.schema}`);
  if (!lock.resolvedVersion || !lock.artifacts) throw new Error('CLI lock 缺少 resolvedVersion 或 artifacts');
  return lock;
}

/**
 * 探测单个候选路径：存在且 sha256 匹配才算可用。
 * 故意不匹配时返回原因而不是静默降级——错误必须能被发现。
 */
export async function probe(candidate, expectedSha, platform = process.platform) {
  if (!(await exists(candidate))) return { ok: false, reason: 'missing' };
  const digest = await sha256File(candidate);
  if (expectedSha && digest !== expectedSha) return { ok: false, reason: 'sha256_mismatch', sha256: digest };
  try {
    const { stdout } = await runCli(candidate, ['--version'], { timeoutMs: 20000, platform });
    return { ok: true, path: candidate, sha256: digest, version: String(stdout).trim() };
  } catch (e) {
    return { ok: false, reason: 'not_executable', detail: e.message };
  }
}

/** 执行一次 CLI 命令，带超时和 stderr 诊断。 */
export function runCli(binary, args, { timeoutMs = 600000, cwd, platform = process.platform } = {}) {
  return new Promise((resolvePromise, reject) => {
    execFile(binary, args, {
      cwd, timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024,
      windowsHide: true, shell: false,
    }, (error, stdout, stderr) => {
      if (error) {
        const detail = String(stderr || error.message).trim().split('\n').slice(-6).join('\n');
        error.cliDetail = detail;
        reject(error);
        return;
      }
      resolvePromise({ stdout, stderr });
    });
  });
}

/** 从 GitHub Release 下载并解包锁定产物到缓存目录，先验归档再验二进制。 */
export async function downloadArtifact(artifact, version, target, { fetchImpl = fetch } = {}) {
  await mkdir(dirname(target), { recursive: true });
  const response = await fetchImpl(artifact.url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`下载 ${artifact.url} 失败: HTTP ${response.status}`);
  const archive = Buffer.from(await response.arrayBuffer());
  const archiveDigest = createHash('sha256').update(archive).digest('hex');
  if (artifact.archiveSha256 && archiveDigest !== artifact.archiveSha256) {
    throw new Error(`归档 sha256 不匹配\n  期望 ${artifact.archiveSha256}\n  实际 ${archiveDigest}`);
  }
  const staging = join(tmpdir(), `jianyingcraft-${version}-${Date.now()}`);
  await mkdir(staging, { recursive: true });
  try {
    const { extractBinary } = await import('./archive.mjs');
    const extracted = await extractBinary(archive, target, staging);
    const digest = await sha256File(extracted);
    if (artifact.binarySha256 && digest !== artifact.binarySha256) {
      throw new Error(`二进制 sha256 不匹配\n  期望 ${artifact.binarySha256}\n  实际 ${digest}`);
    }
    await chmod(extracted, 0o755).catch(() => {});
    await rename(extracted, target);
    return { path: target, sha256: digest };
  } finally {
    await rm(staging, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * 解析引擎。顺序：显式环境变量 → 缓存 → PATH → （按锁下载）。
 * JIANYINGCRAFT_CLI_UPDATE=off 禁止下载，此时缺资源直接给出可诊断错误。
 */
export async function resolveCli({ lockPath, env = process.env } = {}) {
  const lock = await readLock(lockPath);
  const version = lock.resolvedVersion;
  const key = platformKey();
  if (!key) {
    throw new Error(`当前平台 ${process.platform}/${process.arch} 没有锁定的 jianying-cli 产物；`
      + `请在 ui/cli.lock.json 补充 ${process.platform}-${process.arch} 条目后重试`);
  }
  const artifact = lock.artifacts[key];
  if (!artifact) {
    throw new Error(`CLI lock ${version} 缺少平台 ${key} 的产物；已登记的平台：${Object.keys(lock.artifacts).join(', ')}`);
  }
  const expected = artifact.binarySha256;
  const attempts = [];

  if (env.JIANYINGCRAFT_CLI_BIN) {
    const candidate = resolve(env.JIANYINGCRAFT_CLI_BIN);
    const result = await probe(candidate, expected);
    if (result.ok) return { ...result, version, source: 'env', platform: key };
    attempts.push(`JIANYINGCRAFT_CLI_BIN=${candidate} → ${result.reason}`);
  }

  const cached = binaryPath('jianyingcraft', version);
  const cachedResult = await probe(cached, expected);
  if (cachedResult.ok) return { ...cachedResult, version, source: 'cache', platform: key };
  attempts.push(`缓存 ${cached} → ${cachedResult.reason}`);

  if (env.JIANYINGCRAFT_CLI_UPDATE === 'off') {
    throw new Error([
      `找不到可用的 jianying-cli ${version}（${key}），且已设置 JIANYINGCRAFT_CLI_UPDATE=off 禁止下载。`,
      '已尝试：', ...attempts.map(a => `  - ${a}`),
      `解决方式：手工把 ${artifact.binarySha256 ? '对应 sha256 的' : ''}二进制放到 ${cached}，`
      + `或设置 JIANYINGCRAFT_CLI_BIN 指向本机 jianying-cli。`,
    ].join('\n'));
  }

  const downloaded = await downloadArtifact(artifact, version, cached);
  const verify = await probe(downloaded.path, expected);
  if (!verify.ok) throw new Error(`下载后的二进制校验失败: ${verify.reason}`);
  return { ...verify, version, source: 'download', platform: key };
}

/** 引擎诊断：供面板与故障排查使用，不做安装动作。 */
export async function diagnose({ lockPath, env = process.env } = {}) {
  const lock = await readLock(lockPath);
  const key = platformKey();
  const cached = binaryPath('jianyingcraft', lock.resolvedVersion);
  const result = await probe(cached, lock.artifacts[key]?.binarySha256).catch(e => ({ ok: false, reason: e.message }));
  return {
    engine: 'jianying-cli',
    lockedVersion: lock.resolvedVersion,
    sourceCommit: lock.sourceCommit ?? null,
    platform: key,
    supported: Boolean(key && lock.artifacts[key]),
    registeredPlatforms: Object.keys(lock.artifacts),
    cachePath: cached,
    cached: result,
    jobSchema: lock.jobSchema ?? null,
    requiredCapabilities: lock.requiredCapabilities ?? [],
  };
}
