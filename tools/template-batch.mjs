#!/usr/bin/env node
// 同一套模板 + 一批故事 -> 同风格、不同内容/效果的草稿。
// 用法: node tools/template-batch.mjs template.json stories.json --out <dir>
// 故事: {"schema":"jianyingcraft-stories/v1","stories":[{id,title,lines,images,duration_s?,bgm?,variation_seed?}]}
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';

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
const srtTime = (us) => {
  const ms = Math.round(us / 1000); const p = (n, w = 2) => String(n).padStart(w, '0');
  return p(Math.floor(ms / 3600000)) + ':' + p(Math.floor((ms % 3600000) / 60000)) + ':' + p(Math.floor((ms % 60000) / 1000)) + ',' + p(ms % 1000, 3);
};
mkdirSync(outRoot, { recursive: true });
const results = [];

for (const story of stories.stories) {
  const id = String(story.id || 'story');
  const idSafe = id.replace(/[^\w.-]+/g, '-');
  const images = Array.isArray(story.images) ? story.images : [];
  if (!images.length) { results.push({ id, ok: false, error: 'images empty' }); continue; }
  const totalUs = Math.round((story.duration_s || images.length * 2.5) * 1_000_000);
  const perUs = Math.max(Math.round(totalUs / images.length / tick) * tick, tick);
  const seed = (hash(id) + Number(story.variation_seed || 0)) >>> 0;
  const pick = (arr, i) => arr[(seed + i) % arr.length];
  const shots = [];
  const segments = images.map((src, i) => {
    const filter = rules.rotate_filters ? pick(palette.filters, i) : palette.filters[i % palette.filters.length];
    const effect = rules.rotate_effects ? pick(palette.effects, i * 2 + 1) : palette.effects[i % palette.effects.length];
    const transition = i < images.length - 1 && (i + 1) % rules.transition_every_n === 0 ? pick(palette.transitions, Math.floor(i / 2)) : null;
    const seg = {
      start_us: i * perUs,
      duration_us: perUs,
      source: resolve(src),
      background_filling: rules.background_filling,
      scale: rules.alternate_scale[i % rules.alternate_scale.length],
      filters: [{ name: filter, intensity: i % 2 === 0 ? 55 : 70 }],
      effects: [{ name: effect, params: {} }],
    };
    if (transition) seg.transition_out = { name: transition, duration_us: Math.min(800000, Math.round(perUs / 3)) };
    shots.push({ i, filter, effect, transition, scale: seg.scale });
    return seg;
  });
  const tracks = [{ type: 'video', name: '主视频', segments }];
  const bgm = story.bgm || audio.bgm;
  if (bgm) tracks.push({ type: 'audio', name: '背景音乐', segments: [{ start_us: 0, duration_us: segments.length * perUs, source: resolve(bgm), volume: audio.volume ?? 0.85, fade: audio.fade }] });
  if (story.title) {
    const anim = text.animation_pool[seed % text.animation_pool.length];
    tracks.push({ type: 'text', name: '花字', segments: [{ start_us: 300000, duration_us: Math.min(1_800_000, segments.length * perUs), text: story.title, size: text.title_size, x: 0, y: text.title_y, color: text.color, border_color: text.border_color, border_width: text.border_width, bold: true, font: text.font, animation_in: { name: anim, duration_us: 500000 } }] });
  }
  const plan = { schema: 'jianying-cli-plan/v1', name: (template.name || '模板') + ' ' + id, canvas, tracks };
  const dir = join(outRoot, idSafe);
  mkdirSync(dir, { recursive: true });
  const planPath = join(dir, 'plan.json');
  writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n');
  let srtPath = null;
  const lines = Array.isArray(story.lines) ? story.lines : [];
  if (lines.length) {
    const span = segments.length * perUs / lines.length;
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
  results.push({ id, ok, seed, total_us: segments.length * perUs, draft: draftDir, plan: planPath, srt: srtPath, issues, shots, build_status: build.status, verify_status: verify?.status ?? null });
}
writeFileSync(join(outRoot, 'summary.json'), JSON.stringify({ schema: 'jianyingcraft-template-batch-result/v1', template: template.id, results }, null, 2) + '\n');
const failed = results.filter((r) => !r.ok);
for (const r of results) console.log((r.ok ? 'ok   ' : 'FAIL ') + r.id + ' shots=' + (r.shots || []).length + (r.ok ? ' -> ' + r.draft : ' :: ' + (r.build_stderr || 'verify failed')));
console.log('template-batch:', results.length, 'ok:', results.length - failed.length, 'failed:', failed.length, '->', join(outRoot, 'summary.json'));
process.exit(failed.length ? 1 : 0);