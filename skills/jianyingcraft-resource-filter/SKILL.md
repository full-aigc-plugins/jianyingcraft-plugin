---
name: jianyingcraft-resource-filter
description: 剪映滤镜官方资源技能。写 action plan 时查真实滤镜编号（1980、港风、赛博朋克、侘寂灰…），并映射到 JianyingCraft 的 LUT / 调色命令。当用户说"调色""加滤镜""统一色调""要复古/港风/日系"时使用。
license: Apache-2.0
---

# 滤镜资源（jianyingcraft-resource-filter）

## 0. 先分清三条执行路径

| 路径 | 命令 | 何时用 | 代价 |
|---|---|---|---|
| 导入 LUT | `lut.import` + `lumetri.setInputLut` | 用户本机有对应 `.cube` / `.3dl` 文件 | 最接近剪映滤镜；强度需另做 |
| 引擎内置调色 | `effects.apply`（如高斯模糊/亮度对比度）或 `lumetri.applyPreset` | 没有 LUT 文件，只要风格接近 | 只能近似，不是同一颗滤镜 |
| 精确剪映编号 | 宿主侧 `jianying timeline add-filter --slug … --resource-id …` | 要写剪映草稿并保留 `resource_id` | 产物不是可见面板的 `.fcproj` |

> `filters.json` 只给「选哪颗滤镜」的编号；它不包含 LUT 文件本体。

## 1. 目录与字段

| 文件 | 内容 | 条数 | VIP |
|---|---|---:|---:|
| `catalogs/filters.json` | 滤镜 | 1052 | 802 |

| 字段 | 含义 |
|---|---|
| `name` | 剪映界面显示名，如「1980」「港风」「赛博朋克」 |
| `resource_id` | **剪映资源编号**，19 位数字串，action plan 引用它 |
| `effect_id` | 剪映内部效果 id；部分滤镜与 `resource_id` 相同 |
| `vip` | 是否会员素材；本目录 VIP 占比很高（802/1052） |
| `md5` | 资源文件摘要，用于核对本机 LUT/滤镜是否同一份 |
| `params` | 多数滤镜为空；少数带可调参数（如强度） |
| `duration_us` | 本目录没有该字段；滤镜是静态调色，跟随片段/整片时长 |

## 2. 使用场景表

| 场景 | 什么片子/镜头 | 推荐条目（真实 name） | 强度建议 | 注意 |
|---|---|---|---|---|
| 复古街拍/年代感 | 城市扫街、旧物、80/90 年代回忆 | 1980 | 60–75 | 高光容易发黄，人物肤色单独看 |
| 日系日常 | 咖啡、家居、阴天室外 | 日系奶油 | 50–65 | 适合低对比场景 |
| 港风夜景 | 霓虹、出租车、雨夜 | 港风 | 55–70 | 绿色/青色偏移明显，别叠太多 |
| 赛博/科技 | 电竞、夜景、屏幕光 | 赛博朋克 | 45–60 | 蓝紫溢出，注意字幕可读性 |
| 人像美妆 | 口播、美妆、采访 | ABG / 亮肤 | 30–50 | 亮肤类不要全片套，容易假 |
| 清透人像 | 初恋感、校园、写真 | 初恋 | 40–55 | 高光提亮，避免过曝 |
| 侘寂/高级灰 | 茶室、器物、极简 | 侘寂灰 | 50–65 | 低饱和，配水墨转场更统一 |
| 阴天救片 | 灰蒙蒙的户外素材 | 清晰明亮 | 35–50 | 先降对比再提清晰，别救回死白 |
| 国风山水 | 山水中景、古镇、书法 | 千里江山 | 50–70 | 青绿倾向强，人物镜头慎用 |
| 夏日户外 | 海边、草地、露营 | 仲夏绿光 | 45–60 | 绿色饱和高，肤色会偏 |
| 冬日美食 | 火锅、烧烤、暖光餐桌 | 冬日烧烤 | 50–65 | 暖调，配「8bit」音效不搭，慎用 |
| 黑白纪实 | 访谈、历史、苦难叙事 | 褪色（近似） | 40–55 | 目录里没有纯黑白条目，需另做去色 |

## 3. 常见编号清单（20 条）

| 名称 | resource_id | 是否会员 |
|---|---|---|
| 1980 | `7127828208690433311` | 免费 |
| ABG | `7127679308897832206` | 免费 |
| Ditto | `7195816046077496635` | 免费 |
| Lofi II | `7232216810031025468` | 免费 |
| VHS III | `7127669764905782542` | 免费 |
| 三洋VPC | `7127669338089311495` | 免费 |
| 侘寂灰 | `7127609569416711455` | 免费 |
| 冷白 | `7127614731187178783` | 免费 |
| 港风 | `7127830945243090184` | 免费 |
| 复古工业 | `7127608212483820837` | 免费 |
| 日系奶油 | `7127664177870671135` | 免费 |
| 赛博朋克 | `7127657979838516494` | 免费 |
| 清晰明亮 | `7433813603758722342` | 免费 |
| 褪色 | `7127668404764380447` | 免费 |
| 亮肤 | `7127655008715230495` | 免费 |
| 初恋 | `7195812984306814267` | 免费 |
| 仲夏绿光 | `7127675970252754189` | 免费 |
| 冬日烧烤 | `7449704838763466035` | 免费 |
| 原木 | `7127675195812351239` | 免费 |
| 千里江山 | `7208495854938901793` | 免费 |

> 完整清单用 `node catalogs/query.mjs filters --limit 0`；只看免费用 `--free`。
> **不要凭记忆编造编号**；1052 条里有大量同名变体（`港风` / `港风复古` / `港风夜景`），必须现查。

## 4. action plan 用法

```json
{
  "schema": "jianyingcraft-action-plan/v1",
  "meta": {"plan_id": "demo-filter", "title": "川西三日 · 调色", "fps": 30},
  "actions": [
    {
      "id": "a05",
      "action": "effects.apply",
      "target": {"clips": ["shot-01", "shot-02", "shot-03"], "kind": "video"},
      "resource_id": "7127828208690433311",
      "resource_name": "1980",
      "at": {"seconds": 0},
      "duration": {"seconds": 18.0},
      "params": {
        "intensity": 65,
        "lut_path": "assets/luts/1980.cube",
        "engine_effect": "<lumetri.presets 或 effects.list 的真实名字>"
      },
      "ui_hint": "全片统一 1980 复古调，强度约 65；人物特写镜头单独复查肤色"
    }
  ]
}
```

字段到命令的对应：

| action plan 字段 | 引擎命令 / 参数 | 说明 |
|---|---|---|
| `action: "effects.apply"` | ① `lut.import` + `lumetri.setInputLut`；② `effects.apply`；③ `lumetri.applyPreset` | 三条路径按本机资源选一条，不要三条一起上 |
| `target.clips` | `lut` 路径逐 clip 设置；`effects.apply` 用 `params.clips` | LUT 是逐片段设置，不存在"全局 LUT 轨" |
| `params.lut_path` | `lut.import {"path":"...","name":"1980"}` | 只接受本机文件；没有文件就走内置近似 |
| `params.intensity` | `effects.setParam`（有 intensity 参数时）或预烘焙 LUT | 输入 LUT 本身没有强度；不要假装调了 65% |
| `params.engine_effect` | `effects.list {"kind":"Video","detail":true}` 的真实名字 | 先查再用，不要猜 |
| `at` / `duration` | `sequence.inspect` 核对覆盖范围 | 调色应覆盖整段，不要在片段中间断掉 |

执行顺序（MCP）：

1. `command_list {"filter": "lut"}` 与 `command_list {"filter": "lumetri"}` 确认命令存在。
2. 有 LUT 文件：`command_run {"id":"lut.import","params":{"path":"assets/luts/1980.cube","name":"1980"}}`，
   然后 `lut.list` 取 `lib:<id>`。
3. `command_run {"id":"lumetri.setInputLut","params":{"clip":"shot-01","lut":"lib:<id>"}}`，逐个片段设置。
4. 没有 LUT：`effects.list {"kind":"Video","detail":true}` 找最接近的内置效果，
   `command_run {"id":"effects.apply","params":{"clips":["shot-01"],"effect":"<真实名字>"}}`。
5. `render_frame` 抽人物特写与高光镜头；`sequence.inspect` 确认每个片段都有调色条目。

精确绑定剪映编号（可选，宿主侧）：

```bash
jianying timeline add-filter <draft> --slug "1980" --resource-id 7127828208690433311 \
  --start 0 --duration 18000000 --jianying
```

## 5. 执行前检查

- **只引用本机已下载/已导出的资源编号**：没有 `.cube` 就不要承诺"用了 1980"；
  先让用户导出或下载对应 LUT。
- **VIP**：本目录 802 条 VIP；没有权益就换免费条目，不要用 VIP 编号占位。
- **强度**：LUT 路径下"强度"要么预烘焙、要么另加透明度/混合层；不要传一个引擎不认的 `intensity`。
- **肤色**：所有风格滤镜都要抽一帧人物特写复查；偏色就降强度或换条目。
- **字幕可读性**：调色后字幕对比度会变，`captions.setStyle` 的字色/描边要跟着复核。

## 6. 失败处理

| 现象 | 动作 |
|---|---|
| `lut.import` 报文件不存在 | 报告绝对路径缺失；不要改扩展名冒充 `.cube` |
| `lumetri.setInputLut` 报 "need `lut`" | 先 `lut.list` 取 id；不要直接传文件名 |
| 片段没有调色条目 | `sequence.inspect` 看 clip id 是否正确；LUT 是逐片段设置 |
| 画面偏色严重 | 降强度/换条目；贴 `render_frame` 结果，不要口头保证 |
| 只有 VIP 条目符合风格 | 停在该 action，报告需用户开通权益或换免费近似 |
| 调色后字幕看不清 | 调 `captions.setStyle` 的 `color`/`outline`，不要删字幕 |

## 7. 禁止

- 不要把 `filters.json` 的 `resource_id` 直接塞进 `effects.apply` 的 `effect` 字段；它要的是引擎效果名。
- 不要声称"导入 LUT"而实际只套了内置预设；近似必须写明。
- 不要在一段素材上叠三四个风格滤镜"调出来"；选一颗，强度不够再微调。
- 不要把 `effect_id` 与 `resource_id` 混用。
