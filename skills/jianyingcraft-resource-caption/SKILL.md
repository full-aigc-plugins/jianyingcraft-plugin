---
name: jianyingcraft-resource-caption
description: 剪映字幕样式资源技能。用字体 + 文本动画 + 字幕轨样式组合出字幕观感，并映射到 JianyingCraft 的 captions 命令。当用户说"字幕样式""字幕用什么字体""字幕怎么出现""统一样式/导出SRT"时使用。
license: Apache-2.0
---

# 字幕资源（jianyingcraft-resource-caption）

## 0. 字幕没有独立目录

剪映的"字幕样式"不是一颗可引用的资源，而是三件事的组合：

| 组成 | 来自哪个目录 | 引擎落点 |
|---|---|---|
| 字体 | `catalogs/fonts.json` | `captions.setStyle` 的 `font`（必须是本机字体族） |
| 出现/消失方式 | `catalogs/text_animations_in.json`、`catalogs/text_animations_out.json` | 字幕轨**不支持逐条动画**；需要动画时 `graphics.upgradeCaption` 转图形层 |
| 字号/颜色/描边/位置 | 无目录，按规范设定 | `captions.setStyle` 的 `size`/`color`/`outline`/`anchor`/`margin` |

> 所以字幕技能的本质是：**先把 SRT 导进来，再整轨设样式**。
> 不要拿一个字体编号或文本动画编号当"字幕样式"整体套用。

## 1. 目录与字段

| 文件 | 内容 | 条数 | VIP |
|---|---|---:|---:|
| `catalogs/fonts.json` | 字体 | 798 | 318 |
| `catalogs/text_animations_in.json` | 文本入场动画（字幕出现方式参考） | 145 | 78 |
| `catalogs/text_animations_out.json` | 文本出场动画（字幕消失方式参考） | 97 | 46 |

| 字段 | 含义 |
|---|---|
| `name` | 剪映界面显示名，如「SourceHanSansCN-Medium」「居中打字」 |
| `resource_id` | **剪映资源编号**；字体/动画的选型键 |
| `effect_id` | 剪映内部效果 id |
| `vip` | 是否会员素材 |
| `md5` | 资源文件摘要，用于核对本机字体 |
| `duration_us` | 动画建议时长；字体没有 |
| `params` | 字体/动画通常为空 |

## 2. 使用场景表

| 场景 | 什么片子/镜头 | 推荐条目（真实 name） | 样式建议 | 注意 |
|---|---|---|---|---|
| 口播知识视频 | 讲解、课程、测评 | SourceHanSansCN-Medium | 40–46px，白字黑边，底部 | 可读性优先，别用花体 |
| 访谈/纪实 | 人物访谈、纪录片 | SourceHanSansCN-Normal | 38–42px，克制 | 不要抢人物表情 |
| 剧情短片 | 对白、独白 | 居中打字（入场）+ 复古打字机 | 36–42px | 逐字动画只在关键句用 |
| 美食教程 | 步骤、配料 | 抖音美好体 + 弹入 | 42–48px，暖白 | 字号大、停留久 |
| 电商促销 | 价格、卖点 | 得意黑 + 向右滑动（出场） | 48–56px，高对比 | 别遮商品主体 |
| 国风/文化 | 诗词、非遗、茶 | 汇文明朝体 + 模糊（出场） | 36–44px | 字体风格强，字号别太大 |
| 新闻/快讯 | 资讯、口播 | 优设标题黑 + 向上滑动（入场） | 40–46px | 左上/底部固定位置 |
| 综艺花字 | 吐槽、效果字 | 站酷文艺体 + 弹入 | 44–52px，可加彩色描边 | 花字是图形层，不是字幕轨 |
| 双语字幕 | 中英对照、海外内容 | SourceHanSansCN-Bold + 溶解（出场） | 主 40px / 次 30px | 两行间距 ≥ 8px |
| 歌词字幕 | MV、音乐短片 | 庞门正道标题体 + 向上溶解（出场） | 42–50px | 与节拍对齐 |

## 3. 常见编号清单（20 条）

| 名称 | resource_id | 是否会员 | 目录 |
|---|---|---|---|
| SourceHanSansCN-Bold | `7265596643066516029` | 免费 | fonts |
| SourceHanSansCN-Medium | `7265596846465094199` | 免费 | fonts |
| SourceHanSansCN-Normal | `7265596944867660346` | 免费 | fonts |
| 抖音美好体 | `7244518590332801592` | 免费 | fonts |
| 得意黑 | `7399865900821647935` | 免费 | fonts |
| 优设标题黑 | `7068207165277737502` | 免费 | fonts |
| 站酷文艺体 | `7265593885475213880` | 免费 | fonts |
| 庞门正道标题体 | `7265611148060267045` | 免费 | fonts |
| 汇文明朝体 | `7444913491762221577` | 免费 | fonts |
| A1明朝 | `7246698168547545602` | 免费 | fonts |
| 向右滑动 | `6724920136056181256` | 免费 | text_animations_in |
| 向上滑动 | `6763470111253729803` | 免费 | text_animations_in |
| 居中打字 | `7265222187286532667` | 免费 | text_animations_in |
| 复古打字机 | `7253888335163167291` | 免费 | text_animations_in |
| 弹入 | `6887482184844710413` | 免费 | text_animations_in |
| 渐隐 | `6724919382104871427` | 免费 | text_animations_out |
| 向右滑动 | `6724920744431587853` | 免费 | text_animations_out |
| 向上溶解 | `7026619708627489293` | 免费 | text_animations_out |
| 模糊 | `6923094772907250189` | 免费 | text_animations_out |
| 溶解 | `6872642354898014728` | 免费 | text_animations_out |

> 完整清单用 `node catalogs/query.mjs fonts --query 思源 --limit 0` 这类按名查询，
> 动画分别查 `text_animations_in` / `text_animations_out`。
> **不要凭记忆编造编号**；同名「向右滑动」在入场/出场各有一个编号，不能混用。

## 4. action plan 用法

```json
{
  "schema": "jianyingcraft-action-plan/v1",
  "meta": {"plan_id": "demo-caption", "title": "川西三日 · 字幕", "fps": 30},
  "actions": [
    {
      "id": "a07",
      "action": "captions.import",
      "target": {"track": "C1", "kind": "caption"},
      "resource_id": null,
      "resource_name": "SRT 字幕轨",
      "at": {"seconds": 0},
      "duration": {"seconds": 18.0},
      "params": {
        "path": "subs/ep01.srt",
        "font": "SourceHanSansCN-Medium",
        "font_resource_id": "7265596846465094199",
        "size": 42,
        "color": "#FFFFFF",
        "outline": 2,
        "outlineColor": "#000000",
        "anchor": "bottom",
        "margin": 0.08,
        "animation_in": "向右滑动",
        "animation_out": "渐隐"
      },
      "ui_hint": "导入字幕后整轨设思源黑体 Medium 42px、白字黑边、底部安全区；动画只在关键句用"
    }
  ]
}
```

字段到命令的对应：

| action plan 字段 | 引擎命令 / 参数 | 说明 |
|---|---|---|
| `action: "captions.import"` | `captions.import` | 支持 SRT/VTT；导入后自动建 C1 |
| `params.path` | `captions.import.params.path` | 工作区内 UTF-8 文件；不要改扩展名冒充 |
| `params.font` | `captions.setStyle.params.font` | 必须是 `fonts.list` 里的字体族；缺字体先安装/替换 |
| `params.size` / `color` / `outline` | `captions.setStyle` 同名字段 | `size` 是 px；`color` 用 `#rrggbb[aa]` |
| `params.anchor` / `margin` | `captions.setStyle` 的 `anchor` / `margin` | `margin` 是画面高度比例（0–0.45） |
| `params.animation_in/out` | 字幕轨**不支持**逐条动画 | 要动画就 `graphics.upgradeCaption` 转图形层，再关键帧 |
| `target.track` | `captions.list` / `captions.setStyle` 的 `track` | 默认 C1；多语言轨用 C1/C2 |
| 时间微调 | `captions.setTimes` / `captions.trim` / `captions.move` | 逐条改，不要整轨重导 |
| 导出 | `captions.export` | SRT/VTT/SCC/MCC/STL/TTML；格式按扩展名 |

执行顺序（MCP）：

1. `command_list {"filter": "captions"}` 确认 `captions.import`、`captions.setStyle`、`captions.list` 存在。
2. `fonts.list` 查 `SourceHanSansCN-Medium` 是否可用；缺字体先 `file.replaceFonts` 或让用户安装。
3. `captions.import {"path":"subs/ep01.srt"}`。
4. `captions.setStyle {"track":"C1","font":"SourceHanSansCN-Medium","size":42,"color":"#FFFFFF","outline":2,"outlineColor":"#000000","anchor":"bottom","margin":0.08}`。
5. `captions.list` 核对条数与首末条时间；`captions.setTimes` 只改错位条目。
6. `render_frame` 抽一条字幕的画面，检查安全区、可读性、是否挡脸。
7. 需要交付字幕文件：`captions.export {"path":"subs/ep01.out.srt"}`。

## 5. 执行前检查

- **只引用本机已安装的字体编号**：字体没装时 `font` 族名会回退；先让用户安装或换字体。
- **VIP**：fonts 318 条、入场 78 条、出场 46 条是 VIP；没有权益就换免费条目。
- **可读性**：白字必须配描边或半透明底；亮背景上纯白字会糊。
- **安全区**：底部 `margin ≥ 0.06`；竖屏/方屏要单独复核。
- **条数**：导入后 `captions.list` 条数应与 SRT cue 数一致；差太多先查编码/格式。
- **动画**：字幕轨没有逐条动画；要做「居中打字」就转图形层，成本更高，先和用户确认。

## 6. 失败处理

| 现象 | 动作 |
|---|---|
| `captions.import` 报路径错误 | 确认工作区内 UTF-8 的 SRT/VTT；不要改扩展名 |
| 导入条数为 0 | 查文件是否为空/cue 格式错误；贴出前 3 行 |
| 字体没生效 | `fonts.list` 核对族名；缺字体先安装或用 `file.replaceFonts` |
| 字幕超出安全区 | 调 `anchor`/`margin`/`size`；不要裁掉文字 |
| 字幕挡脸 | 上移或缩字号；必要时拆行 |
| 逐条动画做不了 | 说明字幕轨限制；提供"转图形层"或"静态字幕"两个选项 |

## 7. 禁止

- 不要用一个字体编号当"整套字幕样式"。
- 不要在字幕轨上硬塞文本动画参数；引擎不认。
- 不要覆盖用户已有字幕轨；需要替换先显式确认。
- 不要把导出的 SRT 行数说成与 `captions.list` 一致而不核对。
