---
name: jianyingcraft-resource-text
description: 剪映文本动画与字体资源技能。写 action plan 时查真实文本入场/出场/循环动画编号（复古打字机、扫光、弹幕滚动…）和字体编号，再映射到 JianyingCraft 的文本/关键帧命令。当用户说"标题动画""字怎么出来""要打字机/扫光/弹幕效果""换字体"时使用。
license: Apache-2.0
---

# 文本资源（jianyingcraft-resource-text）

## 0. 先分清"动画"和"字体"

| 资源 | 目录 | 负责什么 | 引擎落点 |
|---|---|---|---|
| 入场动画 | `text_animations_in.json` | 标题/字幕**怎么出现** | `graphics.newText` + 关键帧近似 |
| 出场动画 | `text_animations_out.json` | 标题/字幕**怎么消失** | 关键帧近似 |
| 循环动画 | `text_animations_loop.json` | 停留期间的**呼吸/闪烁/滚动** | 关键帧近似 |
| 字体 | `fonts.json` | 字形的**风格** | `graphics.set` 的 `font` 字段 |

> 可见编辑器目前**没有**「按剪映文本动画编号播放动画」的原生命令。
> 动画要么用 `effects.setKeyframe` 近似，要么走宿主侧剪映草稿路径精确落盘。
> 不要把 `text_animations_in` 的编号塞进 `effects.apply` 的 `effect` 字段。

## 1. 目录与字段

| 文件 | 内容 | 条数 | VIP |
|---|---|---:|---:|
| `catalogs/text_animations_in.json` | 文本入场动画 | 145 | 78 |
| `catalogs/text_animations_out.json` | 文本出场动画 | 97 | 46 |
| `catalogs/text_animations_loop.json` | 文本循环动画 | 93 | 52 |
| `catalogs/fonts.json` | 字体 | 798 | 318 |

| 字段 | 含义 |
|---|---|
| `name` | 剪映界面显示名，如「复古打字机」「扫光」「得意黑」 |
| `resource_id` | **剪映资源编号**，action plan 引用它 |
| `effect_id` | 剪映内部效果 id；与 `resource_id` 一起落盘 |
| `vip` | 是否会员素材 |
| `md5` | 资源文件摘要，用于核对本机字体/动画 |
| `duration_us` | 建议动画时长（仅三套动画有）；字体没有 |
| `params` | 字体/动画一般没有可调参数 |

## 2. 使用场景表

| 场景 | 什么片子/镜头 | 推荐条目（真实 name） | 时长/参数 | 注意 |
|---|---|---|---|---|
| 封面主标题 | 旅行、纪录片、Vlog 开场 | 复古打字机（入场） | 0.8–1.5s | 逐字出现，标题别太长 |
| 封面副标题 | 主标题下方信息条 | 向右滑动（入场） | 0.5s | 与主标题错开 0.2s |
| 标题停留强调 | 封面、章节页 | 扫光（循环） | 持续 2–4s | 扫光别全片开，闪 |
| 数字/关键词弹字 | 价格、排名、倒计时 | 弹入（入场） | 0.4–0.6s | 配「8bit」音效更统一 |
| 歌词/口播逐字 | MV、歌词、金句 | 居中打字（入场） | 0.6–1.2s | 与语速对齐 |
| 弹幕/评论区 | 社交感、吐槽、互动 | 弹幕滚动（循环） | 持续 3s+ | 密度别盖住主体 |
| 国风片名 | 山水、茶、书法 | 水墨晕开（出场） | 0.8s | 配「水墨」转场 |
| 快闪促销 | 电商、活动、卡点 | 冲屏位移（入场） | 0.3–0.5s | 字号大、停留短 |
| 文艺片名 | 独立短片、散文 | 渐隐（出场）+ 站酷文艺体 | 0.8–1.5s | 留白比动画重要 |
| 科技字幕 | 评测、数码、赛博 | 向上擦除（入场）+ 优设标题黑 | 0.5s | 与冷色调滤镜统一 |
| 儿童/可爱 | 亲子、萌宠、手账 | 弹入（入场）+ 抖音美好体 | 0.5s | 颜色饱和可以高一点 |

## 3. 常见编号清单（20 条）

| 名称 | resource_id | 是否会员 | 目录 |
|---|---|---|---|
| 复古打字机 | `7253888335163167291` | 免费 | text_animations_in |
| 居中打字 | `7265222187286532667` | 免费 | text_animations_in |
| 打字机 I | `6724920249654710791` | 免费 | text_animations_in |
| 冲屏位移 | `7078181271393800711` | 免费 | text_animations_in |
| 弹入 | `6887482184844710413` | 免费 | text_animations_in |
| 向右滑动 | `6724920136056181256` | 免费 | text_animations_in |
| 向左滑动 | `6763470195894784525` | 免费 | text_animations_in |
| 向上擦除 | `6774625910067827212` | 免费 | text_animations_in |
| 渐隐 | `6724919382104871427` | 免费 | text_animations_out |
| 打字机 I | `6763469696260903435` | 免费 | text_animations_out |
| 水墨晕开 | `7278296130432012857` | 免费 | text_animations_out |
| 溶解 | `6872642354898014728` | 免费 | text_animations_out |
| 扫光 | `7051843475892867598` | 免费 | text_animations_loop |
| 彩虹 | `6908592625406710280` | 免费 | text_animations_loop |
| 弹幕滚动 | `6790247082155315719` | 免费 | text_animations_loop |
| 心跳 | `7210283971316290085` | VIP | text_animations_loop |
| 站酷文艺体 | `7265593885475213880` | 免费 | fonts |
| 抖音美好体 | `7244518590332801592` | 免费 | fonts |
| 优设标题黑 | `7068207165277737502` | 免费 | fonts |
| 得意黑 | `7399865900821647935` | 免费 | fonts |

> 完整清单用 `node catalogs/query.mjs text_animations_in`、
> `text_animations_out`、`text_animations_loop`、`fonts` 分别查。
> **不要凭记忆编造编号**；同名的「打字机 I/II/III/IV」分别在不同目录，不能混用。

## 4. action plan 用法

```json
{
  "schema": "jianyingcraft-action-plan/v1",
  "meta": {"plan_id": "demo-text", "title": "川西三日 · 封面标题", "fps": 30},
  "actions": [
    {
      "id": "a01",
      "action": "text.animate",
      "target": {"track": "V2", "kind": "graphic"},
      "resource_id": "7253888335163167291",
      "resource_name": "复古打字机",
      "at": {"seconds": 0.2},
      "duration": {"seconds": 2.4},
      "params": {
        "text": "川西三日",
        "font": "SourceHanSansCN-Bold",
        "font_resource_id": "7265596643066516029",
        "size": 96,
        "position": [960, 420],
        "fill_color": "#FFFFFF",
        "stroke": true,
        "stroke_width": 4,
        "animation_in": "复古打字机",
        "engine_fallback": "keyframes"
      },
      "ui_hint": "封面标题 0.2s 开始逐字出现，2.4s 后停留；用关键帧近似打字机"
    }
  ]
}
```

字段到命令的对应：

| action plan 字段 | 引擎命令 / 参数 | 说明 |
|---|---|---|
| `action: "text.animate"` | `graphics.newText` + `graphics.set` + 关键帧 | 无原生文本动画命令；先确认 `command_list` 里有没有新命令 |
| `params.text` | `graphics.newText.params.text` | 换行用 `\n`；不要用富文本标记 |
| `params.font` | `graphics.newText.params.font` 或 `graphics.set` 的 `font` | 必须是**本机已安装**的字体族；先用 `fonts.list` 查 |
| `params.font_resource_id` | 仅用于选型/报告 | 剪映字体编号不是字体文件路径；没装字体先让用户安装 |
| `params.position` / `size` | `graphics.newText.params.position` / `size` | 位置是画布像素坐标，不是 0–1 比例 |
| `duration.seconds` | `graphics.newText.params.seconds` | 文本片段默认 5s；按 plan 覆盖 |
| 入场/出场/循环 | `effects.toggleAnimation` + `effects.setKeyframe`（`opacity`/`position`/`scale`） | 近似实现；不要声称播放了剪映原动画 |
| 逐字/打字机 | 每个字符一个文本层或关键帧（成本高） | 优先用 `graphics.setCharStyle` 做局部样式，再整体淡入 |
| 滚动/爬行字幕 | `graphics.setRoll` | 仅 roll/crawl，不是所有循环动画 |

执行顺序（MCP）：

1. `command_list {"filter": "graphics"}` 与 `command_list {"filter": "effects"}` 确认命令存在。
2. `fonts.list` 查字体族是否已安装；缺字体先 `file.replaceFonts` 或让用户安装。
3. `graphics.newText {"text":"川西三日","position":[960,420],"size":96,"font":"SourceHanSansCN-Bold","seconds":2.4,"time":<ticks>}`。
4. `graphics.set {"clip":"<text clip id>","props":{"fill_color":"#FFFFFF","stroke":true,"stroke_width":4}}`。
5. 动画近似：`effects.toggleAnimation` 打开目标参数，再 `effects.setKeyframe` 写 2–3 个关键帧。
6. `sequence.inspect` 确认文本层在 V2、时间正确；`render_frame` 看安全区与可读性。

精确绑定剪映动画（可选，宿主侧）：

```bash
# 宿主侧写剪映草稿时才保留 animation resource_id
jianying timeline add-segment <draft> --track text --text "川西三日" \
  --animation-in "复古打字机" --json
```

## 5. 执行前检查

- **只引用本机已下载/已安装的资源编号**：字体没装、动画包没下载时，编号只是选型键；
  先让用户安装/下载，不要用 `font` 字段硬写一个不存在的字体族。
- **VIP**：入场 78 条、出场 46 条、循环 52 条是 VIP；没有权益就换免费条目。
- **字体匹配**：`fonts.list` 里没有的族名，`graphics.set` 会回退或报错；
  用 `file.replaceFonts` 做替换，不要假装字体生效。
- **安全区**：标题放在上方 10%、字幕放在下方安全区；`render_frame` 复核。
- **可读性**：描边/阴影至少开一个；纯白字压亮背景会糊。

## 6. 失败处理

| 现象 | 动作 |
|---|---|
| `graphics.newText` 报字体不存在 | `fonts.list` 查真实族名；缺字体先安装或用 `file.replaceFonts` |
| 动画命令不存在 | 明确说"可见引擎无原生文本动画"，改用关键帧近似并标注 |
| 文本层被主体挡住 | 调 `track`/`graphics.arrangeLayer`；不要删主体 |
| 逐字动画成本过高 | 改成整段淡入 + 音效；先和用户确认 |
| 导出后字体变了 | 字体未嵌入/未安装；`file.replaceFonts` 后重渲染 |
| 文本超出画面 | 降 `size` 或拆行；不要用负坐标裁掉 |

## 7. 禁止

- 不要把 `text_animations_*` 的编号当 `effects.apply` 的效果名。
- 不要在没装字体时声称"用了得意黑"；要么装，要么换可用字体。
- 不要用记忆里的 `resource_id`；三套动画同名条目很多，必须查目录。
- 不要把字幕样式（字号/颜色/描边）塞进文本动画参数里；那是 `captions.setStyle` 的职责。
