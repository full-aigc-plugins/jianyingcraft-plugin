#!/usr/bin/env node
// 剪映资源目录查询器：给 Agent / 人一个「按名字找真实编号」的稳定入口。
//
// 设计约束：
// 1. 只读 catalogs/*.json，不联网、不推断、不补全编号。
// 2. 分类名以 catalogs/index.json 的键为准，未知分类直接失败（exit 1），
//    避免 Agent 用错目录还继续往下写 action plan。
// 3. 表格给人看，`--json` 给脚本看；两者使用同一份过滤结果。
//
// 用法：
//   node catalogs/query.mjs <category> [--query 文本] [--free] [--limit N] [--json]
//
// 退出码：0 成功；1 分类/文件错误；2 参数错误。

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = join(HERE, 'index.json');

/** 每个目录的一句话用途；表格的「用途提示」列以它为主。 */
const CATEGORY_HINTS = {
  audio_scene_effects: '音频处理/变声，挂在音频片段上',
  tone_effects: '音色替换，改变人声质感',
  speech_to_songs: '人声转歌声',
  text_animations_in: '文本入场动画（标题/字幕出现）',
  text_animations_out: '文本出场动画（标题/字幕退场）',
  text_animations_loop: '文本循环动画（强调/氛围）',
  fonts: '字体，用于标题/字幕/花字',
  video_scene_effects: '画面特效；部分条目是贴纸语义',
  video_character_effects: '人物特效，需要人物主体',
  video_animations_in: '片段入场动画',
  video_animations_out: '片段出场动画',
  video_animations_group: '片段组合动画',
  transitions: '片段衔接转场',
  filters: '调色滤镜，套用后可调强度',
  masks: '蒙版形状，用于遮罩/分屏',
  mix_modes: '图层混合模式',
};

const USAGE = `用法: node catalogs/query.mjs <category> [选项]

选项:
  --query <文本>   按名称做大小写不敏感的子串过滤
  --free           只保留非会员（vip=false）条目
  --limit <N>      最多输出 N 条，默认 20；N=0 表示不限制
  --json           输出原始条目 JSON 数组
  -h, --help       显示本帮助

示例:
  node catalogs/query.mjs transitions --query 3D --limit 3
  node catalogs/query.mjs filters --free --limit 50 --json`;

function fail(message, code = 2) {
  console.error(message);
  process.exit(code);
}

function loadIndex() {
  let raw;
  try {
    raw = readFileSync(INDEX_PATH, 'utf8');
  } catch (error) {
    fail(`无法读取 ${INDEX_PATH}: ${error.message}`, 1);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
  } catch (error) {
    fail(`catalogs/index.json 不是合法 JSON: ${error.message}`, 1);
  }
  if (!parsed || typeof parsed !== 'object' || !parsed.catalogs || typeof parsed.catalogs !== 'object') {
    fail('catalogs/index.json 缺少 catalogs 对象', 1);
  }
  return parsed;
}

/** 解析参数；不依赖第三方库，避免插件多装依赖。 */
function parseArgs(argv) {
  const options = { category: null, query: '', free: false, limit: 20, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      console.log(USAGE);
      process.exit(0);
    }
    if (arg === '--free') {
      options.free = true;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--query' || arg.startsWith('--query=')) {
      const value = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : argv[++i];
      if (value === undefined || value === '') fail('--query 需要一个文本参数');
      options.query = value;
      continue;
    }
    if (arg === '--limit' || arg.startsWith('--limit=')) {
      const value = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : argv[++i];
      if (value === undefined || !/^\d+$/.test(value)) fail('--limit 需要一个非负整数');
      options.limit = Number.parseInt(value, 10);
      continue;
    }
    if (arg.startsWith('-')) fail(`未知选项: ${arg}`);
    if (options.category !== null) fail(`只能指定一个分类，多余参数: ${arg}`);
    options.category = arg;
  }
  return options;
}

/** 显示宽度：CJK/全角字符按 2 格算，保证表格在中文名下列对齐。 */
function charWidth(char) {
  const cp = char.codePointAt(0);
  if (cp === undefined) return 0;
  if (
    cp >= 0x1100 &&
    (cp <= 0x115f ||
      cp === 0x2329 ||
      cp === 0x232a ||
      (cp >= 0x2e80 && cp <= 0xa4cf && cp !== 0x303f) ||
      (cp >= 0xac00 && cp <= 0xd7a3) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe10 && cp <= 0xfe19) ||
      (cp >= 0xfe30 && cp <= 0xfe6f) ||
      (cp >= 0xff00 && cp <= 0xff60) ||
      (cp >= 0xffe0 && cp <= 0xffe6) ||
      (cp >= 0x1f300 && cp <= 0x1f64f) ||
      (cp >= 0x1f900 && cp <= 0x1f9ff) ||
      (cp >= 0x20000 && cp <= 0x3fffd))
  ) {
    return 2;
  }
  return 1;
}

function displayWidth(text) {
  let width = 0;
  for (const char of text) width += charWidth(char);
  return width;
}

function truncateDisplay(text, maxWidth) {
  if (displayWidth(text) <= maxWidth) return text;
  let out = '';
  let width = 0;
  for (const char of text) {
    const next = charWidth(char);
    if (width + next > maxWidth - 1) break;
    out += char;
    width += next;
  }
  return `${out}…`;
}

function padDisplay(text, width) {
  const gap = width - displayWidth(text);
  return gap > 0 ? text + ' '.repeat(gap) : text;
}

/** 表格里的「用途提示」：分类用途 + 时长建议 + 可调参数数量。 */
function usageHint(category, entry) {
  const parts = [CATEGORY_HINTS[category] ?? '资源'];
  if (Number.isFinite(entry.duration_us) && entry.duration_us > 0) {
    parts.push(`建议 ${Math.round(entry.duration_us / 1000)}ms`);
  }
  if (Array.isArray(entry.params) && entry.params.length > 0) {
    parts.push(`${entry.params.length} 个可调参数`);
  }
  return parts.join(' · ');
}

function printTable(category, rows) {
  const headers = ['编号', '名称', '是否会员', '用途提示'];
  const body = rows.map((entry) => [
    String(entry.resource_id ?? ''),
    String(entry.name ?? ''),
    entry.vip === true ? 'VIP' : '免费',
    usageHint(category, entry),
  ]);

  const widths = headers.map((header, column) => {
    const max = Math.max(displayWidth(header), ...body.map((row) => displayWidth(row[column])));
    // 编号是 19 位数字串，必须完整显示；名称/用途只做展示性截断。
    return column === 0 ? Math.max(max, 19) : Math.min(max, column === 1 ? 32 : column === 3 ? 52 : 12);
  });

  const line = (cells, transform = (value) => value) =>
    `| ${cells
      .map((cell, column) => padDisplay(truncateDisplay(transform(cell), widths[column]), widths[column]))
      .join(' | ')} |`;

  console.log(line(headers));
  console.log(`| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`);
  for (const row of body) console.log(line(row));
}

const options = parseArgs(process.argv.slice(2));
const index = loadIndex();
const categories = Object.keys(index.catalogs);

if (options.category === null) {
  console.error('缺少分类。\n');
  console.error(USAGE);
  console.error(`\n可用分类: ${categories.join(', ')}`);
  process.exit(1);
}

if (!categories.includes(options.category)) {
  console.error(`未知分类: ${options.category}`);
  console.error(`可用分类: ${categories.join(', ')}`);
  process.exit(1);
}

const catalogPath = join(HERE, `${options.category}.json`);
let entries;
try {
  const raw = readFileSync(catalogPath, 'utf8');
  entries = JSON.parse(raw.replace(/^\uFEFF/, ''));
} catch (error) {
  console.error(`无法读取 ${options.category}.json: ${error.message}`);
  process.exit(1);
}
if (!Array.isArray(entries)) {
  console.error(`${options.category}.json 顶层必须是数组`);
  process.exit(1);
}

const needle = options.query.trim().toLowerCase();
let rows = entries;
if (needle !== '') {
  rows = rows.filter((entry) => String(entry.name ?? '').toLowerCase().includes(needle));
}
if (options.free) {
  rows = rows.filter((entry) => entry.vip !== true);
}
if (options.limit > 0) {
  rows = rows.slice(0, options.limit);
}

if (options.json) {
  console.log(JSON.stringify(rows, null, 2));
} else if (rows.length === 0) {
  console.log('（没有匹配条目）');
} else {
  printTable(options.category, rows);
}
