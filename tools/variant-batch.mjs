#!/usr/bin/env node
// A/B 模板变体：同一批故事套 2–3 个模板，批量出草稿并汇总评分。
// 用法: node tools/variant-batch.mjs t1.json,t2.json stories.json --out <dir>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('--'));
const outIdx = args.indexOf('--out');
if (positional.length < 2 || outIdx < 0) {
  console.error('usage: node tools/variant-batch.mjs template1.json,template2.json stories.json --out <dir>');
  process.exit(2);
}
const templates = positional[0].split(',').map((s) => resolve(s.trim())).filter(Boolean);
const stories = resolve(positional[1]);
const outRoot = resolve(args[outIdx + 1]);
mkdirSync(outRoot, { recursive: true });
const tool = resolve(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), 'template-batch.mjs');
const variants = [];
for (const tpl of templates) {
  const tplId = JSON.parse(readFileSync(tpl, 'utf8')).id;
  const out = join(outRoot, tplId);
  const run = spawnSync(process.execPath, [tool, tpl, stories, '--out', out], { encoding: 'utf8', env: process.env });
  let summary = null;
  try { summary = JSON.parse(readFileSync(join(out, 'summary.json'), 'utf8')); } catch {}
  const results = summary?.results || [];
  const scores = results.filter((r) => r.ok).map((r) => r.score ?? 0);
  variants.push({ template: tplId, ok: run.status === 0, stories: results.length, passed: results.filter((r) => r.ok).length, avg_score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0, results, stderr: (run.stderr || '').slice(0, 400) });
}
writeFileSync(join(outRoot, 'variants-summary.json'), JSON.stringify({ schema: 'jianyingcraft-variants-result/v1', variants }, null, 2) + '\n');
for (const v of variants) console.log((v.ok ? 'ok   ' : 'FAIL ') + v.template + ' stories=' + v.passed + '/' + v.stories + ' avg_score=' + v.avg_score);
const failed = variants.filter((v) => !v.ok).length;
console.log('variants:', variants.length, 'failed:', failed, '->', join(outRoot, 'variants-summary.json'));
process.exit(failed ? 1 : 0);