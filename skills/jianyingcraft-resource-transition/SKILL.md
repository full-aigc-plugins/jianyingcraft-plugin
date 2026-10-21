---
name: jianyingcraft-resource-transition
description: 剪映转场官方资源技能。写 action plan 时查真实转场编号（3D空间、上下翻页、叠化、故障…），再映射到 JianyingCraft 的转场命令。当用户说"加转场""片段怎么衔接""要个翻页/叠化/故障效果"时使用。
license: Apache-2.0
---

# 转场资源（jianyingcraft-resource-transition）

## 0. 先分清两件事

- **选型**：用 `catalogs/transitions.json` 里的真实 `name` + `resource_id` 决定「用哪个转场」。
- **执行**：可见编辑器（`.fcproj`）用 `sequence.applyVideoTransition`；它吃的是**引擎转场名**
  （如 `cross_dissolve`），不是剪映的 `resource_id`。二者之间的解析目前要人工/查表完成。
- **精确绑定剪映编号**：走宿主侧 jianying-cli（`engine_cli_run`），
  它接受剪映转场名称并写入 `resource_id` / `effect_id`；但产物是剪映草稿，不是可见面板里的 `.fcproj`。

> 结论：**编号负责选型，引擎命令负责画面**。不要把 453 个剪映编号当成 453 个引擎内置转场。

## 1. 目录与字段

| 文件 | 内容 | 条数 | VIP |
|---|---|---:|---:|
| `catalogs/transitions.json` | 转场 | 453 | 323 |

| 字段 | 含义 |
|---|---|
| `name` | 剪映界面显示名，如「3D空间」「上下翻页」 |
| `resource_id` | **剪映资源编号**，action plan 里引用它；19 位数字串 |
| `effect_id` | 剪映内部效果 id；与 `resource_id` 一起落盘，不要混用 |
| `vip` | 是否会员素材 |
| `md5` | 资源文件摘要，用来核对本机资源是否为同一份 |
| `duration_us` | 建议时长（微秒）；实际时长受前后片段长度约束 |
| `is_overlap` | 是否占用前后片段重叠时长；`true` 时两个片段都要让出这段 |

## 2. 使用场景表

| 场景 | 什么片子/镜头 | 推荐条目（真实 name） | 建议时长 | 注意 |
|---|---|---|---|---|
| 开篇封面 → 正片 | 旅行、产品发布、空间感强的开场 | 3D空间 | 1.5s | `is_overlap=true`，前后片段各让 0.75s |
| 场景/地点切换 | 旅行 vlog、探店、城市漫游 | 上下翻页 | 1.0s | 明快，适合硬切太生硬时 |
| 同一场景时间跳跃 | 回忆、训练过程、延时 | 叠化 | 0.5s | 最稳的万能转场，不抢戏 |
| 美食/产品特写 | 特写 → 成品、细节 → 全景 | 中心旋转 | 0.5s | 旋转中心要落在主体上 |
| 梦境/回忆/柔化 | 情绪段落、空镜 | 云朵 | 0.5s | 柔边，适合低饱和画面 |
| 水面/倒影镜头 | 湖面、雨后、镜面 | 倒影 | 0.5s | 前后镜头亮度差不要太大 |
| 故障/赛博/科技 | 电竞、科技评测、转场卡点 | 故障 / 雪花故障 | 1.0s | 配 8bit 音效更统一 |
| 国风/水墨 | 山水中景、书法、茶 | 水墨 | 0.5s | 背景尽量留白 |
| 快节奏卡点 | 混剪、踩点、预告 | 闪白 / 分割 | 0.3–0.5s | 闪白别连续用，容易刺眼 |
| 人物出场/换装 | 变装、角色介绍 | 抠像旋转 | 0.8s | 需要带 alpha 的抠像素材，否则边缘会穿帮 |

## 3. 常见编号清单（20 条）

| 名称 | resource_id | 是否会员 |
|---|---|---|
| 3D空间 | `7049979667406656014` | 免费 |
| 上下翻页 | `7397337005387944457` | 免费 |
| 中心旋转 | `6858191434294497805` | 免费 |
| 云朵 | `6955722927161479694` | 免费 |
| 倒影 | `6748313807031898627` | 免费 |
| 叠化 | `6724845717472416269` | 免费 |
| 右移 | `6726711296063967748` | 免费 |
| 向上 | `6724227090872275463` | 免费 |
| 分割 | `6968372308419285540` | 免费 |
| 闪白 | `6724845376098013708` | 免费 |
| 故障 | `6725771847444468236` | 免费 |
| 水墨 | `6789847231873683976` | 免费 |
| 翻页 | `6747979085894390279` | 免费 |
| 逆时针旋转 | `6724226603372515853` | 免费 |
| 顺时针旋转 | `6724226684721041932` | 免费 |
| 抠像旋转 | `7386584387128660506` | 免费 |
| 雪花故障 | `6724866446842663431` | 免费 |
| 电视故障 I | `7046293801123451405` | 免费 |
| 分割 II | `6969782622868214302` | 免费 |
| 故障拼贴 | `7397337004507140618` | 免费 |

> 完整清单用 `node catalogs/query.mjs transitions`（默认 20 条；`--limit 0` 全量；`--json` 给脚本）。
> **不要凭记忆编造编号**；表外的编号必须现查，尤其是带「II」「III」「IIII」的变体。

## 4. action plan 用法

转场动作建议写成「语义动作名 + 资源编号 + 引擎参数」三段：

```json
{
  "schema": "jianyingcraft-action-plan/v1",
  "meta": {"plan_id": "demo-transition", "title": "川西三日 · 转场", "fps": 30},
  "actions": [
    {
      "id": "a03",
      "action": "timeline.transition",
      "target": {"clip": "shot-01", "edge": "out", "track": "V1"},
      "resource_id": "7049979667406656014",
      "resource_name": "3D空间",
      "at": {"seconds": 4.5},
      "duration": {"seconds": 1.5},
      "params": {
        "engine_effect": "cross_dissolve",
        "alignment": "center",
        "reverse": false
      },
      "ui_hint": "在 V1 的 shot-01 出点加 1.5s 空间感转场，预览时看前后片段是否各让 0.75s"
    }
  ]
}
```

字段到命令的对应：

| action plan 字段 | 引擎命令 / 参数 | 说明 |
|---|---|---|
| `action: "timeline.transition"` | `sequence.applyVideoTransition` | 这是语义动作名，不是真实命令 id；真实 id 以 `command_list` 为准 |
| `target.clip` + `target.edge` | `params.clip` + `params.edge`（`in`/`out`） | 转场挂在片段的出点或入点 |
| `duration.seconds` | `params.frames`（秒 × fps） | 引擎按帧取整；30fps 下 1.5s = 45 帧 |
| `params.engine_effect` | `params.effect` | 先 `effects.list {"kind":"VideoTransition"}` 查真实引擎转场名 |
| `params.alignment` / `reverse` | 暂不在 apply 参数里 | 加完后用 `sequence.setTransition` 调参数；不要猜不存在的字段 |
| `at.seconds` | 用于人工核对/`sequence.inspect` | 转场位置由片段边界决定，不是任意时间点 |

执行顺序（MCP）：

1. `command_list {"filter": "transition"}` 确认 `sequence.applyVideoTransition`、`sequence.setTransition` 存在。
2. `effects.list {"kind": "VideoTransition"}` 取引擎真实转场名；确认 `engine_effect` 在列表里。
3. `command_run {"id": "sequence.applyVideoTransition", "params": {"clip": "shot-01", "effect": "cross_dissolve", "frames": 45, "edge": "out"}}`。
4. 需要在加完后改参数：`command_run {"id": "sequence.setTransition", "params": {"transition": "<返回的 transition id>", "params": {}}}`。
5. `sequence.inspect` 核对该片段 `extra_material_refs`/转场条目；`render_frame` 看首尾两帧。

精确绑定剪映编号（可选，宿主侧）：

```bash
# 通过 engine_cli_run 调宿主侧 jianying-cli；产物是剪映草稿
jianying timeline transition <draft> <segment_id> "3D空间" --jianying --duration 1500000
```

这条路径会写入真实 `resource_id` / `effect_id`，但**不会**同步到可见面板的 `.fcproj`。

## 5. 执行前检查

- **只引用本机已下载的资源编号**：剪映转场素材没下载时，`resource_id` 只是选型键，画面上没有对应素材。
  未下载就先让用户下载；不要用编号假装已经应用。
- **VIP**：`vip=true`（本目录 323 条）需要用户有会员权益；没有就换免费条目，不要绕过。
- **引擎名解析**：`engine_effect` 必须出现在 `effects.list` 结果里；没有就退到最接近的内置转场，并在报告里写明「近似」。
- **时长**：`is_overlap=true` 的转场会吃前后片段；加完必须 `sequence.inspect` 看总时长有没有变短。
- **末端片段**：转场不能挂在最后一镜的出点；先确认后面还有片段。

## 6. 失败处理

| 现象 | 动作 |
|---|---|
| `sequence.applyVideoTransition` 报 "unknown transition" | 重新 `effects.list {"kind":"VideoTransition"}`，用返回的名字；不要继续猜 |
| 报 "a transition can't extend past the clips it joins" | 缩短 `frames` 或换更短的转场；不要裁掉用户画面 |
| 加完总时长变短 | 这是 `is_overlap` 的正常行为；报告实际缩短量，让用户确认 |
| `sequence.setTransition` 不认 duration 字段 | 当前版本只在 apply 时定时长；先移除再加，不要传未文档化字段 |
| 剪映素材未下载 | 停止该 action，报告 `resource_name` + `resource_id`，请用户先下载 |
| 预览画面与预期不符 | 贴 `render_frame` 结果和引擎原文错误；不要用"应该没问题"结案 |

## 7. 禁止

- 不要凭记忆写 `resource_id`；表外编号一律现查。
- 不要把 `effect_id` 当 `resource_id` 用；两者落盘字段不同。
- 不要说"加了 3D空间"而实际只加了 `cross_dissolve`；近似就要说近似。
- 不要在一个片段上叠两个转场；当前命令目录没有独立的"移除转场"命令，
  先 `edit.undo` 回退，或查 `command_list` 里引擎版本是否提供移除命令，再重加。
