import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'E:/workspaces/jianyingcraft-work/youth-video';
const cut = (i, ext) => join(dir, 'media', 'cut-' + String(i + 1).padStart(2, '0') + ext);
const shots = [
  [0, '.jpg', '清新', '光晕', 1.00],
  [1, '.jpg', '日系奶油', '仙尘闪闪', 1.12],
  [2, '.jpg', '夏日风吟', '丁达尔光线', 1.00],
  [3, '.jpg', '清晰明亮', '光斑飘落', 1.10],
  [4, '.jpg', '夏日小美好', '光晕', 1.00],
  [5, '.jpg', '清新漫和', '光斑虚化', 1.14],
  [6, '.jpg', '清晰明亮', 'CCD闪光', 1.00],
  [7, '.jpg', '清新', '丁达尔光线', 1.08],
  [8, '.jpg', '日系奶油', '仙尘闪闪', 1.00],
  [9, '.jpg', '夏日风吟', '光晕', 1.12],
  [10, '.webp', '清新', '光斑飘落', 1.00],
  [11, '.webp', '清晰明亮', '光晕', 1.06],
];
const transitions = { 1: '叠化', 3: '泛白', 5: '渐变擦除', 7: '星星', 9: '拉远' };
const segments = shots.map(([idx, ext, filter, effect, scale], i) => {
  const seg = {
    start_us: i * 2500000,
    duration_us: 2500000,
    source: cut(idx, ext),
    background_filling: { type: 'blur', blur: 0.0625 },
    scale,
    filters: [{ name: filter, intensity: i % 2 === 0 ? 55 : 70 }],
    effects: [{ name: effect, params: {} }],
  };
  if (transitions[i]) seg.transition_out = { name: transitions[i], duration_us: 800000 };
  return seg;
});
const textSegments = [
  { start_us: 600000, duration_us: 1800000, text: '18岁的夏天', size: 18, x: 0, y: -0.12, color: '#FFFFFF', border_color: '#000000', border_width: 40, bold: true, font: '优设标题圆', animation_in: { name: '变色输入', duration_us: 600000 }, animation_out: { name: '向上擦除', duration_us: 500000 } },
  { start_us: 10500000, duration_us: 1800000, text: '少年不散场', size: 16, x: 0, y: -0.10, color: '#FFFFFF', border_color: '#1A1A1A', border_width: 35, bold: true, font: '优设标题圆', animation_in: { name: '右上弹入', duration_us: 600000 } },
  { start_us: 26800000, duration_us: 2400000, text: '致我们', size: 20, x: 0, y: -0.06, color: '#FFFFFF', border_color: '#000000', border_width: 45, bold: true, font: '优设标题圆', animation_in: { name: '变色输入', duration_us: 700000 }, animation_out: { name: '向上溶解', duration_us: 600000 } },
];
const sfx = [
  { start_us: 2400000, duration_us: 600000, source: join(dir, 'audio', 'whoosh.wav'), volume: 0.5 },
  { start_us: 9600000, duration_us: 800000, source: join(dir, 'audio', 'riser.wav'), volume: 0.45 },
  { start_us: 24700000, duration_us: 1000000, source: join(dir, 'audio', 'sparkle.wav'), volume: 0.5 },
];
const plan = {
  schema: 'jianying-cli-plan/v1',
  name: '青春·少年时 v2',
  canvas: { width: 1080, height: 1920, fps: 30 },
  tracks: [
    { type: 'video', name: '主视频', segments },
    { type: 'audio', name: '背景音乐', segments: [{ start_us: 0, duration_us: 30000000, source: join(dir, 'audio', 'bgm-youth-30s.wav'), volume: 0.85, fade: { in_us: 500000, out_us: 900000 } }] },
    { type: 'audio', name: '音效', segments: sfx },
    { type: 'text', name: '花字', segments: textSegments },
  ],
};
writeFileSync(join(dir, 'plan.json'), JSON.stringify(plan, null, 2) + '\n');
console.log('plan.json written with', segments.length, 'cuts');