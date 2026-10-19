// 归档提取测试：造真实的 zip 与 tar.gz 字节，验证能取出目标条目，且缺目标时明确失败。
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { findZipEntry, readZipEntry, findTarEntry, extractBinary } from '../archive.mjs';

const run = promisify(execFile);

async function scratch(label) {
  const dir = await mkdtemp(join(tmpdir(), `jycraft-${label}-`));
  return dir;
}

// 手工构造一个 stored(方法0) 的最小 ZIP，避免测试依赖系统的 zip 工具
function buildStoredZip(files) {
  const chunks = [], central = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBuf = Buffer.from(name, 'utf8');
    const data = Buffer.from(content, 'utf8');
    // 本模块的读取路径不校验 CRC，这里填 0 即可，避免为一个校验位引入依赖。
    const crc = 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26);
    chunks.push(local, nameBuf, data);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(0, 8);
    cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(data.length, 24); cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([cd, nameBuf]));
    offset += local.length + nameBuf.length + data.length;
  }
  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(files).length, 8);
  eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, centralBuf, eocd]);
}

test('最小 ZIP：按 basename 定位并读出目标条目', () => {
  const zip = buildStoredZip({
    'bin/jianying.exe': 'MZ-binary-payload',
    'README.md': 'readme',
  });
  const entry = findZipEntry(zip, 'jianying.exe');
  assert.ok(entry, '应能在嵌套路径中定位到 jianying.exe');
  assert.equal(entry.name, 'bin/jianying.exe');
  assert.equal(readZipEntry(zip, entry).toString('utf8'), 'MZ-binary-payload');
});

test('ZIP 缺少目标条目时返回 null 而不是抛错', () => {
  const zip = buildStoredZip({ 'bin/jianying.exe': 'x' });
  assert.equal(findZipEntry(zip, 'not-there.exe'), null);
});

test('非 ZIP 输入给出明确错误', () => {
  assert.throws(() => findZipEntry(Buffer.from('not a zip at all'), 'x'), /不是有效的 ZIP/);
});

test('真实 tar.gz（由系统 tar 生成）能取出目标条目', async () => {
  const dir = await scratch('targz');
  try {
    const payload = join(dir, 'jianying');
    await writeFile(payload, 'ELF-ish-binary-payload');
    const tarball = join(dir, 'a.tar.gz');
    // Windows 自带 tar 会把 "C:\..." 解析成远程主机语法，这里改用 cwd + 相对文件名。
    await run('tar', ['-czf', 'a.tar.gz', 'jianying'], { cwd: dir });
    const { gunzipSync } = await import('node:zlib');
    const data = findTarEntry(gunzipSync(await readFile(tarball)), 'jianying');
    assert.equal(data.toString('utf8'), 'ELF-ish-binary-payload');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('extractBinary：从真实 zip 落地目标文件', async () => {
  const dir = await scratch('extract');
  try {
    const zip = buildStoredZip({ 'nested/jianying': 'binary-bytes-here' });
    const out = await extractBinary(zip, 'jianying', join(dir, 'staging'));
    assert.equal((await readFile(out)).toString('utf8'), 'binary-bytes-here');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('extractBinary：目标缺失时报错而非返回空文件（拒绝假成功）', async () => {
  const dir = await scratch('missing');
  try {
    const zip = buildStoredZip({ 'other.txt': 'nope' });
    await assert.rejects(() => extractBinary(zip, 'jianying', join(dir, 'staging')), /归档中找不到可执行文件/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('extractBinary：无法识别的格式明确报错', async () => {
  const dir = await scratch('garbage');
  try {
    await assert.rejects(() => extractBinary(Buffer.from('garbage-input'), 'jianying', join(dir, 's')), /无法识别的归档格式/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
