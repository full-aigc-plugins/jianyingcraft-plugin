// JianyingCraft 面板（S1：只读时间轴 + 代理预览）。
//
// 硬约束（与 photocraft 面板的关键差异）：
// 面板**不执行**任何来自 Agent 的代码，也**不代理**剪辑动作。执行者是独立的 jianying-cli 进程。
// 面板只做三件事：读真实草稿状态、播真实代理产物、回报真实画面像素。
// 任何它读不到的语义都来自适配器返回的 gaps，面板原样展示，绝不猜测填充。
import { installCanvasCapture } from './canvas-capture.mjs';

const PAGE_ID = `jc-${Math.random().toString(36).slice(2, 10)}`;
const TRACK_COLORS = {
  video: ['#3d6fd6', '#2f57a8'],
  audio: ['#2e9e6b', '#22794f'],
  text: ['#c58a26', '#9a6a1b'],
  sticker: ['#a155c9', '#7c3f9b'],
  unknown: ['#5b6472', '#414954'],
};

let transport = null;
let lastState = null;
let playheadMs = 0;

/** 传输抽象：MCP Apps 面板走 AppBridge，独立浏览器走本地 HTTP；面板逻辑对两者完全一致。 */
async function createTransport() {
  if (window.parent && window.parent !== window) {
    try {
      const { App, PostMessageTransport } = await import('@modelcontextprotocol/ext-apps');
      const app = new App({ name: 'JianyingCraft editor', version: '0.1.0' }, {});
      await app.connect(new PostMessageTransport(window.parent, window.parent));
      const call = async (name, args) => {
        const result = await app.callServerTool({ name, arguments: { pageId: PAGE_ID, ...args } });
        if (result.isError) throw new Error(result.content?.find(c => c.type === 'text')?.text || '面板调用失败');
        const value = result.structuredContent ?? JSON.parse(result.content[0].text);
        return value && Object.hasOwn(value, 'value') ? value.value : value;
      };
      return { mode: 'mcp-apps', call, poll: () => call('_panel_poll', {}) };
    } catch { /* 落到 HTTP 宿主 */ }
  }
  const base = new URL('.', location.href).href;
  const headers = { 'X-JianyingCraft-Page': PAGE_ID };
  const json = async (url, options) => {
    const response = await fetch(url, { ...options, headers, cache: 'no-store' });
    if (response.status === 409) throw new Error('编辑器已有活动面板');
    if (!response.ok) throw new Error(`面板宿主返回 ${response.status}`);
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  };
  return {
    mode: 'http-host',
    call: (name, args) => {
      if (name === '_panel_state') return json(new URL('state', base).href);
      if (name === '_panel_poll') return json(new URL('poll', base).href);
      throw new Error(`HTTP 宿主不支持 ${name}`);
    },
    poll: () => json(new URL('poll', base).href),
  };
}

// ---------------------------------------------------------------- 时间轴渲染
function layout(state, width, height) {
  const model = state.draft;
  if (!model) return { rows: [], durationMs: 0, pxPerMs: 0 };
  const rows = model.tracks.map(track => {
    const colors = TRACK_COLORS[track.type] ?? TRACK_COLORS.unknown;
    return {
      id: track.id ?? `track-${track.index}`,
      type: track.type,
      name: track.name,
      rendered: track.rendered,
      clips: track.clips,
      fill: colors[0], stroke: colors[1],
    };
  });
  return { rows, durationMs: Math.max(model.durationMs, 1) };
}

function drawTimeline(state, canvas) {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 640;
  const height = 220;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const { rows, durationMs } = layout(state, width, height);
  const padLeft = 92, padTop = 8, rowH = 26, gap = 4;
  const plotWidth = Math.max(40, width - padLeft - 12);
  const pxPerMs = plotWidth / durationMs;

  if (!rows.length) {
    ctx.fillStyle = '#6d7686';
    ctx.font = '13px "Microsoft YaHei", sans-serif';
    ctx.fillText('尚无草稿：用 open_file 选择工作区内的草稿目录，或用 command_run 执行 build', padLeft, padTop + 18);
    return;
  }

  // 时间刻度：按跨度自适应 1s / 5s / 30s / 60s 一档
  const span = durationMs;
  const steps = [100, 500, 1000, 5000, 30000, 60000, 300000];
  const step = steps.find(s => span / s <= 12) ?? 600000;
  ctx.strokeStyle = '#2b303a';
  ctx.fillStyle = '#6d7686';
  ctx.font = '10px system-ui';
  ctx.lineWidth = 1;
  ctx.textBaseline = 'top';
  for (let t = 0; t <= span; t += step) {
    const x = padLeft + t * pxPerMs;
    ctx.beginPath(); ctx.moveTo(x, padTop); ctx.lineTo(x, height - 14); ctx.stroke();
    ctx.fillText(`${(t / 1000).toFixed(t % 1000 ? 1 : 0)}s`, x + 2, height - 13);
  }

  rows.forEach((row, index) => {
    const y = padTop + index * (rowH + gap);
    ctx.fillStyle = '#20242c';
    ctx.fillRect(0, y, width, rowH);
    ctx.fillStyle = row.rendered ? '#c7cdd8' : '#6d7686';
    ctx.font = '11px "Microsoft YaHei", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${row.type} · ${row.clips.length}`, 8, y + rowH / 2);

    for (const clip of row.clips) {
      const x = padLeft + clip.startMs * pxPerMs;
      const w = Math.max(2, clip.durationMs * pxPerMs);
      ctx.fillStyle = row.fill;
      ctx.globalAlpha = row.rendered ? 0.9 : 0.35;
      ctx.fillRect(x, y + 3, w, rowH - 6);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = row.stroke;
      ctx.strokeRect(x + 0.5, y + 3.5, Math.max(1, w - 1), rowH - 7);
      if (w > 44 && row.rendered) {
        ctx.fillStyle = '#f2f4f8';
        ctx.font = '10px system-ui';
        ctx.save();
        ctx.beginPath(); ctx.rect(x + 2, y + 3, w - 4, rowH - 6); ctx.clip();
        ctx.fillText(clip.label, x + 4, y + rowH / 2);
        ctx.restore();
      }
      for (const key of clip.keyframes ?? []) {
        const kx = padLeft + key.timeMs * pxPerMs;
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(kx - 1, y + 1, 2, rowH - 2);
      }
    }
  });

  const px = padLeft + Math.min(playheadMs, durationMs) * pxPerMs;
  ctx.strokeStyle = '#ff5c7a';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(px, padTop); ctx.lineTo(px, height - 16); ctx.stroke();
}

function renderFacts(state) {
  const facts = document.getElementById('facts');
  const model = state.draft;
  const rows = [
    ['引擎', state.engine ? `jianying-cli ${state.engine.version}（${state.engine.source}）` : '未加载'],
    ['工作区', state.workspace ?? '—'],
    ['当前草稿', state.activeDraft ?? '未选择'],
    ['版本', model?.readable ? `${model.version ?? '未标注'} / ${model.platform ?? '未知平台'}` : (state.draftReason ?? '未加载')],
  ];
  if (model?.readable) {
    rows.push(['时长', `声明 ${Math.round(model.declaredDurationMs)}ms / 实算 ${Math.round(model.computedDurationMs)}ms`]);
    rows.push(['帧率', model.fps ?? '未知']);
    rows.push(['画布', model.canvas ? `${model.canvas.width}×${model.canvas.height}` : '未知']);
    rows.push(['轨道 / 片段', `${model.summary.trackCount} / ${model.summary.clipCount}`]);
    rows.push(['素材', `${model.summary.materialCount} 个（${model.summary.knownBuckets.length} 个非空桶）`]);
  }
  facts.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtml(String(v))}</dd>`).join('');

  const gaps = document.getElementById('gaps');
  const list = model?.gaps ?? [];
  gaps.innerHTML = list.length
    ? `<p class="empty" style="margin:4px 0">面板未覆盖的内容（如实列出，不猜测填充）：</p><ul>${list.map(g => `<li>${escapeHtml(g.reason)}</li>`).join('')}</ul>`
    : (model?.readable ? '<p class="empty">本次渲染没有发现未覆盖项。</p>' : '');
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function refresh(state) {
  lastState = state;
  const engine = document.getElementById('engine');
  engine.textContent = state.engine ? `jianying-cli ${state.engine.version}` : '引擎未加载';
  const conn = document.getElementById('conn');
  conn.textContent = `已连接 · ${transport.mode}`;
  conn.className = 'badge ok';
  document.getElementById('rev').textContent = `rev ${state.revision}`;
  document.getElementById('draft').textContent = state.activeDraft ?? '未选择草稿';

  const video = document.getElementById('preview');
  const note = document.getElementById('proxyNote');
  const movie = (state.proxy?.frames ?? []).find(f => /\.(mp4|webm)$/i.test(f.name));
  if (movie) {
    const url = transport.mode === 'http-host'
      ? new URL(`proxy/${movie.name}`, new URL('.', location.href)).href
      : null;
    if (url) {
      if (!video.dataset.src || video.dataset.src !== url) { video.src = url; video.dataset.src = url; }
      note.style.display = 'none';
    } else {
      const blob = await transport.call('_panel_proxy', { name: movie.name });
      const bytes = Uint8Array.from(atob(blob.base64), c => c.charCodeAt(0));
      const objUrl = URL.createObjectURL(new Blob([bytes], { type: movie.name.endsWith('mp4') ? 'video/mp4' : 'video/webm' }));
      video.src = objUrl;
      note.style.display = 'none';
    }
  } else {
    note.style.display = '';
    note.textContent = state.proxy?.count
      ? `已发现 ${state.proxy.count} 张代理帧，面板优先播放 MP4 代理。`
      : '尚未生成代理。执行 jianying render proxy <草稿> --json 后刷新。';
  }

  renderFacts(state);
  drawTimeline(state, document.getElementById('timeline'));
}

// ---------------------------------------------------------------- 截图
function captureCanvas() {
  const canvas = document.getElementById('timeline');
  return canvas.toDataURL('image/png').split(',')[1];
}

// ---------------------------------------------------------------- 主循环
async function main() {
  installCanvasCapture(HTMLCanvasElement);
  transport = await createTransport();
  const canvas = document.getElementById('timeline');
  canvas.addEventListener('click', event => {
    const rect = canvas.getBoundingClientRect();
    const state = lastState;
    if (!state?.draft) return;
    const model = state.draft;
    const padLeft = 92, plotWidth = Math.max(40, rect.width - padLeft - 12);
    const ratio = (event.clientX - rect.left - padLeft) / plotWidth;
    playheadMs = Math.max(0, Math.min(1, ratio)) * Math.max(model.durationMs, 1);
    drawTimeline(state, canvas);
  });
  const video = document.getElementById('preview');
  video.addEventListener('timeupdate', () => {
    if (!lastState?.draft) return;
    playheadMs = video.currentTime * 1000;
    drawTimeline(lastState, canvas);
  });

  let seen = 0;
  while (true) {
    let next;
    try {
      next = transport.mode === 'http-host' ? await transport.poll() : await transport.poll();
    } catch (e) {
      document.getElementById('conn').textContent = `面板已断开：${e.message}`;
      document.getElementById('conn').className = 'badge bad';
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }
    if (next?.idle) {
      if (next.revision !== seen) { seen = next.revision; await refresh(await transport.call('_panel_state', {})); }
      await new Promise(r => setTimeout(r, 900));
      continue;
    }
    if (next?.notify) {
      if (next.revision !== seen) { seen = next.revision; await refresh(await transport.call('_panel_state', {})); }
      continue;
    }
    if (next?.action === 'capture') {
      let result = { base64: captureCanvas() }, error = null;
      try { await transport.call('_panel_reply', { id: next.id, result }); }
      catch (e) { error = e.message; }
      continue;
    }
  }
}

main().catch(e => {
  const status = document.getElementById('conn');
  status.textContent = `面板启动失败：${e.message}`;
  status.className = 'badge bad';
});
