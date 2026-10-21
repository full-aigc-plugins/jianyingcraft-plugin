# catalogs/ —— 剪映官方资源编号目录

本目录是**资源编号索引**，不是素材本体：只保存「编号 → 名称 → 是否会员 → 参数/时长」，
供智能体在写 action plan（剧本）时查真实资源编号。素材文件不随插件分发。

## 来源与许可

| 项 | 值 |
|---|---|
| 上游项目 | [pyJianYingDraft](https://github.com/GuanYixuan/pyJianYingDraft) |
| 上游快照 | `6bb2d06a713f7b58e1375269daec835a03882086`（2026-09-26T17:04:37+08:00） |
| 许可 | Apache-2.0 |
| 本地位置 | `catalogs/*.json`（由 `jianying-cli/catalogs` 原样复制） |
| 校验 | `catalogs/index.json` 保留每个文件的 `count` / `vip` / `sha256` |

> **资源编号仅用于匹配用户本机已下载的官方资源，不随包分发素材本体。**
> 编号能告诉 Agent「用哪一个」，不能替代用户自己的剪映客户端/素材库；
> 未在本机下载的资源，先让用户下载，再执行 action。

`capcut/` 子目录没有复制进来：本插件只面向剪映（Jianying）资源，CapCut 目录不参与匹配。

## 文件清单

| 文件 | 内容 | 条数 | 其中 VIP | 对应技能 |
|---|---|---:|---:|---|
| `audio_scene_effects.json` | 场景音效/变声 | 85 | 73 | `jianyingcraft-resource-audio` |
| `tone_effects.json` | 音色 | 57 | 43 | `jianyingcraft-resource-audio` |
| `speech_to_songs.json` | 声音成曲 | 6 | 4 | `jianyingcraft-resource-audio` |
| `text_animations_in.json` | 文本入场动画 | 145 | 78 | `jianyingcraft-resource-text` / `-caption` |
| `text_animations_out.json` | 文本出场动画 | 97 | 46 | `jianyingcraft-resource-text` / `-caption` |
| `text_animations_loop.json` | 文本循环动画 | 93 | 52 | `jianyingcraft-resource-text` / `-caption` |
| `fonts.json` | 字体 | 798 | 318 | `jianyingcraft-resource-text` / `-caption` |
| `video_scene_effects.json` | 画面特效（含贴纸语义条目） | 1097 | 462 | `jianyingcraft-resource-effect` / `-sticker` |
| `video_character_effects.json` | 人物特效 | 240 | 81 | `jianyingcraft-resource-effect` |
| `video_animations_in.json` | 视频入场动画 | 155 | 117 | `jianyingcraft-resource-sticker`（仅动画语义） |
| `video_animations_out.json` | 视频出场动画 | 124 | 103 | `jianyingcraft-resource-sticker`（仅动画语义） |
| `video_animations_group.json` | 视频组合动画 | 123 | 16 | `jianyingcraft-resource-sticker`（仅动画语义） |
| `transitions.json` | 转场 | 453 | 323 | `jianyingcraft-resource-transition` |
| `filters.json` | 滤镜 | 1052 | 802 | `jianyingcraft-resource-filter` |
| `masks.json` | 蒙版 | 6 | 0 | 供 `effects`/遮罩类 action 参考 |
| `mix_modes.json` | 混合模式 | 10 | 0 | 供 `effects`/图层类 action 参考 |
| `index.json` | 目录索引与 sha256 | — | — | 所有技能/测试 |

合计 16 个资源目录、4541 条条目。

## 字段含义

各目录的公共字段：

| 字段 | 类型 | 含义 |
|---|---|---|
| `name` | string | 剪映界面显示名，也是人读的选型键；同一资源可能有多语言名 |
| `resource_id` | string | **剪映资源编号**（16 位以上数字串），action plan 里引用它 |
| `effect_id` | string | 剪映内部效果 id；落盘时与 `resource_id` 一起出现，二者不要混用 |
| `vip` | boolean | 是否会员素材；`true` 需要用户有对应权益 |
| `md5` | string | 资源文件摘要，用于校验本机资源是否同一份 |
| `params` | array | 可调参数；每项含 `name` / `default` / `min` / `max` |
| `duration_us` | number | 建议时长（微秒），仅动画/转场有 |
| `is_overlap` | boolean | 转场是否占用前后片段重叠时长，仅转场有 |
| `shape` | string | 蒙版形状，仅 `masks.json` 有 |
| `default_aspect` | number | 蒙版默认宽高比，仅 `masks.json` 有 |

> `duration_us` 是**建议值**，不是硬限制；实际时长还要受前后片段长度约束。
> 转场 `is_overlap=true` 时，前后片段要各自让出重叠时长。

## 查询

```bash
# 默认 20 条、表格输出
node catalogs/query.mjs transitions

# 按名称过滤（大小写不敏感的子串）
node catalogs/query.mjs transitions --query 3D --limit 3

# 只看免费素材
node catalogs/query.mjs filters --free --limit 50

# 给脚本/Agent 读的 JSON（原始条目数组）
node catalogs/query.mjs audio_scene_effects --query 8bit --json
```

- `<category>` 必须是 `index.json` 的键名；未知分类会列出可用分类并 `exit 1`。
- `--limit 0` 表示不限制；默认 20。
- 技能里只内嵌 20 条常见条目，**完整清单一律用 query.mjs 查，不要凭记忆编造编号**。

## 维护约定

1. 这些 JSON 是上游快照，**禁止手工编辑**；需要更新时整文件替换，并同步 `index.json` 的
   `count` / `vip` / `sha256`。
2. `ui/tests/catalogs.test.mjs` 会校验：JSON 可解析、条目字段完整、编号唯一、
   `index.json` 的 count 与文件长度一致、sha256 一致（若提供）。
3. `fonts.json` 存在一个**已知同编号别名**：`6766524209620324877` 同时对应
   「子どもたち」与「玩童体」（同一 `md5`，同字体不同语言名）。测试对这个例外做了显式白名单，
   其余目录要求 `resource_id` 唯一。
