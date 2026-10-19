// 剪映草稿 → 面板时间轴模型。
//
// 事实依据（来自 jianying-cli 的真实产物与夹具，非推测）：
// - draft_content.json 顶层含 duration / fps / canvas_config / materials / tracks / version / platform
// - 所有时间量都是**微秒**（µs）。例：3 秒 @30fps 的 duration = 3000000
// - track = { id?, type, name?, attribute?, segments: [] }，type 形如 video/audio/text/sticker/effect
// - segment = { id?, material_id?, target_timerange:{start,duration}, speed?, volume?,
//               clip?:{alpha,rotation,scale{x,y},transform{x,y},flip{horizontal,vertical}},
//               uniform_scale?:{on,value}, common_keyframes? }
// - materials 是按类别分的桶（videos/audios/texts/stickers/effects/transitions/... 共 40+ 个）
//
// 设计约束：草稿格式会随剪映版本漂移，因此本模块**只做结构化归一化，不臆造字段**。
// 任何读不到的语义一律进入 gaps，由面板显式展示"未覆盖"，而不是静默显示成 0。

/** 剪映时间单位是微秒；面板内部统一用毫秒显示，避免浮点误差累积。 */
export const US_PER_MS = 1000;
export const MICROS_PER_SECOND = 1000000;

/** 面板当前能渲染的轨道类型；其余类型只统计、不排布，并进入 gaps。 */
export const RENDERED_TRACK_TYPES = Object.freeze(['video', 'audio', 'text', 'sticker']);

const KNOWN_MATERIAL_BUCKETS = Object.freeze([
  'videos', 'audios', 'texts', 'stickers', 'effects', 'video_effects',
  'audio_effects', 'transitions', 'masks', 'material_animations', 'speeds',
  'audio_fades', 'canvases', 'shapes', 'text_templates', 'material_colors',
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/** 素材桶索引：material_id → {bucket, material}。用于时间轴上显示真实素材名而不是裸 id。 */
export function indexMaterials(materials) {
  const index = new Map();
  if (!materials || typeof materials !== 'object') return index;
  for (const [bucket, list] of Object.entries(materials)) {
    if (!Array.isArray(list)) continue;
    for (const material of list) {
      if (!material || typeof material !== 'object') continue;
      const id = material.id ?? material.material_id;
      if (typeof id === 'string' && id) index.set(id, { bucket, material });
    }
  }
  return index;
}

/** 素材的可读名称。剪映不同版本字段名不一致，按优先级回退，绝不编造。 */
export function materialLabel(entry) {
  if (!entry) return null;
  const m = entry.material;
  const candidates = [
    m.name, m.material_name, m.content?.title, m.content?.name,
    entry.bucket === 'texts' ? m.content?.text : null,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return null;
}

/** 从片段的 common_keyframes 里抽出可展示的关键帧点。不同版本字段位置不同，逐个回退。 */
export function keyframeSeries(segment) {
  const source = segment?.common_keyframes ?? segment?.clip?.common_keyframes;
  if (!source || typeof source !== 'object') return [];
  const out = [];
  for (const [property, points] of Object.entries(source)) {
    if (!Array.isArray(points)) continue;
    for (const point of points) {
      const time = point?.time_offset_us ?? point?.timeOffset ?? point?.offset_us;
      if (typeof time !== 'number') continue;
      out.push({
        property,
        timeMs: time / US_PER_MS,
        values: point.values ?? point.value ?? null,
      });
    }
  }
  out.sort((a, b) => a.timeMs - b.timeMs);
  return out;
}

/**
 * 归一化单个片段。
 * 缺失 target_timerange 是**结构性错误**而不是 0 时长——那样会让面板画出一段假片段。
 */
function normalizeSegment(segment, trackType, materialIndex, gaps, trackRef) {
  const range = segment?.target_timerange;
  if (!range || typeof range.start !== 'number' || typeof range.duration !== 'number') {
    gaps.push({
      kind: 'segment_without_timerange',
      track: trackRef,
      reason: '片段缺少 target_timerange，面板无法排布，已跳过而不是画成零长度',
    });
    return null;
  }
  if (range.duration < 0) {
    gaps.push({
      kind: 'segment_negative_duration',
      track: trackRef,
      reason: `片段时长为负 (${range.duration}µs)，已跳过`,
    });
    return null;
  }
  const entry = typeof segment.material_id === 'string' ? materialIndex.get(segment.material_id) : null;
  return {
    id: segment.id ?? null,
    materialId: segment.material_id ?? null,
    materialBucket: entry?.bucket ?? null,
    label: materialLabel(entry) ?? segment.material_id ?? '(未命名片段)',
    startMs: range.start / US_PER_MS,
    durationMs: range.duration / US_PER_MS,
    speed: typeof segment.speed === 'number' ? segment.speed : null,
    volume: typeof segment.volume === 'number' ? segment.volume : null,
    alpha: typeof segment.clip?.alpha === 'number' ? segment.clip.alpha : null,
    rotation: typeof segment.clip?.rotation === 'number' ? segment.clip.rotation : null,
    scale: segment.clip?.scale ?? null,
    transform: segment.clip?.transform ?? null,
    uniformScale: segment.uniform_scale ?? null,
    keyframes: keyframeSeries(segment),
  };
}

/**
 * 主入口：把 draft_content.json 归一化成面板模型。
 * @param {object} draft draft_content.json 解析结果
 * @returns {{durationMs:number,fps:number|null,canvas:object,tracks:object[],gaps:object[],summary:object}}
 */
export function normalizeDraft(draft) {
  const gaps = [];
  if (!draft || typeof draft !== 'object') {
    return {
      durationMs: 0, fps: null, canvas: null, tracks: [], gaps: [],
      summary: { readable: false, reason: 'draft_content.json 不是对象，可能是加密草稿或空文件' },
    };
  }
  const materialIndex = indexMaterials(draft.materials);
  const tracks = [];
  for (const [trackIndex, track] of asArray(draft.tracks).entries()) {
    const type = typeof track?.type === 'string' ? track.type : 'unknown';
    const ref = `${trackIndex}:${track?.id ?? 'track'}`;
    if (!RENDERED_TRACK_TYPES.includes(type)) {
      gaps.push({
        kind: 'track_type_not_rendered',
        track: ref,
        reason: `轨道类型 ${type} 尚未接入面板渲染，已计数但不排布`,
      });
    }
    const clips = [];
    for (const segment of asArray(track?.segments)) {
      const clip = normalizeSegment(segment, type, materialIndex, gaps, ref);
      if (clip) clips.push(clip);
    }
    clips.sort((a, b) => a.startMs - b.startMs);
    tracks.push({
      index: trackIndex,
      id: track?.id ?? null,
      type,
      name: track?.name ?? type,
      attribute: track?.attribute ?? null,
      rendered: RENDERED_TRACK_TYPES.includes(type),
      clips,
      durationMs: clips.reduce((max, c) => Math.max(max, c.startMs + c.durationMs), 0),
    });
  }
  const fps = typeof draft.fps === 'number' && draft.fps > 0 ? draft.fps : null;
  const declared = typeof draft.duration === 'number' ? draft.duration / US_PER_MS : 0;
  const computed = tracks.reduce((max, t) => Math.max(max, t.durationMs), 0);
  // 声明时长与轨道实算时长不一致时保留两个数字，让面板如实显示差异而不是替用户猜。
  const durationMismatch = Math.abs(declared - computed) > 1;
  if (durationMismatch) {
    gaps.push({
      kind: 'duration_mismatch',
      reason: `draft.duration 声明 ${declared.toFixed(0)}ms，但轨道实算 ${computed.toFixed(0)}ms，两者不一致`,
    });
  }
  return {
    durationMs: Math.max(declared, computed),
    declaredDurationMs: declared,
    computedDurationMs: computed,
    fps,
    canvas: draft.canvas_config ?? null,
    platform: draft.platform ?? null,
    version: draft.version ?? null,
    tracks,
    gaps,
    summary: {
      readable: true,
      trackCount: tracks.length,
      clipCount: tracks.reduce((sum, t) => sum + t.clips.length, 0),
      materialCount: materialIndex.size,
      knownBuckets: KNOWN_MATERIAL_BUCKETS.filter((b) => (draft.materials?.[b] ?? []).length > 0),
    },
  };
}

/** 代理帧索引：把 ffmpeg 产出的代理帧目录变成面板可播放的清单。 */
export function buildProxyIndex(frames, fps) {
  const list = asArray(frames)
    .map(frame => ({
      name: typeof frame?.name === 'string' ? frame.name : null,
      indexMs: typeof frame?.timeMs === 'number' ? frame.timeMs : null,
    }))
    .filter(frame => frame.name && frame.indexMs !== null)
    .sort((a, b) => a.indexMs - b.indexMs);
  return {
    fps: typeof fps === 'number' ? fps : null,
    count: list.length,
    spanMs: list.length ? list[list.length - 1].indexMs : 0,
    frames: list,
  };
}
