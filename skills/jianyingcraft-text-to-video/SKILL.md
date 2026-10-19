---
name: jianyingcraft-text-to-video
description: 文案转竖屏成片：合成配音、按句分镜、画面按句对齐、配字幕、导出 1080x1920。当用户说"图文成片""文案转视频""口播视频""一键成片"时使用。
license: Apache-2.0
---

# 图文成片（JianyingCraft）

输入一段文案（≤ 2000 字），输出一条竖屏成片。关键约束：**分镜时长由配音真实时长决定**，
不是估算值。

## 0. 命令核对

```
command_list {"filter": "tts"}
command_list {"filter": "timeline"}
command_list {"filter": "export"}
```

必须包含：`file.newProject`、`file.import`、`tts.voices`、`tts.create`、`tts.render`、
`timeline.place`、`captions.import`、`file.exportMedia`、`sequence.inspect`。
缺任何一个：停止并报告，不用相近命令替代。

## 1. 建工程与素材

```
file.newProject
file.import {"paths": ["media/bg-01.mp4", "media/bg-02.mp4"]}
```

序列设为竖屏 1080×1920 / 30fps（用 `command_list {"filter":"sequence"}` 找到序列设置命令；
找不到就停下报告，**不导出横屏冒充竖屏**）。

## 2. 配音（先做，它是时长的唯一依据）

```
tts.voices                       # 选音色，返回可用列表
tts.create {"text": "<第 1 段文案>", "voice": "<id>"}
tts.render {"path": "audio/seg-01.wav"}   # 参数以 command_list 文档为准
```

逐段生成，记录每段真实时长（`tts.inspect` 或音频文件元数据）。**不要按字数估时长。**

## 3. 分镜与放置

按"每段配音 → 一个画面"循环：

```
playhead.set {"seconds": <该段起点>}
timeline.place {"item": <素材 id>, "track": "V1", "audioTrack": "A1", "seconds": <该段起点>}
```

- 画面时长 = 该段配音时长；不足时用 `clip.frameHold` 冻结或换更长的素材。
- 素材不够就循环使用，但相邻两段不要用同一素材（观感割裂）。
- 配音片段放在 A1，与画面同起点。

## 4. 字幕

把每段文案转成 SRT（复用第 2 段的起止时间），然后 `captions.import {"path": "subs/ttv.srt"}`。
不要对配音再做一次识别。

## 5. 自检（必须逐条断言）

```
sequence.inspect
```

- 视频轨片段数 == 分镜数；音频轨片段数 == 分镜数；
- 总时长与配音总时长误差 ≤ 1 帧；
- 字幕条数 == 分镜数；
- 序列宽高 == 1080×1920。

## 6. 导出

```
file.exportMedia {"path": "renders/ttv-<yyyymmdd-HHmm>.mp4", "wait": true}
```

导出结果 `offlineMedia` 必须为空；非空则先修素材，**不交付占位帧**。

## 失败处理

| 现象 | 动作 |
|---|---|
| `tts.voices` 为空 | 报告"未启用语音合成"，可降级为无声成片并在结果首行写明 |
| 单段配音 < 1s 或 > 60s | 拆分/合并该段文案后重试，最多 2 次 |
| `timeline.place` 报轨道不存在 | 先 `sequence.inspect` 看真实轨道名，不要猜 V1/A1 |
| 导出 `offlineMedia` 非空 | 停止并列出缺失文件，不重试掩盖 |

## 禁止

- 不把长文案塞进一个片段。
- 不用 `render_frame` 截图代替成片。
- 不在产物里留占位文案（"示例文本"/"TODO"）。
