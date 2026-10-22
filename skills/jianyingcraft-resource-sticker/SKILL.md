---
name: jianyingcraft-resource-sticker
description: 剪映贴纸资源技能（含目录局限说明）。当前仓库没有独立贴纸目录，用画面特效里的贴纸语义条目做选型参考，并说明贴纸素材必须来自用户本机。当用户说"加贴纸""撒星星/爱心/气泡""贴个emoji/边框"时使用。
license: Apache-2.0
---

# 贴纸资源（jianyingcraft-resource-sticker）

## 0. 必须知道的局限

**剪映贴纸没有内嵌目录。** 本仓库没有 `catalogs/stickers` 目录：贴纸是应用侧在线素材，
编号只能在用户本机用过/下载过之后采集。现有能查的只有：

| 可用目录 | 与贴纸的关系 | 能做什么 |
|---|---|---|
| `catalogs/video_scene_effects.json` | 有一批**贴纸语义**的画面特效（撒星星、爱心光斑、气泡、边框） | 选型参考；实际是特效，不是贴纸 PNG |
| `catalogs/video_animations_in.json`、`catalogs/video_animations_out.json`、`catalogs/video_animations_group.json` | 片段动画，不是贴纸 | 给贴纸层做入场/出场动画的近似参考 |

所以本技能给的是**语义清单**：先按名字选风格，再让用户提供对应的贴纸素材文件（PNG/序列帧/GIF），
用 `graphics.newFromFile` 或 `timeline.place` 落到时间线。**不要拿特效编号当贴纸编号，也不要用编号假装贴纸已存在。**

## 1. 目录与字段

| 文件 | 内容 | 条数 | VIP |
|---|---|---:|---:|
| `catalogs/video_scene_effects.json` | 画面特效（含贴纸语义条目） | 1097 | 462 |
| `catalogs/video_animations_in.json` | 片段入场动画 | 155 | 117 |
| `catalogs/video_animations_out.json` | 片段出场动画 | 124 | 103 |
| `catalogs/video_animations_group.json` | 片段组合动画 | 123 | 16 |

| 字段 | 含义 |
|---|---|
| `name` | 剪映界面显示名；贴纸语义条目如「撒星星」「爱心光斑」 |
| `resource_id` | **剪映资源编号**；对贴纸语义条目而言是特效编号，不是贴纸编号 |
| `effect_id` | 剪映内部效果 id |
| `vip` | 是否会员素材 |
| `md5` | 资源文件摘要 |
| `params` | 特效可调参数；贴纸层没有这些参数 |
| `duration_us` | 建议时长（动画类） |

## 2. 使用场景表

| 场景 | 什么片子/镜头 | 推荐条目（真实 name） | 建议时长 | 注意 |
|---|---|---|---|---|
| 旅行 Vlog 点缀 | 星空、露营、夜景空镜 | 撒星星 / 星星闪烁 | 2–3s | 别盖住主体和字幕 |
| 情侣/纪念日 | 合照、礼物、告白 | 爱心光斑 / 彩虹爱心 | 2–4s | 粉色系，配暖调滤镜 |
| 直播/弹幕氛围 | 口播、带货、聊天 | 彩虹气泡 | 持续 | 气泡别挡脸 |
| 儿童/亲子 | 手账、玩具、幼儿园 | 手帐边框 | 整段 | 边框要留安全区 |
| 手账/拼贴风 | 生活记录、文具 | 撕纸涂鸦边框 / 剪纸边框 | 整段 | 边框压边，别裁到内容 |
| 节日/万圣 | 万圣节、派对 | 万圣emoji | 1–2s | 节日限定，过了节别用 |
| 美妆/闪亮 | 眼影、首饰、舞台 | emoji钻石 / 爱心bling | 1–2s | 高光别过曝 |
| 夜空/露营 | 星轨、篝火、夜景 | 星星坠落 / 星星投影 | 2–4s | 与「撒星星」二选一 |
| 表情/反应 | 搞笑、吐槽、短剧 | 万圣emoji / 单色涂鸦 | 0.5–1s | 单个表情即可，别刷屏 |
| 标题描边/强调 | 封面、章节页 | 单色涂鸦 | 1–2s | 涂鸦压字，注意可读性 |

## 3. 常见编号清单（20 条，贴纸语义）

| 名称 | resource_id | 是否会员 | 目录 |
|---|---|---|---|
| 撒星星 | `6839514681044898311` | 免费 | video_scene_effects |
| 撒星星 II | `6849588023714124295` | 免费 | video_scene_effects |
| 爱心光斑 | `6709706178340852236` | 免费 | video_scene_effects |
| 爱心光斑 II | `6791647108974776839` | 免费 | video_scene_effects |
| 爱心气泡 | `6792405144655893005` | 免费 | video_scene_effects |
| 爱心泡泡 | `6886709503136371207` | 免费 | video_scene_effects |
| 爱心bling | `6709706255105004045` | 免费 | video_scene_effects |
| 彩虹气泡 | `6717434470128947725` | 免费 | video_scene_effects |
| 彩虹爱心 | `6924873147053249031` | 免费 | video_scene_effects |
| 星星闪烁 | `6778285088485413384` | 免费 | video_scene_effects |
| 星星闪烁 II | `6834010357728547335` | 免费 | video_scene_effects |
| 星星坠落 | `6977257384120947213` | 免费 | video_scene_effects |
| 星星投影 | `6826530141586330120` | 免费 | video_scene_effects |
| 星星灯 | `6903072502369489422` | 免费 | video_scene_effects |
| 万圣emoji | `7021363005052948999` | 免费 | video_scene_effects |
| emoji钻石 | `7078694071245476366` | 免费 | video_scene_effects |
| 单色涂鸦 | `7265798651019006521` | 免费 | video_scene_effects |
| 手帐边框 | `6761336384117543438` | 免费 | video_scene_effects |
| 撕纸涂鸦边框 | `6969851947306193416` | 免费 | video_scene_effects |
| 剪纸边框 | `6926456664228893191` | 免费 | video_scene_effects |

> 完整清单用 `node catalogs/query.mjs video_scene_effects --query 星 --limit 0` 这类按名查询；
> **不要凭记忆编造编号**，更不要把特效编号说成贴纸编号。
> 真正的贴纸编号要用宿主侧采集：`jianying media harvest-enums sync`，从用户用过的草稿里取。

## 4. action plan 用法

```json
{
  "schema": "jianyingcraft-action-plan/v1",
  "meta": {"plan_id": "demo-sticker", "title": "川西三日 · 贴纸", "fps": 30},
  "actions": [
    {
      "id": "a08",
      "action": "timeline.place",
      "target": {"track": "V3", "kind": "sticker"},
      "resource_id": "6839514681044898311",
      "resource_name": "撒星星",
      "at": {"seconds": 8.0},
      "duration": {"seconds": 2.0},
      "params": {
        "asset_path": "assets/stickers/sa-xingxing.png",
        "scale": 45,
        "position": [1280, 260],
        "opacity": 90,
        "blend": "normal"
      },
      "ui_hint": "V3 的 8s 处叠加撒星星，右上角，避开人脸与字幕；没有素材就停下来问用户"
    }
  ]
}
```

字段到命令的对应：

| action plan 字段 | 引擎命令 / 参数 | 说明 |
|---|---|---|
| `action: "timeline.place"` | `file.import` → `timeline.place`；或 `graphics.newFromFile` | 贴纸是素材文件，先导入再放置 |
| `params.asset_path` | `file.import.params.paths` / `graphics.newFromFile.params.path` | 路径必须在工作区内；没有文件就停 |
| `target.track` | `timeline.place.params.track` | 贴纸放 V2/V3 等上层视频轨；不要占用主轨 |
| `at.seconds` / `duration.seconds` | `time`/`seconds` 或 `timeline.place` 的 `seconds` | 时间单位不要混用 |
| `params.scale` / `position` | `graphics.set` 的 `props.scale` / `props.position` | `graphics.newFromFile` 后拿 clip id 再调 |
| `params.opacity` | `graphics.set` 的 `props.opacity` | 0–100，不是 0–1 |
| 贴纸入场/出场 | `effects.toggleAnimation` + `effects.setKeyframe` | 近似；目录里的 video_animations 只作风格参考 |
| 没有 PNG，只有形状 | `graphics.newShape` / `graphics.newRectangle` 等 | 内置矢量形状，不是剪映贴纸 |

执行顺序（MCP）：

1. 确认用户已提供贴纸文件；没有就停，报告需要的风格（如「撒星星」）。
2. `file.import {"paths":["assets/stickers/sa-xingxing.png"]}` 拿 item id。
3. `graphics.newFromFile {"path":"assets/stickers/sa-xingxing.png","time":<ticks>,"track":2}`；
   或 `timeline.place {"item":<id>,"track":"V3","seconds":8.0}`。
4. `graphics.set {"clip":"<sticker clip id>","props":{"scale":45,"position":[1280,260],"opacity":90}}`。
5. `sequence.inspect` 确认贴纸在 V3、时间正确；`render_frame` 看是否挡脸/出安全区。

## 5. 执行前检查

- **素材来源**：只引用本机已有的贴纸文件；`resource_id` 只用于选型/报告。
  用户没下载时，先让用户下载或换一个已有贴纸。
- **VIP**：video_scene_effects 里 462 条 VIP；贴纸语义条目本身多是免费，但同风格条目可能收费。
- **层级**：贴纸必须在主体上层（V2+），且不要遮挡字幕（字幕通常在 C1，画面上方）。
- **安全区**：`render_frame` 检查四边；边框类贴纸要留 3–5% 边距。
- **动画成本**：逐帧序列贴纸很重；优先用 PNG + 关键帧缩放/透明度。

## 6. 失败处理

| 现象 | 动作 |
|---|---|
| 没有贴纸文件 | 停止该 action，报告 `resource_name` + 需要的风格，请用户提供/下载 |
| `file.import` 报路径不存在 | 报告工作区相对路径；不要用网络 URL 冒充本地文件 |
| 贴纸挡住人脸/字幕 | 调 `position`/`scale`/`opacity`；不要删主体或字幕 |
| 贴纸边缘有白底 | 说明素材不是透明 PNG；让用户换带 alpha 的文件，不要用混合模式硬救 |
| 只有特效条目没有贴纸 | 明确说"这是特效不是贴纸"；需要贴纸就回到采集/下载 |
| 动画不自然 | 减少关键帧、加缓动；不要逐帧手写 |

## 7. 禁止

- 不要把 `video_scene_effects` 的编号当贴纸编号写进 `resource_id` 并声称贴纸已加。
- 不要用 `graphics.newShape` 画一个星星就说是「撒星星」贴纸；形状和素材是两回事。
- 不要在没有透明 PNG 时用白色背景图硬叠。
- 不要让贴纸压住字幕或人物眼睛。

## 本地贴纸目录（`catalogs/local-stickers.json`）

本机剪映的 `User Data/Cache/effect` 里，`config.json` 的 `effect.Link[].type` 为 `InfoSticker` 的目录
就是已下载/占位的贴纸资源，目录名即 `resource_id`。插件仓的 `catalogs/local-stickers.json` 由这些
id 生成：

- 字段：`name`（本地标签「本地贴纸 NN」）、`resource_id`/`effect_id`、`package_kb`、`name_available`;
- **官方显示名与素材在服务端**，本机缓存里通常没有名称、甚至只有 0KB 占位。因此该目录只能保证
  「编号存在」，不保证画面能离线显示；渲染依赖宿主在打开草稿时按 id 拉取资源。
- 写 plan 时用贴纸轨：

```json
{"type":"sticker","name":"贴纸","segments":[
  {"start_us":1500000,"duration_us":2000000,
   "sticker_id":"7231835412396773944","resource_id":"7231835412396773944",
   "x":0.28,"y":-0.30,"scale":0.8}
]}
```

- 在剪映里打开草稿后若贴纸空白，说明该 id 的资源没有下载：先在剪映里下载一次该贴纸，再重建草稿；
- 不要给贴纸编造官方名称：目录里标 `name_available: false`，技能输出里写「本地贴纸 NN」并注明编号。