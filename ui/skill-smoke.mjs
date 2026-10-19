// 技能实跑校验：用 headless CLI 把三个场景技能的命令序列真跑一遍，并对产物做断言。
//
// 用法：
//   cargo build -p filmcraft-cli            # 在引擎仓
//   FILMCRAFT_CLI=<abs>/target/debug/filmcraft-cli.exe node ui/skill-smoke.mjs
//
// 缺 CLI 时 skip（退出 0）。每个场景都断言"结果 + 落盘产物"，不只看命令返回 ok。
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cli = process.env.FILMCRAFT_CLI;
if (!cli) {
  console.log('skill-smoke: skipped (set FILMCRAFT_CLI to the built filmcraft-cli)');
  process.exit(0);
}

const TICK = 254016000000;
const presets = 'Match Source – Adaptive Medium Bitrate';
const results = {};

const dir = await mkdtemp(join(tmpdir(), 'jc-skills-'));
const at = (name) => join(dir, name);

/** 把命令写成 UTF-8 无 BOM 的 jsonl 并跑一遍，返回每行结果。 */
function run(lines) {
  const path = at(`script-${Math.random().toString(16).slice(2)}.jsonl`);
  const body = lines.map((line) => JSON.stringify(line)).join('\n');
  // 直接同步写，避免 BOM 让 CLI 报 "expected value at line 1 column 1"。
  execFileSync(process.execPath, ['-e', `require('fs').writeFileSync(${JSON.stringify(path)}, ${JSON.stringify(body)}, 'utf8')`], { stdio: 'ignore' });
  const output = execFileSync(cli, ['--demo', 'run', path], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return output
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function check(name, fn) {
  try {
    const detail = fn();
    results[name] = { ok: true, ...detail };
  } catch (error) {
    results[name] = { ok: false, error: String(error && error.message ? error.message : error) };
  }
}

/** 场景 1：智能字幕（转写导入 → 上轨 → 导出 SRT）。 */
check('captions', () => {
  const phrases = ['剪映式', '工作流', '从字幕', '开始', '验证', '命令面', '是否', '真的', '可用', '最后', '一条'];
  const words = phrases.map((text, index) => ({ text, start: index * TICK, end: Math.round(index * TICK + TICK * 0.8), speaker: 0 }));
  const out = at('captions.srt');
  const lines = run([
    { id: 'transcript.set', params: { item: 11, transcript: { language: 'zh', speakers: [{ name: 'Speaker 1' }], words } } },
    { id: 'transcript.createCaptions', params: { maxChars: 18, lines: 1 } },
    { id: 'captions.export', params: { path: out } },
  ]);
  const created = lines.find((line) => line.id === 'transcript.createCaptions')?.result?.captions ?? 0;
  const exported = lines.find((line) => line.id === 'captions.export')?.result?.captions ?? 0;
  const srt = require_read(out);
  const cues = (srt.match(/ --> /g) ?? []).length;
  if (created < 1) throw new Error('no captions were created');
  if (exported !== created) throw new Error(`export reported ${exported} captions, created ${created}`);
  if (cues !== created) throw new Error(`SRT has ${cues} cues, expected ${created}`);
  return { created, exported, cues, bytes: srt.length };
});

/** 场景 2：批量混剪（替换占位 → 工作副本 → 导出）。 */
check('batch-remix', () => {
  const copy = at('remix-copy.fcproj');
  const video = at('remix.mp4');
  const lines = run([
    { id: 'clip.replaceFromBin', params: { clips: [29], item: 6 } },
    { id: 'file.saveCopy', params: { path: copy } },
    { id: 'file.exportMedia', params: { path: video, wait: true, preset: presets } },
  ]);
  const replaced = lines.find((line) => line.id === 'clip.replaceFromBin')?.result?.clips ?? [];
  const exported = lines.find((line) => line.id === 'file.exportMedia')?.result ?? {};
  const offline = exported.offlineMedia ?? [];
  if (!replaced.includes(29)) throw new Error(`clip 29 was not replaced: ${JSON.stringify(replaced)}`);
  if (offline.length > 0) throw new Error(`export used offline media: ${JSON.stringify(offline)}`);
  const bytes = stat_sync(copy) + stat_sync(video);
  if (stat_sync(copy) <= 0 || stat_sync(video) <= 0) throw new Error('the working copy or the export is empty');
  return { clips: replaced.length, copyBytes: stat_sync(copy), videoBytes: stat_sync(video), offline: offline.length, bytes };
});

/** 场景 3：图文成片（竖屏序列 + 配音 + 字幕 + 导出）。 */
check('text-to-video', () => {
  const srt = at('ttv.srt');
  const video = at('ttv.mp4');
  execFileSync(process.execPath, [
    '-e',
    `require('fs').writeFileSync(${JSON.stringify(srt)}, "1\\r\\n00:00:00,000 --> 00:00:03,700\\r\\nJianyingCraft text to video check.\\r\\n\\r\\n2\\r\\n00:00:03,700 --> 00:00:05,000\\r\\nSecond line for the vertical scene.\\r\\n", 'utf8')`,
  ], { stdio: 'ignore' });
  const lines = run([
    { id: 'file.newSequence', params: { name: 'TTV Vertical', width: 1080, height: 1920, fps: 30 } },
    { id: 'timeline.place', params: { item: 14, track: 'V1', seconds: 0 } },
    { id: 'timeline.place', params: { item: 12, track: 'V1', seconds: 5 } },
    { id: 'tts.create', params: { text: 'JianyingCraft text to video check.', voice: 'basic-female', track: 'A1', time: 0 } },
    { id: 'tts.render', params: { wait: true } },
    { id: 'captions.import', params: { path: srt } },
    { id: 'captions.list', params: {} },
    { id: 'sequence.inspect', params: {} },
    { id: 'file.exportMedia', params: { path: video, wait: true, preset: presets } },
  ]);
  const sequence = lines.find((line) => line.id === 'sequence.inspect')?.result ?? {};
  const exported = lines.find((line) => line.id === 'file.exportMedia')?.result ?? {};
  const captions = (lines.find((line) => line.id === 'captions.list')?.result?.tracks ?? []).reduce((n, track) => n + track.captions.length, 0);
  const width = sequence.settings?.width ?? 0;
  const height = sequence.settings?.height ?? 0;
  const videoClips = (sequence.video ?? []).reduce((n, track) => n + track.items.length, 0);
  if (width !== 1080 || height !== 1920) throw new Error(`sequence is ${width}x${height}, expected 1080x1920`);
  if (captions !== 2) throw new Error(`expected 2 captions, got ${captions}`);
  if (videoClips !== 2) throw new Error(`expected 2 video clips, got ${videoClips}`);
  if ((exported.offlineMedia ?? []).length > 0) throw new Error('export used offline media');
  if (stat_sync(video) <= 0) throw new Error('the export is empty');
  return { width, height, frames: sequence.durationFrames, captions, videoClips, videoBytes: stat_sync(video), offline: (exported.offlineMedia ?? []).length };
});


/** 把命令写成 jsonl 并跑一遍，**允许失败**：返回退出码与逐行结果（失败注入用例需要）。 */
function run_capture(lines) {
  const path = at(`script-${Math.random().toString(16).slice(2)}.jsonl`);
  writeFileSync(path, lines.map((line) => JSON.stringify(line)).join('\n'), 'utf8');
  const result = spawnSync(cli, ['--demo', 'run', path], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const parsed = (result.stdout ?? '')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return { status: result.status, lines: parsed, stderr: result.stderr ?? '' };
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/**
 * 场景 2b：批量混剪的 N 条循环 + 清单 + 失败注入（openspec 里「批量混剪未覆盖」的可做部分）。
 *
 * 每轮：替换占位片段 → 改速度（让每轮产物真的不同）→ 保存工作副本 → 导出；
 * 清单逐行记录产物名、sha256 与字节数，最后回读清单核对。失败注入不需要 ffprobe：
 * 用一条不存在的素材 id，断言 CLI 以 `ok:false` 退出 1 而不是静默成功。
 */
check('batch-remix-loop', () => {
  const manifest = [];
  for (let loop = 0; loop < 3; loop++) {
    const copy = at(`loop-${loop}.fcproj`);
    const video = at(`loop-${loop}.mp4`);
    const speed = 1 + loop * 0.15;
    const lines = run([
      { id: 'clip.replaceFromBin', params: { clips: [29], item: 6 } },
      { id: 'clip.speedDuration', params: { clips: [29], speed } },
      { id: 'file.saveCopy', params: { path: copy } },
      { id: 'file.exportMedia', params: { path: video, wait: true, preset: presets } },
    ]);
    const replaced = lines.find((line) => line.id === 'clip.replaceFromBin')?.result?.clips ?? [];
    const exported = lines.find((line) => line.id === 'file.exportMedia')?.result ?? {};
    if (!replaced.includes(29)) throw new Error(`loop ${loop}: clip 29 was not replaced`);
    if ((exported.offlineMedia ?? []).length > 0) throw new Error(`loop ${loop}: export used offline media`);
    if (stat_sync(copy) <= 0 || stat_sync(video) <= 0) throw new Error(`loop ${loop}: an artifact is empty`);
    manifest.push({ loop, speed, copy: `loop-${loop}.fcproj`, copySha: sha256(copy), video: `loop-${loop}.mp4`, videoSha: sha256(video), videoBytes: stat_sync(video) });
  }
  const manifestPath = at('manifest.jsonl');
  writeFileSync(manifestPath, manifest.map((entry) => JSON.stringify(entry)).join('\n'), 'utf8');
  const reread = readFileSync(manifestPath, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
  if (reread.length !== manifest.length) throw new Error(`manifest has ${reread.length} lines, expected ${manifest.length}`);
  for (const entry of reread) {
    if (entry.copySha !== sha256(at(entry.copy))) throw new Error(`manifest sha mismatch for ${entry.copy}`);
    if (entry.videoSha !== sha256(at(entry.video))) throw new Error(`manifest sha mismatch for ${entry.video}`);
    if (!(entry.videoBytes > 0)) throw new Error(`manifest says ${entry.video} is empty`);
  }
  // 每轮都改了速度：三份导出必须互不相同，否则"循环"只是复制了同一个产物。
  const hashes = new Set(reread.map((entry) => entry.videoSha));
  if (hashes.size !== reread.length) throw new Error(`the ${reread.length} loops produced ${hashes.size} distinct videos`);
  return { loops: reread.length, distinct: hashes.size, manifestBytes: readFileSync(manifestPath).length };
});

/** 场景 2c：失败注入——不存在的素材 id 必须让 CLI 以 ok:false 退出 1，且错误可读。 */
check('batch-remix-failure', () => {
  const attempt = run_capture([{ id: 'clip.replaceFromBin', params: { clips: [29], item: 999999 } }]);
  if (attempt.status !== 1) throw new Error(`expected exit 1, got ${attempt.status}`);
  const first = attempt.lines[0];
  if (!first || first.ok !== false) throw new Error(`expected an ok:false line, got ${JSON.stringify(attempt.lines)}`);
  if (!/not available/i.test(String(first.error))) throw new Error(`the error is not readable: ${first.error}`);
  return { status: attempt.status, error: String(first.error).slice(0, 80) };
});

/**
 * 场景 3b：图文成片的外部素材导入（openspec「图文成片未覆盖」里的 `file.import` 部分）。
 *
 * `--demo` 每次启动都是同一份工程，所以第一件导入素材的 id 是确定的；这里先断言它是 48，
 * 再用它上轨——如果哪天 demo 工程变了，失败信息会直接指出新的 id，而不是悄悄换断言。
 * 中文配音仍受限于 `tts.voices` 只有 en-US，不在本用例覆盖范围。
 */
check('text-to-video-external-import', () => {
  const png = at('external.png');
  writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
  const attempt = run_capture([
    { id: 'file.import', params: { path: png } },
    { id: 'timeline.place', params: { item: 48, track: 'V1', seconds: 0 } },
    { id: 'sequence.inspect', params: {} },
  ]);
  if (attempt.status !== 0) throw new Error(`the import script failed: ${JSON.stringify(attempt.lines)}`);
  const lines = attempt.lines;
  const imported = lines.find((line) => line.id === 'file.import')?.result ?? {};
  const itemId = (imported.items ?? [])[0];
  if (itemId !== 48) throw new Error(`the first imported item id is ${itemId}, expected 48: update the script's timeline.place`);
  if ((imported.errors ?? []).length > 0) throw new Error(`import reported errors: ${JSON.stringify(imported.errors)}`);
  const sequence = lines.find((line) => line.id === 'sequence.inspect')?.result ?? {};
  const clipItems = (sequence.video ?? []).flatMap((track) => track.items ?? []).map((clip) => clip.item);
  if (!clipItems.includes(itemId)) throw new Error(`the imported item ${itemId} is not on the timeline: ${JSON.stringify(clipItems)}`);
  return { item: itemId, clips: clipItems.length, importedBytes: stat_sync(png) };
});
function require_read(path) {
  return execFileSync(process.execPath, ['-e', `process.stdout.write(require('fs').readFileSync(${JSON.stringify(path)}, 'utf8'))`], { encoding: 'utf8' });
}
function stat_sync(path) {
  try {
    return require_stat(path);
  } catch {
    return -1;
  }
}
function require_stat(path) {
  return Number(execFileSync(process.execPath, ['-e', `process.stdout.write(String(require('fs').statSync(${JSON.stringify(path)}).size))`], { encoding: 'utf8' }));
}

console.log(JSON.stringify(results, null, 2));
const failed = Object.entries(results).filter(([, value]) => value.ok !== true);
if (failed.length > 0) {
  console.error(`skill-smoke: ${failed.map(([name]) => name).join(', ')} failed`);
  process.exit(1);
}
