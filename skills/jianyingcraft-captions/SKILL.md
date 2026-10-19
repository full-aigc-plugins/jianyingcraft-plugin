---
name: jianyingcraft-captions
description: 给时间轴上的口播/对白加字幕：导入 SRT/VTT、建字幕轨、逐条校时与改文案、统一样式、导出字幕文件。当用户说"加字幕""导入字幕""校对时间轴字幕""导出 SRT"时使用。
license: Apache-2.0
---

# 智能字幕（JianyingCraft）

两条来源：**引擎内转写**（`transcript.*`，Whisper 本地推理）或**外部 SRT/VTT**。
先看 `transcript.models` 有没有可用模型——没有模型时不要假装能识别，走导入路径。

## 0. 命令核对（先做，缺命令就停）

```
command_list {"filter": "captions"}
command_list {"filter": "transcript"}
```

必须包含 `captions.import`、`captions.newTrack`、`captions.list`、`captions.setTimes`、
`captions.setStyle`、`captions.export`，以及转写路径要用的 `transcript.generate`、
`transcript.inspect`、`transcript.createCaptions`。
缺任何一个：停止并报告"引擎版本与技能不匹配"，不要用相近命令替代。

## 1a. 引擎内转写（首选）

```
transcript.models                                  # 先看有没有可用模型
transcript.downloadModel {"model": "whisper-base"} # 没模型时才下载
transcript.generate {"language": "zh", "diarize": true}
transcript.inspect                                 # 核对词数/说话人/语言
```

- `generate` 只负责产出转写，**不会自动上字幕轨**；上轨用下一步。
- 长素材分段跑，保留每段结果；失败时报告已完成的区间，不重跑全部。
- 说话人分离（`diarize`）只对人声有效的素材有意义，音乐/环境音不必开。

## 1b. 外部字幕导入（两条路，按已有材料选）

**已有 SRT/VTT**（大多数情况）：

```
captions.import {"path": "subs/ep01.srt"}   # UTF-8，SRT 或 VTT
```

**已有带时间码的转写 JSON**（别的工具导出的词级结果）：

```
transcript.set {"item": 11, "transcript": {"language": "zh",
  "speakers": [{"name": "Speaker 1"}],
  "words": [{"text": "剪映式", "start": 0, "end": 203212800000, "speaker": 0}]}}
transcript.inspect    # 先确认 words 数与段落切分，再上轨
```

`item` 是**工程面板里的媒体项 id**（不是时间轴片段 id）；`start`/`end` 用 tick
（1 s = 254 016 000 000 tick）。这条路不碰模型，属于"导入"，不要说成识别。

## 2. 上轨

```
transcript.createCaptions {"lines": 2, "maxChars": 18}   # 转写结果 → 字幕轨
# 或已有字幕轨时
captions.newTrack
captions.list
```

**断言**：`captions.list` 的条数 > 0，且与 `transcript.inspect` 的段落数量级一致。
差太多说明切分参数不合适，调 `maxChars` / `maxSeconds` 再生成，不要手工补齐。

## 3. 校对（逐条，不整段重写）

- 选中一条：`captions.select`（`index` 或 `id`，以 `command_list` 的参数文档为准）。
- 改文案：`captions.setText`；改时间：`captions.setTimes`（起点/终点都用秒或 `Tick`，不要混用）。
- 拆分/合并：`captions.split` / `captions.merge`；删除：`captions.delete`。
- 每次批量修改后重新 `captions.list` 核对条数与首末条时间。

## 4. 样式

`captions.setStyle`：字号、颜色、描边、位置。**整轨一次设置**，不要逐条设，
否则滚动时字号会跳。设置后 `render_frame`（取一条字幕所在时间点）确认可读、不出安全区。

## 5. 导出与交付

```
command_run {"id": "captions.export", "params": {"path": "subs/ep01.out.srt"}}
```

交付前核对：导出文件行数 == `captions.list` 条数；首条起点 ≥ 0；末条终点 ≤ 序列时长。

## 失败处理

| 现象 | 动作 |
|---|---|
| `transcript.models` 为空且下载失败 | 退回外部 SRT 路径（`captions.import`），并说明"未做引擎内识别" |
| `transcript.generate` 超时 | 按 60 s 分段重试，保留已完成区间，报告不完整 |
| 音频无人声/静音 | 报告中位响度，建议确认素材，不生成空字幕轨 |
| `captions.import` 报路径错误 | 确认文件在工作区内且是 UTF-8；不要改扩展名冒充 SRT |
| 条数与 cue 数不符 | 报告两侧数字与首个差异条，不自动补齐 |
| `setTimes` 报时间越界 | 报告"需要多少/序列只有多少"，不裁剪用户文案 |
| 样式命令 disabled | 报告 disabled 原文（通常是没选中字幕轨） |

## 禁止

- 只在**真的执行过** `transcript.generate` 时才说"做了语音识别"；用导入路径就要说明来源是外部转写。
- 不覆盖用户已有字幕轨（需要替换时先显式确认）。
- 不把 `render_frame` 截图当作字幕文件交付。
