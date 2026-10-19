// 草稿模型单元测试。夹具字段取自 jianying-cli 的 tests/fixtures/pyjyd_wire/text_core.normalized.json
// 与 crates/jianying-draft/tests/fixtures/draft_edge_cases.json，时间单位均为微秒。
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDraft, keyframeSeries, indexMaterials, materialLabel, buildProxyIndex } from '../draft-model.mjs';

const realTextDraft = {
  duration: 3000000,
  fps: 30,
  canvas_config: { width: 1280, height: 720, ratio: 'original' },
  materials: { texts: [{ id: 'text-1', content: { text: '标题字幕' } }] },
  tracks: [{
    type: 'text',
    name: 'text',
    attribute: 0,
    segments: [{
      material_id: 'text-1',
      target_timerange: { start: 0, duration: 3000000 },
      speed: 1,
      volume: 1,
      clip: { alpha: 1, rotation: 0, scale: { x: 1, y: 1 }, transform: { x: 0, y: -0.78 } },
      uniform_scale: { on: true, value: 1 },
    }],
  }],
};

test('真实文本草稿：微秒转毫秒、素材名解析、时长一致', () => {
  const model = normalizeDraft(realTextDraft);
  assert.equal(model.summary.readable, true);
  assert.equal(model.fps, 30);
  assert.equal(model.declaredDurationMs, 3000);
  assert.equal(model.computedDurationMs, 3000);
  assert.equal(model.tracks.length, 1);
  const clip = model.tracks[0].clips[0];
  assert.equal(clip.startMs, 0);
  assert.equal(clip.durationMs, 3000);
  assert.equal(clip.label, '标题字幕');
  assert.equal(clip.materialBucket, 'texts');
  assert.equal(clip.alpha, 1);
  assert.deepEqual(clip.transform, { x: 0, y: -0.78 });
  assert.equal(model.gaps.length, 0);
});

test('重叠片段（真实夹具 overlapping-existing-segments）全部保留并按起点排序', () => {
  const draft = {
    tracks: [{
      id: 'track-1', type: 'video',
      segments: [
        { id: 'segment-2', material_id: 'video-1', target_timerange: { start: 500000, duration: 1000000 } },
        { id: 'segment-1', material_id: 'video-1', target_timerange: { start: 0, duration: 1000000 } },
      ],
    }],
    materials: { videos: [{ id: 'video-1', name: '镜头 A.mp4' }] },
  };
  const model = normalizeDraft(draft);
  const clips = model.tracks[0].clips;
  assert.equal(clips.length, 2, '重叠片段不能被丢弃');
  assert.deepEqual(clips.map(c => c.id), ['segment-1', 'segment-2']);
  assert.equal(clips[1].startMs, 500);
  assert.equal(model.tracks[0].durationMs, 1500);
});

test('空轨道（真实夹具 empty-track）归一化为零片段，不报错', () => {
  const model = normalizeDraft({ tracks: [{ id: 'track-empty', type: 'video', segments: [] }], materials: {} });
  assert.equal(model.summary.readable, true);
  assert.equal(model.tracks[0].clips.length, 0);
  assert.equal(model.tracks[0].rendered, true);
});

test('缺失 target_timerange 进 gaps 而不是画成零长度片段', () => {
  const model = normalizeDraft({ tracks: [{ id: 't', type: 'video', segments: [{ id: 'x' }] }] });
  assert.equal(model.tracks[0].clips.length, 0);
  assert.equal(model.gaps.length, 1);
  assert.equal(model.gaps[0].kind, 'segment_without_timerange');
});

test('未接入渲染的轨道类型只计数并进 gaps', () => {
  const model = normalizeDraft({
    tracks: [{ id: 'e', type: 'effect', segments: [{ id: 's', target_timerange: { start: 0, duration: 1000 } }] }],
    materials: {},
  });
  assert.equal(model.tracks[0].rendered, false);
  assert.equal(model.summary.clipCount, 1, '统计仍然包含它');
  assert.ok(model.gaps.some(g => g.kind === 'track_type_not_rendered'));
});

test('声明时长与轨道实算不一致时保留两个数字并报 gap', () => {
  const model = normalizeDraft({
    duration: 10000000,
    tracks: [{ type: 'video', segments: [{ id: 's', target_timerange: { start: 0, duration: 1000000 } }] }],
    materials: {},
  });
  assert.equal(model.declaredDurationMs, 10000);
  assert.equal(model.computedDurationMs, 1000);
  assert.ok(model.gaps.some(g => g.kind === 'duration_mismatch'));
});

test('加密或损坏草稿返回可诊断结果而不是抛错', () => {
  for (const bad of [null, undefined, 'x', 42]) {
    const model = normalizeDraft(bad);
    assert.equal(model.summary.readable, false);
    assert.equal(model.tracks.length, 0);
  }
});

test('关键帧按时间排序，时间从微秒转毫秒', () => {
  const series = keyframeSeries({
    common_keyframes: {
      'KF.GaussianBlur': [
        { time_offset_us: 1500000, values: [0.5] },
        { time_offset_us: 500000, values: [0.1] },
      ],
    },
  });
  assert.equal(series.length, 2);
  assert.deepEqual(series.map(k => k.timeMs), [500, 1500]);
  assert.equal(series[0].property, 'KF.GaussianBlur');
});

test('素材索引覆盖多桶并按优先级取名', () => {
  const index = indexMaterials({
    videos: [{ id: 'v1', name: '航拍.mp4' }],
    texts: [{ id: 't1', content: { text: '片头字' } }],
    audios: [{ id: 'a1', material_name: '配乐' }],
    sticks: [{ id: 's1', name: '星星' }],
  });
  assert.equal(materialLabel(index.get('v1')), '航拍.mp4');
  assert.equal(materialLabel(index.get('t1')), '片头字');
  assert.equal(materialLabel(index.get('a1')), '配乐');
  assert.equal(index.get('missing'), undefined);
  assert.equal(materialLabel(undefined), null);
});

test('代理帧清单过滤无效项并按时间排序', () => {
  const proxy = buildProxyIndex([
    { name: 'frame_0002.jpg', timeMs: 2000 },
    { name: 'frame_0000.jpg', timeMs: 0 },
    { name: null, timeMs: 1000 },
    { name: 'frame_0001.jpg', timeMs: null },
  ], 25);
  assert.equal(proxy.count, 2);
  assert.equal(proxy.fps, 25);
  assert.equal(proxy.spanMs, 2000);
  assert.deepEqual(proxy.frames.map(f => f.name), ['frame_0000.jpg', 'frame_0002.jpg']);
});

test('空代理清单不报错', () => {
  const proxy = buildProxyIndex([], null);
  assert.equal(proxy.count, 0);
  assert.equal(proxy.spanMs, 0);
});
