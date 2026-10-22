# Action Plan（剧本）规范 `jianyingcraft-action-plan/v1`

> 目标：让智能体**先写剧本，再动时间线**。每个 action 必须说清五件事：
> 用哪个官方资源（编号）、放在哪个位置（轨道/片段）、什么时间、多长、什么参数。
> 资源选型由 7 个 `jianyingcraft-resource-*` 技能负责；执行由 `command_run` 负责。

## 0. 为什么需要 plan

直接让模型“边想边点”会出三类问题：

1. **编号瞎编**：模型记不住 4000+ 个 19 位编号，必须查目录。
2. **动作顺序错**：先加转场再放片段、先设字幕样式再导字幕，都会失败。
3. **不可复核**：改完只看“命令成功”，不看画面与结构。

Plan 是**可审阅的中间产物**：用户先看剧本，确认后再逐条执行；失败时能定位到具体 action。

```mermaid
flowchart LR
  A[读 7 个资源技能] --> B[查 catalogs/query.mjs 选真实编号]
  B --> C[写 action-plan.json]
  C --> D[command_list 核对命令 id]
  D --> E[逐条 command_run]
  E --> F[sequence.inspect 核结构]
  F --> G[render_frame / screenshot 核画面]
  G -->|不一致| C
  G -->|一致| H[save_project 到全新路径]
```

## 1. 顶层结构

```json
{
  "schema": "jianyingcraft-action-plan/v1",
  "meta": {
    "plan_id": "chuanxi-3day-v1",
    "title": "川西三日 · 18s 预告",
    "created_at": "2026-10-22T09:00:00+08:00",
    "author": "agent",
    "workspace": "E:/craft/workspace",
    "project": "chuanxi-3day.fcproj",
    "sequence": "Main",
    "fps": 30,
    "canvas": {"width": 1920, "height": 1080},
    "duration": {"seconds": 18.0},
    "resource_policy": "local-downloaded-only",
    "allow_vip": false,
    "notes": "所有资源编号来自 catalogs/；未下载的资源停在 action 上等用户确认"
  },
  "actions": []
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `schema` | string | 是 | 固定 `jianyingcraft-action-plan/v1` |
| `meta` | object | 是 | 计划元信息 |
| `meta.plan_id` | string | 是 | 稳定标识，同一工程重跑用同一 id |
| `meta.title` | string | 是 | 人读标题 |
| `meta.created_at` | RFC 3339 | 否 | 计划生成时间 |
| `meta.author` | string | 否 | `agent` / 用户名 |
| `meta.workspace` | string | 否 | 绝对工作区；必须与 `open_editor` 一致 |
| `meta.project` | string | 否 | 草稿文件名或相对路径 |
| `meta.sequence` | string | 否 | 目标序列名/ id；默认当前活动序列 |
| `meta.fps` | number | 是 | 用于秒↔帧换算；必须与序列一致 |
| `meta.canvas` | object | 否 | 画布尺寸；用于位置/安全区校验 |
| `meta.duration` | time object | 否 | 计划总时长 |
| `meta.resource_policy` | string | 是 | 目前只允许 `local-downloaded-only` |
| `meta.allow_vip` | boolean | 否 | 默认 `false`；`true` 才允许 VIP 条目 |
| `meta.notes` | string | 否 | 给用户看的说明/风险 |

## 2. action 字段

```json
{
  "id": "a03",
  "action": "timeline.transition",
  "target": {"clip": "shot-01", "edge": "out", "track": "V1", "kind": "video"},
  "resource_id": "7049979667406656014",
  "resource_name": "3D空间",
  "at": {"seconds": 4.5},
  "duration": {"seconds": 1.5},
  "params": {"engine_effect": "cross_dissolve", "alignment": "center"},
  "ui_hint": "在 V1 的 shot-01 出点加 1.5s 空间感转场"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | `a01`…；计划内唯一，执行日志用它定位 |
| `action` | enum | 是 | 见下表；这是**语义动作**，不一定是引擎命令 id |
| `target` | object | 是 | 作用对象：`kind` + `track` + `clip`/`clips`/`edge` |
| `resource_id` | string \| null | 是 | catalogs 里的真实编号；非目录资源（SRT/本地文件/PNG）用 `null` |
| `resource_name` | string | 是 | 与 `resource_id` 对应的真实名称，便于人工复核 |
| `at` | time object | 是 | 起始时间；转场/字幕可用片段边界 |
| `duration` | time object | 是 | 持续时长；静态样式类动作可等于目标片段时长 |
| `params` | object | 是 | 命令参数 + 选型辅助字段（`engine_effect`/`asset_path`/`lut_path` 等） |
| `ui_hint` | string | 是 | 给用户/面板看的一句话预期；不参与执行，但用于验收比对 |

### 语义 action 表

| `action` | 用于 | 资源技能 | 真实引擎命令（以 `command_list` 为准） |
|---|---|---|---|
| `text.animate` | 标题/花字/文本动画 | `jianyingcraft-resource-text` | `graphics.newText` + `graphics.set` + `effects.setKeyframe` |
| `timeline.transition` | 片段转场 | `jianyingcraft-resource-transition` | `sequence.applyVideoTransition` / `sequence.setTransition` |
| `effects.apply` | 滤镜/画面特效/人物特效/音频处理 | `-filter` / `-effect` / `-audio` | `effects.apply`（滤镜另可 `lut.import` + `lumetri.setInputLut`） |
| `timeline.place` | 音频文件/贴纸/图片 | `-audio` / `-sticker` | `file.import` + `timeline.place` / `graphics.newFromFile` |
| `captions.import` | 字幕轨 | `-caption` | `captions.import` + `captions.setStyle` |

### 时间对象

`at` 与 `duration` 都是 time object，**恰好一个**单位字段：

```json
{"seconds": 4.5}
{"frame": 135}
{"ticks": 1143072000000}
{"timecode": "00:00:04:15"}
```

- 权威单位是 `Tick`：1 秒 = 254 016 000 000 tick。
- 计划里优先写 `seconds`（可读）；需要精确对齐时写 `ticks` 或 `frame`。
- **不要混用**：同一个对象里出现两个单位字段，执行器应拒绝。
- 30fps 下 1.5s = 45 帧；换 fps 必须重算 `frame`。

## 3. 资源政策（硬约束）

1. **只引用本机已下载的资源编号**。编号只证明“选哪一个”，不证明素材存在。
2. `resource_id` 必须能在 `catalogs/index.json` 的对应目录里查到；查不到就停。
3. `resource_name` 必须与编号匹配；名称对不上时以编号为准并报警。
4. 默认 `allow_vip=false`；VIP 条目要显式打开并确认用户有权益。
5. 非目录资源（本地音效、贴纸 PNG、SRT、LUT 文件）用 `resource_id: null`，
   但 `params` 必须给出工作区内真实路径。
6. 未下载/VIP 无权益时，**停在该 action**，报告 `resource_name` + `resource_id`，
   不要换编号糊过去，也不要假装执行成功。

## 4. 八个 action 的完整示例

场景：18 秒川西旅行预告，封面标题 + 两处转场 + 一颗滤镜 + 一处变声 + 一条字幕 + 一个贴纸。

```json
{
  "schema": "jianyingcraft-action-plan/v1",
  "meta": {
    "plan_id": "chuanxi-3day-v1",
    "title": "川西三日 · 18s 预告",
    "created_at": "2026-10-22T09:00:00+08:00",
    "author": "agent",
    "workspace": "E:/craft/workspace",
    "project": "chuanxi-3day.fcproj",
    "sequence": "Main",
    "fps": 30,
    "canvas": {"width": 1920, "height": 1080},
    "duration": {"seconds": 18.0},
    "resource_policy": "local-downloaded-only",
    "allow_vip": false,
    "notes": "资源编号均来自 catalogs/；贴纸与 LUT 需本机文件"
  },
  "actions": [
    {
      "id": "a01",
      "action": "text.animate",
      "target": {"kind": "graphic", "track": "V2"},
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
      "ui_hint": "封面主标题 0.2s 起逐字出现，2.4s 后停留"
    },
    {
      "id": "a02",
      "action": "text.animate",
      "target": {"kind": "graphic", "track": "V2"},
      "resource_id": "7051843475892867598",
      "resource_name": "扫光",
      "at": {"seconds": 0.6},
      "duration": {"seconds": 3.0},
      "params": {
        "text": "四姑娘山 · 冬季徒步",
        "font": "得意黑",
        "font_resource_id": "7399865900821647935",
        "size": 42,
        "position": [960, 520],
        "fill_color": "#F5F5F5",
        "animation_loop": "扫光",
        "engine_fallback": "keyframes"
      },
      "ui_hint": "副标题在主标题下方 0.6s 出现，扫光只做 3s，不要全片闪"
    },
    {
      "id": "a03",
      "action": "timeline.transition",
      "target": {"kind": "video", "clip": "shot-01", "edge": "out", "track": "V1"},
      "resource_id": "7049979667406656014",
      "resource_name": "3D空间",
      "at": {"seconds": 4.5},
      "duration": {"seconds": 1.5},
      "params": {
        "engine_effect": "cross_dissolve",
        "alignment": "center",
        "reverse": false
      },
      "ui_hint": "第一镜到第二镜用 1.5s 空间感转场，前后各让 0.75s"
    },
    {
      "id": "a04",
      "action": "timeline.transition",
      "target": {"kind": "video", "clip": "shot-02", "edge": "out", "track": "V1"},
      "resource_id": "7397337005387944457",
      "resource_name": "上下翻页",
      "at": {"seconds": 11.8},
      "duration": {"seconds": 1.0},
      "params": {
        "engine_effect": "cross_dissolve",
        "alignment": "center",
        "reverse": false
      },
      "ui_hint": "第二镜到第三镜用 1.0s 翻页，节奏比上一处快"
    },
    {
      "id": "a05",
      "action": "effects.apply",
      "target": {"kind": "video", "clips": ["shot-01", "shot-02", "shot-03"]},
      "resource_id": "7127828208690433311",
      "resource_name": "1980",
      "at": {"seconds": 0},
      "duration": {"seconds": 18.0},
      "params": {
        "intensity": 65,
        "lut_path": "assets/luts/1980.cube",
        "engine_effect": "<lumetri.presets 或 effects.list 的真实名字>"
      },
      "ui_hint": "全片统一 1980 复古调，强度 65；人物特写单独复查肤色"
    },
    {
      "id": "a06",
      "action": "effects.apply",
      "target": {"kind": "audio", "clip": "vo-01", "track": "A1"},
      "resource_id": "7161319747584266766",
      "resource_name": "8bit",
      "at": {"seconds": 4.3},
      "duration": {"seconds": 0.6},
      "params": {
        "engine_effect": "<effects.list kind=Audio 的真实名字>",
        "change_voice_param_pitch_shift": 0.6,
        "change_voice_param_timbre": 1.0,
        "change_voice_param_strength": 0.8
      },
      "ui_hint": "把 A1 旁白 4.3s 那一句切成独立片段做 8bit，不要全片变声"
    },
    {
      "id": "a07",
      "action": "captions.import",
      "target": {"kind": "caption", "track": "C1"},
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
        "margin": 0.08
      },
      "ui_hint": "导入字幕后整轨设思源黑体 Medium 42px、白字黑边、底部安全区"
    },
    {
      "id": "a08",
      "action": "timeline.place",
      "target": {"kind": "sticker", "track": "V3"},
      "resource_id": "6839514681044898311",
      "resource_name": "撒星星",
      "at": {"seconds": 8.0},
      "duration": {"seconds": 2.0},
      "params": {
        "asset_path": "assets/stickers/sa-xingxing.png",
        "scale": 45,
        "position": [1280, 260],
        "opacity": 90
      },
      "ui_hint": "V3 的 8s 处叠加撒星星，右上角，避开人脸与字幕"
    }
  ]
}
```

## 5. 逐条映射到命令与 MCP `command_run`

前提：`editor_status` 为 ready；`command_list` 已确认每个 id 存在。
下表的 `<...>` 是运行时返回值（clip id / item id / lut id），不要预先编造。

| # | action | 引擎命令 id | `command_run` params（要点） | 验收 |
|---|---|---|---|---|
| a01 | `text.animate` | `graphics.newText` | `{"text":"川西三日","position":[960,420],"size":96,"font":"SourceHanSansCN-Bold","seconds":2.4,"time":<ticks>}` | `graphics.list` 有 1 个文本层 |
| a01 | 样式 | `graphics.set` | `{"clip":"<a01 clip>","props":{"fill_color":"#FFFFFF","stroke":true,"stroke_width":4}}` | `render_frame` 字可读 |
| a01 | 动画近似 | `effects.toggleAnimation` + `effects.setKeyframe` | 对 `opacity`/`position` 写 2–3 帧 | 预览首 2.4s 有变化 |
| a02 | `text.animate` | `graphics.newText` + `graphics.set` | 同上，`font:"得意黑"`、`size:42`、`position:[960,520]` | 副标题不挡主标题 |
| a03 | `timeline.transition` | `sequence.applyVideoTransition` | `{"clip":"shot-01","effect":"<engine transition>","frames":45,"edge":"out"}` | `sequence.inspect` 有转场条目 |
| a04 | `timeline.transition` | `sequence.applyVideoTransition` | `{"clip":"shot-02","effect":"<engine transition>","frames":30,"edge":"out"}` | 总时长未异常缩短 |
| a05 | `effects.apply`（滤镜） | `lut.import` → `lumetri.setInputLut` | `{"path":"assets/luts/1980.cube","name":"1980"}`；再 `{"clip":"<clip>","lut":"lib:<id>"}` | 三个片段都有 LUT 条目 |
| a05 | 备选（无 LUT） | `effects.apply` | `{"clips":["shot-01"],"effect":"<effects.list 真实名>"}` | `render_frame` 色调接近 |
| a06 | `effects.apply`（音频） | `effects.apply` | `{"clips":["vo-01"],"effect":"<audio effect>"}` | `sequence.inspect` 有音频效果 |
| a06 | 参数 | `effects.setParam` | `{"clip":"vo-01","effect":"<名字或索引>","param":"change_voice_param_strength","value":0.8}` | 回听可懂 |
| a07 | `captions.import` | `captions.import` | `{"path":"subs/ep01.srt"}` | `captions.list` 条数 = cue 数 |
| a07 | 样式 | `captions.setStyle` | `{"track":"C1","font":"SourceHanSansCN-Medium","size":42,"color":"#FFFFFF","outline":2,"anchor":"bottom","margin":0.08}` | `render_frame` 不出安全区 |
| a08 | `timeline.place`（贴纸） | `file.import` → `graphics.newFromFile` | `{"paths":["assets/stickers/sa-xingxing.png"]}`；再 `{"path":"...","time":<ticks>,"track":2}` | V3 有贴纸层 |
| a08 | 位置/大小 | `graphics.set` | `{"clip":"<sticker clip>","props":{"scale":45,"position":[1280,260],"opacity":90}}` | 不挡脸/不压字幕 |

> 转场：`timeline.transition` 是**语义动作名**；真实命令是 `sequence.applyVideoTransition`。
> 滤镜：`effects.apply` 是语义动作名；有 LUT 时优先 `lut.import` + `lumetri.setInputLut`。
> 音效：`audio_scene_effects` 是**音频处理**，走 `effects.apply`；可放置的音效文件才走 `timeline.place`。
> 贴纸：贴纸没有目录，`resource_id` 只是风格参考；真正落盘靠 `asset_path`。

## 6. 执行顺序与检查点

1. **准备**：`editor_status` → `command_list` → `file.open`/`file.newProject` → `file.import` 素材。
2. **先做结构**：放片段（`timeline.place`）→ 转场（a03/a04）→ 字幕（a07）。
3. **再做视觉**：滤镜（a05）→ 特效 → 文本（a01/a02）→ 贴纸（a08）。
4. **最后做声音**：音频处理（a06）→ 混音/响度。
5. **每个 checkpoints 后**：`sequence.inspect`（结构）+ `render_frame`（画面）。
   不要 8 条一口气跑完再检查。
6. **交付前**：`file.saveAs` 到**全新路径**；`file.open` 读回；`inspect` 结构；
   `file.exportMedia` 成功且 `offlineMedia` 为空（若用户要成片）。

回滚：

- 单条失败：`edit.undo` 回到上一步，再修 plan；不要连续 undo 冲掉用户已有修改。
- 转场加错：先 `edit.undo` 回退再重加；当前命令目录没有独立的"移除转场"命令，
  不要假设 `sequence.removeTransition` 一定存在，以 `command_list` 为准。
- 滤镜/特效加错：`effects.remove {"clip":...,"index":n}` 后重加。
- 无法回滚：重新 `file.open` 上一次保存的工程，并报告已丢失的修改。

## 7. 已知缺口（必须如实告知用户）

| 缺口 | 影响 | 当前做法 |
|---|---|---|
| 可见引擎不解析剪映 `resource_id` | 转场/特效/滤镜/文本动画只能按**引擎名**近似 | `params.engine_effect` 先查 `effects.list`；近似要在报告里写明 |
| 贴纸没有目录 | 无法用编号直接落贴纸 | 用画面特效的贴纸语义条目选型 + 用户本机 PNG + `graphics.newFromFile` |
| 字幕轨没有逐条动画 | 「居中打字」等无法直接套在字幕上 | 静态字幕；或 `graphics.upgradeCaption` 转图形层后关键帧 |
| `audio_scene_effects` 不是音效文件 | 不能直接 `timeline.place` | 走 `effects.apply` 做音频处理；可放置音效让用户提供文件 |
| VIP 资源需要权益 | 802/1052 滤镜、323/453 转场是 VIP | `allow_vip=false` 默认拒绝；换免费条目或让用户确认 |
| `fonts.json` 有一个同编号别名 | `6766524209620324877` 对应两个名称 | 已知例外，测试白名单；选型时按名称+md5 复核 |

精确落剪映编号的路径是宿主侧 jianying-cli（`engine_cli_run`），
它写的是剪映草稿，不会同步到可见面板的 `.fcproj`；两条路径不要互相冒充。


## 参考：分镜时间轴技能

写 action plan 前，先用 `jianyingcraft-shot-timeline` 技能把每个镜头写成八类资源同表（素材/滤镜/特效/文本/贴纸/音频/转场/字幕），再逐条映射到本文件的 action 字段；贴纸等没有目录的类别必须标 `planned`，不得假装已落盘。
