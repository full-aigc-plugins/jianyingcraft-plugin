// 移植自 photocraft/filmcraft 的 Craft 适配层：本地 HTTP 宿主授权与工作区绝对路径校验。
// 与上游一致：Host 头必须等于本地 origin，Origin 缺省或等于 origin，令牌用定长比较。
import { timingSafeEqual } from 'node:crypto';
import { isAbsolute, resolve } from 'node:path';
export function authorizeRequest(request, origin, expected, actual) {
  const a = Buffer.from(expected), b = Buffer.from(actual || '');
  return request.headers.host === new URL(origin).host
    && (!request.headers.origin || request.headers.origin === origin)
    && a.length === b.length && timingSafeEqual(a, b);
}
export function workspacePath(value) {
  if (!value || !isAbsolute(value)) throw new Error('请通过 workspace 参数或 CRAFT_WORKSPACE_ROOT 指定工作区绝对路径');
  return resolve(value);
}
