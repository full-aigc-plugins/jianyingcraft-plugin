#!/usr/bin/env node
// 自动调优：分数低于阈值就换模板/换 seed 重跑，直到达标或用尽尝试。
// 用法: node tools/auto-tune.mjs t1.json,t2.json stories.json --out <dir> [--threshold 95] [--attempts 3]
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('--'));
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
if (positional.length < 2) { console.error('usage: node tools/auto-tune.mjs templates.csv stories.json --out <dir> [--threshold 95] [--attempts 3]'); process.exit(2); }
const templates = positional[0].split(',').map((s) => resolve(s.trim()));
const storiesPath = resolve(positional[1]);
const outRoot = resolve(opt('--out', 'auto-tune-out'));
const threshold = Number(opt('--threshold', 95));
const maxAttempts = Math.max(1, Number(opt('--attempts', templates.length * 2)));
const cli = process.env.JIANYING_CLI || 'C:/Users/hnxyh/.cache/full-aigc/editors/jianyingcraft/1.6.31-win32-x64/jianying.exe';
const binder = resolve(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), 'template-batch.mjs');
const input = JSON.parse(readFileSync(storiesPath, 'utf8'));
mkdirSync(outRoot, { recursive: true });
const results = [];

for (const story of input.stories) {
  const idSafe = String(story.id || 'story').replace(/[^\w.-]+/g, '-');
  const attempts = [];
  for (let i = 0; i < maxAttempts; i++) {
    const tpl = templates[i % templates.length];
    const variant = { ...story, variation_seed: Number(story.variation_seed || 0) + i * 11 };
    const tmp = mkdtempSync(join(tmpdir(), 'auto-tune-'));
    const single = join(tmp, 'stories.json');
    writeFileSync(single, JSON.stringify({ schema: 'jianyingcraft-stories/v1', stories: [variant] }, null, 2));
    const out = join(outRoot, idSafe, 'attempt-' + i);
    mkdirSync(out, { recursive: true });
    const run = spawnSync(process.execPath, [binder, tpl, single, '--out', out], { encoding: 'utf8', env: process.env });
    let summary = null;
    try { summary = JSON.parse(readFileSync(join(out, 'summary.json'), 'utf8')); } catch {}
    const r = summary?.results?.[0] || null;
    const tplId = JSON.parse(readFileSync(tpl, 'utf8')).id;
    attempts.push({ attempt: i, template: tplId, seed: variant.variation_seed, ok: r?.ok ?? false, score: r?.score ?? 0, draft: r?.draft ?? null, stderr: (run.stderr || '').slice(0, 300) });
    rmSync(tmp, { recursive: true, force: true });
    if (r?.ok && (r.score ?? 0) >= threshold) break;
  }
  const best = attempts.filter((a) => a.ok).sort((a, b) => b.score - a.score)[0] || attempts[0];
  results.push({ id: story.id, threshold, met: Boolean(best && best.ok && best.score >= threshold), best, attempts });
  console.log((best && best.ok && best.score >= threshold ? 'ok   ' : 'FAIL ') + story.id + ' best=' + (best?.score ?? 0) + ' via ' + (best?.template ?? '-') + ' after ' + attempts.length + ' attempt(s)');
}
writeFileSync(join(outRoot, 'auto-tune-summary.json'), JSON.stringify({ schema: 'jianyingcraft-auto-tune/v1', threshold, results }, null, 2) + '\n');
const unmet = results.filter((r) => !r.met);
console.log('auto-tune:', results.length, 'met:', results.length - unmet.length, 'unmet:', unmet.length, '->', join(outRoot, 'auto-tune-summary.json'));
process.exit(unmet.length ? 1 : 0);