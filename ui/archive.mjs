// 无依赖的归档提取：只取出锁里指定的那一个可执行文件，其余条目一律不解压。
// 插件分发场景不应为了解一个 zip 去装 npm 依赖；这里用 node:zlib 手写最小 ZIP/TAR 读取。
import { inflateRawSync, gunzipSync } from 'node:zlib';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, basename } from 'node:path';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const MAX_EOCD_SEARCH = 66_000; // 注释 + EOCD 的最大扫描窗口

/** 反转 16 位小端字段。 */
function u16(buffer, offset) {
  if (offset + 2 > buffer.length) throw new Error('归档在读取 16 位字段时越界');
  return buffer.readUInt16LE(offset);
}
/** 读取 32 位小端字段。 */
function u32(buffer, offset) {
  if (offset + 4 > buffer.length) throw new Error('归档在读取 32 位字段时越界');
  return buffer.readUInt32LE(offset);
}

/** 在 ZIP 中央目录里定位条目，返回 {name, method, compressedSize, localOffset}。 */
export function findZipEntry(buffer, wanted) {
  let eocd = -1;
  const start = Math.max(0, buffer.length - MAX_EOCD_SEARCH);
  for (let i = buffer.length - 22; i >= start; i--) {
    if (u32(buffer, i) === EOCD_SIGNATURE) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('不是有效的 ZIP：未找到中央目录结束记录');
  const count = u16(buffer, eocd + 10);
  let cursor = u32(buffer, eocd + 16);
  for (let i = 0; i < count; i++) {
    if (u32(buffer, cursor) !== CENTRAL_SIGNATURE) throw new Error('ZIP 中央目录条目签名不匹配');
    const method = u16(buffer, cursor + 10);
    const compressedSize = u32(buffer, cursor + 20);
    const nameLength = u16(buffer, cursor + 28);
    const extraLength = u16(buffer, cursor + 30);
    const commentLength = u16(buffer, cursor + 32);
    const localOffset = u32(buffer, cursor + 42);
    const name = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength);
    if (basename(name) === wanted) {
      return { name, method, compressedSize, localOffset };
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return null;
}

/** 按中央目录给出的偏移解出条目内容。 */
export function readZipEntry(buffer, entry) {
  if (u32(buffer, entry.localOffset) !== LOCAL_SIGNATURE) throw new Error('ZIP 本地文件头签名不匹配');
  const nameLength = u16(buffer, entry.localOffset + 26);
  const extraLength = u16(buffer, entry.localOffset + 28);
  const dataStart = entry.localOffset + 30 + nameLength + extraLength;
  const raw = buffer.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.method === 0) return Buffer.from(raw);
  if (entry.method === 8) return inflateRawSync(raw);
  throw new Error(`不支持的 ZIP 压缩方法 ${entry.method}（只支持 stored 与 deflate）`);
}

/** 在 tar 字节流里定位条目，返回内容 Buffer。 */
export function findTarEntry(tar, wanted) {
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    const name = header.toString('utf8', 0, 100).replace(/\0.*$/, '');
    const sizeField = header.toString('ascii', 124, 136).replace(/\0.*$/, '').trim();
    const size = sizeField ? parseInt(sizeField, 8) : 0;
    const dataStart = offset + 512;
    if (basename(name) === wanted) return Buffer.from(tar.subarray(dataStart, dataStart + size));
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  return null;
}

/**
 * 从归档字节中取出指定文件名的条目，写到 stagingDir，返回落地绝对路径。
 * 不存在同名条目时抛错——绝不"解压成功但没有目标文件"这种假成功。
 */
export async function extractBinary(archive, wantedName, stagingDir) {
  await mkdir(stagingDir, { recursive: true });
  const target = join(stagingDir, basename(wantedName));
  const isZip = archive.length > 4 && archive.readUInt32LE(0) === LOCAL_SIGNATURE;
  const isGzip = archive.length > 2 && archive[0] === 0x1f && archive[1] === 0x8b;
  let data = null;
  if (isZip) {
    const entry = findZipEntry(archive, basename(wantedName));
    if (entry) data = readZipEntry(archive, entry);
  } else if (isGzip) {
    data = findTarEntry(gunzipSync(archive), basename(wantedName));
  } else {
    throw new Error('无法识别的归档格式：既不是 ZIP 也不是 gzip');
  }
  if (!data) throw new Error(`归档中找不到可执行文件 ${basename(wantedName)}`);
  if (data.length === 0) throw new Error(`归档中的 ${basename(wantedName)} 为空文件`);
  await writeFile(target, data);
  return target;
}
