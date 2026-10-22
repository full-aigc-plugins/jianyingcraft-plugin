---
name: jianyingcraft-shot-timeline
description: 把创意写成「短剧式分镜时间轴」：每镜一行，同时列出素材/滤镜/特效/文本/贴纸/音频/转场/字幕八类资源，再落成 jianying-cli 的 plan/v1 或面板 action。当用户要"更详细的分镜表/时间轴剧本/每个镜头用哪些素材和特效"时使用。
license: Apache-2.0
---

# 分镜时间轴（jianyingcraft-shot-timeline）

## 0. 为什么需要它

只写「时间 + 画面 + 字幕」会漏掉一半资源：滤镜、特效、贴纸、音效、花字动画都不会出现在表里，
最后成片与剧本对不上。本技能要求**每个镜头一行、八类资源同表**，先像短剧剧本一样写清楚，
再映射到 `jianying-cli-plan/v1`（或面板 action），保证「剧本 = 时间轴 = 草稿」。

## 1. 必填表头（一镜一行）

| # | 时间码 | 帧 | 镜头/画面 | 素材 | 滤镜（强度） | 特效 | 文本/花字（含动画） | 贴纸 | 音频 | 出转场 | 字幕 |
|---|---|---|---|---|---|---|---|---|---|---|---|

规则：

1. **时间码 + 帧** 都要写：`00:00:00` / `00:00:00` 起算的帧号范围（30fps 时 1 秒 = 30 帧）。
2. **素材** 写具体文件名（同一张图切两次时用独立文件，如 `cut-01`/`cut-02`，避免剪映合并素材）。
3. **滤镜** 必须带强度（0–100）与资源编号；**特效** 带编号；**转场** 带时长（≤1s）。
4. **文本/花字** 写内容 + 字体 + 入场/出场动画；**字幕** 写文案，并且与 SRT 完全一致。
5. **贴纸** 没有官方目录时也要写设计意图，并在执行状态表标 `planned`，**不得**在正文里假装已落盘。
6. 每镜后面补 2–4 句**导演笔记**：节拍、表演、声音、为什么用这个转场。

## 2. 资源编号从哪里来

- 转场 / 滤镜 / 特效 / 字体 / 文本动画：`catalogs/*.json`（插件仓）或 `jianying media catalog <kind>`；
- 只选本机已下载、`vip=false` 的条目；VIP 需 `allow_vip: true` 且用户已开通；
- 不要凭记忆写 19 位编号，查目录后复制。

## 3. 映射到 plan/v1

| 表列 | plan 字段 |
|---|---|
| 素材 | `tracks[video].segments[].source` |
| 滤镜 | `segments[].filters[{name,intensity}]` |
| 特效 | `segments[].effects[{name,params}]` |
| 出转场 | `segments[].transition_out{name,duration_us}` |
| 文本/花字 | `tracks[text].segments[]`（`text,font,size,x,y,color,animation_in/out`） |
| 贴纸 | `tracks[sticker].segments[]`（`sticker_id,resource_id`；无目录时不要写） |
| 音频 | `tracks[audio].segments[]`（BGM/音效分轨，`volume`,`fade`） |
| 字幕 | `--srt` 文件 + 字幕轨 |

## 4. 执行状态表（必须附）

| 类别 | 状态（executed/planned） | 落盘位置 |
|---|---|---|

只把真的写进草稿的标 `executed`；没目录/没权限的标 `planned` 并写原因。

## 5. 验证

```powershell
jianying project build plan.json --out draft --srt subs.srt --json
jianying project verify draft --json       # issues 必须为空
```

预览 `render proxy` 是近似（不渲染转场/特效/滤镜，图片轨可能只取首帧），不得拿预览当权威画面。
## 6. 参考示例

`examples/youth-timeline/`：12 镜、八类资源同表，附 script.md、	imeline.json、plan.json、subs.srt 与生成器。
