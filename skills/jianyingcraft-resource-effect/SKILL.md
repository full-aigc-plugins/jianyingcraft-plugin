---
name: jianyingcraft-resource-effect
description: 剪映画面特效与人物特效资源技能。写 action plan 时查真实特效编号（丁达尔光线、下雨、五彩纸屑、动感爱心…），再映射到 JianyingCraft 的 effects 命令。当用户说"加特效""要光线/下雨/粒子/漫画分屏/人物光环"时使用。
license: Apache-2.0
---

# 特效资源（jianyingcraft-resource-effect）

## 0. 特效是"效果层"，不是素材

`video_scene_effects`（1097 条）与 `video_character_effects`（240 条）都是**效果**：
挂在片段/画面上，由引擎渲染，不需要用户额外下载视频文件。但它们同样有前提：

- 可见编辑器只认**自己的效果名**；剪映的 `resource_id` 不能直接传给 `effects.apply`。
- 先 `effects.list` 查真实效果名，再决定「同名/近似/做不到」。
- 人物特效需要人物主体；没有人物时不要硬套。

## 1. 目录与字段

| 文件 | 内容 | 条数 | VIP |
|---|---|---:|---:|
| `catalogs/video_scene_effects.json` | 画面特效（氛围、边框、分屏、粒子、贴纸语义） | 1097 | 462 |
| `catalogs/video_character_effects.json` | 人物特效（光环、表情、变身、分身） | 240 | 81 |

| 字段 | 含义 |
|---|---|
| `name` | 剪映界面显示名，如「丁达尔光线」「下雨」「动感爱心」 |
| `resource_id` | **剪映资源编号**，action plan 引用它 |
| `effect_id` | 剪映内部效果 id；与 `resource_id` 一起落盘 |
| `vip` | 是否会员素材 |
| `md5` | 资源文件摘要 |
| `params` | 可调参数（强度、速度、颜色、大小等），含 `default`/`min`/`max` |
| `duration_us` | 本目录通常没有该字段；特效跟随所挂片段的时长 |

## 2. 使用场景表

| 场景 | 什么片子/镜头 | 推荐条目（真实 name） | 参数建议 | 注意 |
|---|---|---|---|---|
| 森林/晨雾空镜 | 自然、旅行、治愈 | 丁达尔光线 | 强度 45–65 | 别盖住人物面部 |
| 雨天/情绪段落 | 失恋、离别、城市夜雨 | 下雨 | 强度 40–60 | 雨丝方向要与镜头运动一致 |
| 庆祝/婚礼/撒花 | 婚礼、生日、夺冠 | 五彩纸屑 | 强度 50–70 | 粒子别糊住主体 |
| 漫画分镜 | 搞笑、解说、二次元 | 三格漫画 / 三屏 / 九屏 | 默认 | 分屏后每格信息要少 |
| 复古 DV/CCD | 千禧风、怀旧、旅拍 | DV录制框 / CCD闪光 | 强度 40–60 | 边框会裁画面，先构图 |
| 万圣/节日 | 万圣节、派对、搞怪 | 万圣夜 | 强度 50–70 | 节日限定 |
| 空镜转场 | 荒凉、悬疑、时间流逝 | 乌鸦飞过 | 强度 50 | 配「故障」转场更阴 |
| 夜店/舞台 | 蹦迪、演唱会、灯光 | ktv灯光 | 强度 45–65 | 频闪敏感人群慎用 |
| 人物反应/情绪 | 短剧、综艺、吐槽 | 动感爱心 / 大头 / 天使环 / 小恶魔 | 强度 40–60 | 需要人脸/人物主体 |
| 声音可视化 | 音乐、播客、声波题材 | 声波 | 强度 40–60 | 与音频节拍对齐 |
| 分身/残影 | 动作、舞蹈、运动 | 分身 | 速度 0.3–0.5 | 背景干净才不糊 |
| 圣诞/年末 | 节日祝福、商场 | 圣诞帽 | 默认 | 需要人头位置 |

## 3. 常见编号清单（20 条）

| 名称 | resource_id | 是否会员 | 目录 |
|---|---|---|---|
| 丁达尔光线 | `6834008866137575950` | 免费 | video_scene_effects |
| 下雨 | `6734619419890160131` | 免费 | video_scene_effects |
| 五彩纸屑 | `7055567263029531143` | 免费 | video_scene_effects |
| 三格漫画 | `6795825532668744206` | 免费 | video_scene_effects |
| CCD闪光 | `7130585796020539941` | 免费 | video_scene_effects |
| DV录制框 | `6878115805498708493` | 免费 | video_scene_effects |
| 万圣夜 | `6888280327949652493` | 免费 | video_scene_effects |
| 乌鸦飞过 | `6955028776094798366` | 免费 | video_scene_effects |
| 九屏 | `6719657094741496333` | 免费 | video_scene_effects |
| 两屏 | `6706773500796867075` | 免费 | video_scene_effects |
| ktv灯光 | `6771299914891661832` | 免费 | video_scene_effects |
| 三屏 | `6706773500209664515` | 免费 | video_scene_effects |
| 动感爱心 | `6998039666024780318` | 免费 | video_character_effects |
| 大头 | `6986556887818834462` | 免费 | video_character_effects |
| 天使环 | `7019228748775952933` | 免费 | video_character_effects |
| 小恶魔 | `6995534946311868958` | 免费 | video_character_effects |
| 声波 | `7008055446397260319` | 免费 | video_character_effects |
| 分身 | `7194734735434715704` | 免费 | video_character_effects |
| 光环 I | `6999584193848021535` | 免费 | video_character_effects |
| 圣诞帽 | `7034784053609894430` | 免费 | video_character_effects |

> 完整清单用 `node catalogs/query.mjs video_scene_effects --limit 0` 与
> `node catalogs/query.mjs video_character_effects --limit 0`。
> **不要凭记忆编造编号**；同名的 `光环 I` / `光环 II`、`三屏` / `九屏` 必须现查。

## 4. action plan 用法

```json
{
  "schema": "jianyingcraft-action-plan/v1",
  "meta": {"plan_id": "demo-effect", "title": "川西三日 · 特效", "fps": 30},
  "actions": [
    {
      "id": "a05b",
      "action": "effects.apply",
      "target": {"clips": ["shot-01", "shot-02"], "kind": "video"},
      "resource_id": "6834008866137575950",
      "resource_name": "丁达尔光线",
      "at": {"seconds": 0},
      "duration": {"seconds": 6.0},
      "params": {
        "intensity": 55,
        "engine_effect": "<effects.list kind=Video 返回的真实效果名>",
        "seed": 3
      },
      "ui_hint": "森林空镜加强光束，强度 55；人物入画后降到 40 以下"
    }
  ]
}
```

字段到命令的对应：

| action plan 字段 | 引擎命令 / 参数 | 说明 |
|---|---|---|
| `action: "effects.apply"` | `effects.apply` | 先 `effects.list {"kind":"Video","detail":true}` 查真实效果名 |
| `target.clips` | `params.clips` | 不传则作用于当前选中片段；批量要显式列 id |
| `params.engine_effect` | `params.effect` | 引擎效果名，不是剪映 `resource_id` |
| `params.intensity` 等 | `effects.setParam` | 参数名必须来自目录 `params` 或 `effects.list --detail` |
| `at` / `duration` | 片段边界 + `sequence.inspect` | 特效跟随片段；不要假设任意时间点能加 |
| 人物特效 | `effects.apply`（若有对应效果） | 需要人物主体；没有就说明做不到 |
| 移除/重置 | `effects.remove` / `effects.reset` | 换效果前先移除，避免叠三层 |

执行顺序（MCP）：

1. `effects.list {"kind": "Video", "detail": true}` 找与 `resource_name` 对应的真实效果；
   人物特效再查 `kind: "Video"` 下的角色类效果。
2. `command_run {"id":"effects.apply","params":{"clips":["shot-01"],"effect":"<真实名字>"}}`。
3. 改参数：`effects.setParam {"clip":"shot-01","effect":"<名字或索引>","param":"<目录参数名>","value":55}`。
4. 需要动画：`effects.toggleAnimation` + `effects.setKeyframe`；不要逐帧手写。
5. `sequence.inspect` 确认效果挂在正确片段；`render_frame` 看强度/遮挡。

精确绑定剪映编号（可选，宿主侧）：

```bash
jianying timeline add-effect <draft> --slug "丁达尔光线" --resource-id 6834008866137575950 \
  --start 0 --duration 6000000 --jianying
```

## 5. 执行前检查

- **只引用本机已下载/可用的资源编号**：特效包没下载时，编号只是选型键；
  先让用户下载，不要用编号假装渲染成功。
- **VIP**：画面特效 462 条、人物特效 81 条是 VIP；没有权益就换免费条目。
- **引擎效果名**：`engine_effect` 必须出现在 `effects.list` 结果里；没有就退到近似效果并标注。
- **人物主体**：人物特效要求画面里有人脸/人体；空镜、手部特写不要用「大头」「圣诞帽」。
- **强度与遮挡**：粒子/光线类先看 `render_frame`，别盖住字幕和主体眼睛。
- **频闪**：ktv灯光/CCD闪光含频闪，敏感内容慎用；必要时降强度或换条目。

## 6. 失败处理

| 现象 | 动作 |
|---|---|
| `effects.apply` 报 "no such effect" | 重新 `effects.list`；用返回名，不要猜 |
| 参数报 "no such param" | 回目录查 `params[].name`；不要翻译成英文再猜 |
| 效果不显示 | `sequence.inspect` 看是否挂到片段；确认片段不是纯音频 |
| 人物特效无主体 | 报告"该镜头没有可用人物主体"，换特效或跳过 |
| 只有 VIP 条目符合 | 停在该 action，报告需权益或换免费近似 |
| 预览一闪一闪 | 降低强度/换低频闪条目；不要导出后再看 |

## 7. 禁止

- 不要把 `resource_id` 直接塞进 `effects.apply` 的 `effect` 字段。
- 不要在一段素材上叠三个以上特效；先移除再换。
- 不要用「分身」「大头」处理没有人物主体的镜头。
- 不要声称"加了丁达尔光线"而实际只加了高斯模糊；近似要写明。
