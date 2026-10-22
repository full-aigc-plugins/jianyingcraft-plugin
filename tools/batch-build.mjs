#!/usr/bin/env node
// 批量生成剪映草稿：batch.json -> 每条 brief 的 plan.json + subs.srt -> project build + verify。
// 用法：node tools/batch-build.mjs batch.json --out <dir>
// 环境变量 JIANYING_CLI 指向 jianying 可执行文件（否则用本机缓存默认路径）。
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';

const args = process.argv.slice(2);
const batchPath = args.find((a) => !a.startsWith('--'));
const outIdx = args.indexOf('--out');
const outRoot = outIdx >= 0 ? args[outIdx + 1] : join(dirname(batchPath), 'batch-out');
if (!batchPath) {
  console.error('usage: node tools/batch-build.mjs batch.json --out <dir>');
  process.exit(2);
}
const cli = process.env.JIANYING_CLI || 'C:/Users/hnxyh/.cache/full-aigc/editors/jianyingcraft/1.6.31-win32-x64/jianying.exe';
if (!existsSync(cli)) {
  console.error('jianying CLI not found: ' + cli + ' (set JIANYING_CLI)');
  process.exit(2);
}
const batch = JSON.parse(readFileSync(batchPath, 'utf8'));
if (batch.schema !== 'jianyingcraft-batch/v1') {
  console.error('batch.json must use schema jianyingcraft-batch/v1');
  process.exit(2);
}
if (!Array.isArray(batch.briefs) || batch.briefs.length === 0) {
  console.error('batch.briefs is empty');
  process.exit(2);
}
const canvas = batch.canvas || { width: 1080, height: 1920, fps: 30 };
const defaults = batch.defaults || {};
mkdirSync(outRoot, { recursive: true });

const tick = 1_000_000 / canvas.fps;
const srtTime = (us) => {
  const ms = Math.round(us / 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return p(h) + ':' + p(m) + ':' + p(s) + ',' + p(r, 3);
};

const results = [];
for (const brief of batch.briefs) {
  const id = String(brief.id || 'brief');
  const idSafe = id.replace(/[^\w.-]+/g, '-');
  const images = Array.isArray(brief.images) ? brief.images : [];
  if (images.length === 0) {
    results.push({ id, ok: false, error: 'brief.images is empty' });
    continue;
  }
  const totalUs = Math.round((brief.duration_s || images.length * 2.5) * 1_000_000);
  const perUs = Math.max(Math.round(totalUs / images.length / tick) * tick, tick);
  const filter = brief.filter || defaults.filter || '清晰明亮';
  const effect = brief.effect || defaults.effect || '光晕';
  const transition = brief.transition || defaults.transition || '叠化';
  const segments = images.map((src, i) => {
    const seg = {
      start_us: i * perUs,
      duration_us: perUs,
      source: resolve(src),
      background_filling: { type: 'blur', blur: 0.0625 },
      scale: i % 2 === 0 ? 1.0 : 1.1,
      filters: [{ name: filter, intensity: 60 }],
      effects: [{ name: effect, params: {} }],
    };
    if (i < images.length - 1) seg.transition_out = { name: transition, duration_us: Math.min(800000, Math.round(perUs / 3)) };
    return seg;
  });
  const tracks = [{ type: 'video', name: '主视频', segments }];
  if (defaults.bgm) {
    tracks.push({ type: 'audio', name: '背景音乐', segments: [{ start_us: 0, duration_us: segments.length * perUs, source: resolve(defaults.bgm), volume: 0.85, fade: { in_us: 400000, out_us: 700000 } }] });
  }
  if (brief.title) {
    tracks.push({ type: 'text', name: '花字', segments: [{ start_us: 300000, duration_us: Math.min(1_800_000, segments.length * perUs), text: brief.title, size: 18, x: 0, y: -0.12, color: '#FFFFFF', border_color: '#000000', border_width: 40, bold: true, font: '优设标题圆', animation_in: { name: '变色输入', duration_us: 500000 } }] });
  }
  const plan = { schema: 'jianying-cli-plan/v1', name: (batch.name || '批量') + ' ' + id, canvas, tracks };
  const briefDir = join(outRoot, idSafe);
  mkdirSync(briefDir, { recursive: true });
  const planPath = join(briefDir, 'plan.json');
  writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n');

  const lines = Array.isArray(brief.lines) ? brief.lines : [];
  let srtPath = null;
  if (lines.length) {
    const span = totalUs / lines.length;
    const srt = lines.map((line, i) => String(i + 1) + '\n' + srtTime(i * span + 200000) + ' --> ' + srtTime((i + 1) * span - 200000) + '\n' + line + '\n').join('\n');
    srtPath = join(briefDir, 'subs.srt');
    writeFileSync(srtPath, srt);
  }
  const draftDir = join(outRoot, 'draft-' + idSafe);
  const buildArgs = ['project', 'build', planPath, '--out', draftDir, '--json'];
  if (srtPath) buildArgs.push('--srt', srtPath);
  const build = spawnSync(cli, buildArgs, { encoding: 'utf8' });
  let verify = null;
  let issues = null;
  if (build.status === 0) {
    verify = spawnSync(cli, ['project', 'verify', draftDir, '--json'], { encoding: 'utf8' });
    try { const j = JSON.parse(verify.stdout); issues = j.data?.issues ?? j.result?.issues ?? null; } catch { issues = null; }
  }
  const ok = build.status === 0 && verify?.status === 0 && Array.isArray(issues) && issues.length === 0;
  results.push({ id, ok, total_us: segments.length * perUs, images: images.length, draft: draftDir, plan: planPath, srt: srtPath, issues, build_status: build.status, verify_status: verify?.status ?? null, stderr: (build.stderr || '').slice(0, 500) });
}
writeFileSync(join(outRoot, 'summary.json'), JSON.stringify({ schema: 'jianyingcraft-batch-result/v1', playbook: batch.playbook || null, results }, null, 2) + '\n');
const failed = results.filter((r) => !r.ok);
for (const r of results) console.log((r.ok ? 'ok   ' : 'FAIL ') + r.id + (r.ok ? ' -> ' + r.draft : ' :: ' + (r.error || r.stderr || 'verify failed')));
console.log('batch:', results.length, 'ok:', results.length - failed.length, 'failed:', failed.length, '->', join(outRoot, 'summary.json'));
process.exit(failed.length ? 1 : 0);