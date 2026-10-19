// 面板连接：页面自己轮询 adapter 的 /poll，用 wasm 的 craft_* 执行命令，再回 /reply。
// adapter 把它注入到 /<token>/app/index.html（<script type="module" src="../connect.js">）。
const base = new URL('./', import.meta.url); // /<token>/（connect.js 所在目录）
const pageId = 'page-' + Math.random().toString(36).slice(2);
const headers = { 'x-craft-page': pageId };
let enginePromise = null;

// 复用页面自己初始化好的 wasm 模块（`window.__jianyingcraftEngine`）：
// 再 import 一份会得到第二个实例，命令就落不到用户看得见的那份文档上。
function engine() {
  enginePromise ??= (async () => {
    for (;;) {
      const ready = globalThis.__jianyingcraftEngine;
      if (ready && typeof ready.craft_submit === 'function') return ready;
      await new Promise((r) => setTimeout(r, 200));
    }
  })();
  return enginePromise;
}

async function reply(payload) {
  await fetch(new URL('reply', base), {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function execute(job) {
  const mod = await engine();
  if (typeof mod.craft_submit !== 'function') throw new Error('craft_submit missing');
  const request = JSON.stringify({ id: job.id, command: job.args?.id, params: job.args?.params ?? {} });
  if (!mod.craft_submit(request)) throw new Error('bridge queue is full');
  const until = Date.now() + 20000;
  for (;;) {
    const raw = mod.craft_take_reply();
    if (raw) {
      const answer = JSON.parse(raw);
      if (answer.id === job.id) return answer;
    }
    if (Date.now() > until) throw new Error('engine did not answer');
    await new Promise((r) => setTimeout(r, 16));
  }
}

(async function loop() {
  for (;;) {
    let job = null;
    try {
      const response = await fetch(new URL('poll', base), { headers });
      if (response.ok) job = await response.json();
    } catch { /* adapter 未就绪 */ }
    if (job) {
      try {
        const answer = await execute(job);
        if (answer.ok) await reply({ id: job.id, result: answer.result });
        else await reply({ id: job.id, error: answer.error?.message ?? 'command failed' });
      } catch (error) { await reply({ id: job.id, error: String(error?.message ?? error) }); }
    }
    await new Promise((r) => setTimeout(r, job ? 0 : 120));
  }
})();