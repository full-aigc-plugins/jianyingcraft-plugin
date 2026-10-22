#!/usr/bin/env node
// 同一套模板 + 一批故事 -> 同风格、逐镜可变的草稿。
// 用法: node tools/template-batch.mjs template.json stories.json --out <dir>
// 故事可给 images（均分）或 shots（逐镜覆盖：时长/滤镜/特效/转场/文本/PNG贴纸/缩放）。
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const files = args.filter((a) => !a.startsWith('--'));
const outIdx = args.indexOf('--out');
if (files.length < 2 || outIdx < 0) {
  console.error('usage: node tools/template-batch.mjs template.json stories.json --out <dir>');
  process.exit(2);
}
const [templatePath, storiesPath] = files;
const outRoot = args[outIdx + 1];
const cli = process.env.JIANYING_CLI || 'C:/Users/hnxyh/.cache/full-aigc/editors/jianyingcraft/1.6.31-win32-x64/jianying.exe';
if (!existsSync(cli)) { console.error('jianying CLI not found: ' + cli); process.exit(2); }
const template = JSON.parse(readFileSync(templatePath, 'utf8'));
const stories = JSON.parse(readFileSync(storiesPath, 'utf8'));
if (template.schema !== 'jianyingcraft-template/v1') { console.error('template schema must be jianyingcraft-template/v1'); process.exit(2); }
if (stories.schema !== 'jianyingcraft-stories/v1' || !Array.isArray(stories.stories)) { console.error('stories schema must be jianyingcraft-stories/v1'); process.exit(2); }
const { canvas, palette, rules, text, audio } = template;
const tick = 1_000_000 / canvas.fps;
const hash = (s) => { let h = 2166136261; for (const c of s) h = (h ^ c.charCodeAt(0)) * 16777619 >>> 0; return h >>> 0; };
const frame = (us) => Math.max(Math.round(us / tick) * tick, tick);
const srtTime = (us) => {
  const ms = Math.round(us / 1000); const p = (n, w = 2) => String(n).padStart(w, '0');
  return p(Math.floor(ms / 3600000)) + ':' + p(Math.floor((ms % 3600000) / 60000)) + ':' + p(Math.floor((ms % 60000) / 1000)) + ',' + p(ms % 1000, 3);
};
mkdirSync(outRoot, { recursive: true });
const results = [];

for (const story of stories.stories) {
  const id = String(story.id || 'story');
  const idSafe = id.replace(/[^\w.-]+/g, '-');
  const hasShots = Array.isArray(story.shots) && story.shots.length > 0;
  const images = Array.isArray(story.images) ? story.images : [];
  if (!hasShots && !images.length) { results.push({ id, ok: false, error: 'need images or shots' }); continue; }
  const seed = (hash(id) + Number(story.variation_seed || 0)) >>> 0;
  const pick = (arr, i) => arr[(seed + i) % arr.length];

  // 统一成 shot 列表：图片均分或逐镜定义
  const baseShotUs = story.duration_s && (hasShots ? false : true) ? frame((story.duration_s * 1_000_000) / images.length) : null;
  const sourceShots = hasShots ? story.shots : images.map((image) => ({ image }));
  let cursor = 0;
  const shots = sourceShots.map((s, i) => {
    const dur = frame((Number(s.duration_s) || (baseShotUs ? baseShotUs / 1_000_000 : 2.5)) * 1_000_000);
    const shot = { ...s, index: i, start_us: cursor, duration_us: dur };
    cursor += dur;
    return shot;
  });

  const textSegments = [];
  const overlaySegments = [];
  const segments = shots.map((shot, i) => {
    const filter = shot.filter || (rules.rotate_filters ? pick(palette.filters, i) : palette.filters[i % palette.filters.length]);
    const effect = shot.effect || (rules.rotate_effects ? pick(palette.effects, i * 2 + 1) : palette.effects[i % palette.effects.length]);
    const explicitTrans = Object.prototype.hasOwnProperty.call(shot, 'transition_out') ? shot.transition_out : undefined;
    const transition = (i >= shots.length - 1) ? null
      : (explicitTrans === null ? null
        : explicitTrans || ((i + 1) % rules.transition_every_n === 0 ? pick(palette.transitions, Math.floor(i / 2)) : null));
    const scale = shot.scale ?? rules.alternate_scale[i % rules.alternate_scale.length];
    const seg = {
      start_us: shot.start_us,
      duration_us: shot.duration_us,
      source: resolve(shot.image),
      background_filling: rules.background_filling,
      scale,
      filters: [{ name: filter, intensity: i % 2 === 0 ? 55 : 70 }],
      effects: [{ name: effect, params: {} }],
    };
    if (transition) seg.transition_out = { name: transition, duration_us: Math.min(800000, Math.round(shot.duration_us / 3)) };
    shot.filter = filter; shot.effect = effect; shot.transition = transition; shot.scale = scale;
    return seg;
  });

  const flushText = (content, at, dur) => {
    textSegments.push({ start_us: Math.round(at), duration_us: Math.round(dur), text: content, size: text.title_size, x: 0, y: text.title_y, color: text.color, border_color: text.border_color, border_width: text.border_width, bold: true, font: text.font, animation_in: { name: pick(text.animation_pool, textSegments.length), duration_us: 500000 } });
  };
  // 有逐镜文案时不再叠加全局标题，避免文本轨重叠\n  if (story.title && !shots.some((s) => s.text)) flushText(story.title, 300000, Math.min(1_800_000, cursor));
  for (const shot of shots) {
    if (shot.text) {
      const spec = typeof shot.text === 'string' ? { content: shot.text } : shot.text;
      const start = shot.start_us + Math.round((spec.start_s ?? 0.2) * 1_000_000);
      const dur = Math.min(Math.round((spec.duration_s ?? 1.8) * 1_000_000), shot.duration_us - (start - shot.start_us) - 100000);
      if (dur > 0) flushText(spec.content, start, dur);
    }
    if (shot.sticker_png) {
      overlaySegments.push({
        start_us: shot.start_us,
        duration_us: shot.duration_us,
        source: resolve(shot.sticker_png),
        scale: shot.sticker?.scale ?? 0.2,
        x: shot.sticker?.x ?? 0,
        y: shot.sticker?.y ?? 0,
      });
    }
  }

  const tracks = [{ type: 'video', name: '主视频', segments }];
  if (overlaySegments.length) tracks.push({ type: 'video', name: '贴纸图层(PNG)', segments: overlaySegments });
  const bgm = story.bgm || audio.bgm;
  if (bgm) tracks.push({ type: 'audio', name: '背景音乐', segments: [{ start_us: 0, duration_us: cursor, source: resolve(bgm), volume: audio.volume ?? 0.85, fade: audio.fade }] });
  if (textSegments.length) tracks.push({ type: 'text', name: '花字', segments: textSegments });

  const plan = { schema: 'jianying-cli-plan/v1', name: (template.name || '模板') + ' ' + id, canvas, tracks };
  const dir = join(outRoot, idSafe);
  mkdirSync(dir, { recursive: true });
  const planPath = join(dir, 'plan.json');
  writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n');
  let srtPath = null;
  const lines = Array.isArray(story.lines) ? story.lines : [];
  if (lines.length) {
    const span = cursor / lines.length;
    const srt = lines.map((line, i) => String(i + 1) + '\n' + srtTime(i * span + 150000) + ' --> ' + srtTime((i + 1) * span - 150000) + '\n' + line + '\n').join('\n');
    srtPath = join(dir, 'subs.srt');
    writeFileSync(srtPath, srt);
  }
  const draftDir = join(outRoot, 'draft-' + idSafe);
  const buildArgs = ['project', 'build', planPath, '--out', draftDir, '--json'];
  if (srtPath) buildArgs.push('--srt', srtPath);
  const build = spawnSync(cli, buildArgs, { encoding: 'utf8' });
  let verify = null; let issues = null;
  if (build.status === 0) {
    verify = spawnSync(cli, ['project', 'verify', draftDir, '--json'], { encoding: 'utf8' });
    try { const j = JSON.parse(verify.stdout); issues = j.data?.issues ?? j.result?.issues ?? null; } catch { issues = null; }
  }
  const ok = build.status === 0 && verify?.status === 0 && Array.isArray(issues) && issues.length === 0;
  results.push({ id, ok, seed, total_us: cursor, draft: draftDir, plan: planPath, srt: srtPath, issues,
    shots: shots.map((s) => ({ index: s.index, start_us: s.start_us, duration_us: s.duration_us, filter: s.filter, effect: s.effect, transition: s.transition, scale: s.scale, text: s.text || null, sticker_png: s.sticker_png ?? null })),
    build_status: build.status, verify_status: verify?.status ?? null });
}
writeFileSync(join(outRoot, 'summary.json'), JSON.stringify({ schema: 'jianyingcraft-template-batch-result/v2', template: template.id, results }, null, 2) + '\n');
const failed = results.filter((r) => !r.ok);
for (const r of results) console.log((r.ok ? 'ok   ' : 'FAIL ') + r.id + ' shots=' + (r.shots || []).length + (r.ok ? ' -> ' + r.draft : ' :: ' + (r.error || 'verify failed')));
console.log('template-batch:', results.length, 'ok:', results.length - failed.length, 'failed:', failed.length, '->', join(outRoot, 'summary.json'));
process.exit(failed.length ? 1 : 0);