// `sync-engine.mjs`：同步派生引擎的 Web 发行版，并检出 drift。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { syncEngine, engineDrift, hasEngine, REQUIRED } from '../sync-engine.mjs';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'jy-engine-'));
  const source = join(root, 'dist');
  const dest = join(root, 'engine');
  await mkdir(source, { recursive: true });
  for (const name of REQUIRED) {
    await writeFile(join(source, name), `// ${name}\n` + 'x'.repeat(64));
  }
  await mkdir(join(source, 'assets'), { recursive: true });
  await writeFile(join(source, 'assets', 'a.txt'), 'asset');
  return { root, source, dest };
}

test('copies the build, records hashes and reports the total size', async () => {
  const { source, dest } = await fixture();
  const result = await syncEngine({ source, dest });
  assert.equal(result.copied.length, REQUIRED.length + 1);
  assert.ok(result.totalBytes > 0);
  const info = JSON.parse(await readFile(join(dest, 'build-info.json'), 'utf8'));
  assert.deepEqual(Object.keys(info.files).sort(), result.copied.sort());
  assert.equal(await hasEngine(dest), true);
});

test('refuses a build with a missing entry point instead of shipping a broken panel', async () => {
  const { source, dest } = await fixture();
  await rm(join(source, 'filmcraft_web_bg.wasm'));
  await assert.rejects(() => syncEngine({ source, dest }), /missing filmcraft_web_bg\.wasm/);
});

test('refuses a build above the panel budget', async () => {
  const { source, dest } = await fixture();
  await assert.rejects(() => syncEngine({ source, dest, maxBytes: 10 }), /above the 10-byte panel budget/);
});

test('a second sync removes files that are no longer part of the build', async () => {
  const { source, dest } = await fixture();
  await syncEngine({ source, dest });
  await rm(join(source, 'assets', 'a.txt'));
  const second = await syncEngine({ source, dest });
  assert.deepEqual(second.removed, ['assets/a.txt']);
});

test('drift reports changed, missing and extra files', async () => {
  const { source, dest } = await fixture();
  await syncEngine({ source, dest });
  assert.deepEqual(await engineDrift({ source, dest }), []);

  await writeFile(join(dest, 'filmcraft_web.js'), 'tampered');
  await rm(join(dest, 'index.html'));
  await writeFile(join(dest, 'stale.txt'), 'old');

  const drift = await engineDrift({ source, dest });
  const reasons = Object.fromEntries(drift.map((d) => [d.path, d.reason]));
  assert.equal(reasons['filmcraft_web.js'], 'sha256');
  assert.equal(reasons['index.html'], 'missing');
  assert.equal(reasons['stale.txt'], 'extra');
});

test('hasEngine is false before the first sync', async () => {
  const { dest } = await fixture();
  assert.equal(await hasEngine(dest), false);
});
