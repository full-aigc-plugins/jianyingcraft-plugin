---
name: jianyingcraft-resource-audio
description: 剪映音效/音色/声音成曲资源技能。写 action plan 时查真实音频资源编号（8bit、低保真、大叔、萝莉…），区分"可放置的音频文件"与"挂在片段上的音频处理"。当用户说"加音效""变声""换音色""要电音/电话音/8bit"时使用。
license: Apache-2.0
---

# 音频资源（jianyingcraft-resource-audio）

## 0. 最重要的一条：这些不是"音效文件"

`audio_scene_effects.json`、`tone_effects.json`、`speech_to_songs.json` 里的条目是
**音频处理效果**（变声/音色/歌声转换），要挂在**已有音频片段**上，不是可以直接拖到时间线的
`whoosh.mp3`。两类动作必须分开：

| 需求 | 动作 | 命令 |
|---|---|---|
| 给旁白做 8bit/电话音/水下 | 音频处理 | `effects.apply`（音频效果）或 `mixer.addInsert` |
| 在 4.2s 放一个「叮」的音效文件 | 放置音频素材 | 先 `file.import`，再 `timeline.place` |
| 把整段人声统一成"大叔"音色 | 音色替换 | `effects.apply` / 宿主侧 `jianying resource apply` |
| 把说话变成唱歌 | 声音成曲 | 宿主侧资源流程；可见引擎没有对应内置命令 |

> 目录里没有「音效素材库」的编号。需要可放置的音效文件时，让用户提供本地文件；
> 不要拿 `audio_scene_effects` 的编号硬塞 `timeline.place`。

## 1. 目录与字段

| 文件 | 内容 | 条数 | VIP |
|---|---|---:|---:|
| `catalogs/audio_scene_effects.json` | 场景音效/变声 | 85 | 73 |
| `catalogs/tone_effects.json` | 音色 | 57 | 43 |
| `catalogs/speech_to_songs.json` | 声音成曲 | 6 | 4 |

| 字段 | 含义 |
|---|---|
| `name` | 剪映界面显示名，如「8bit」「水下」「大叔」 |
| `resource_id` | **剪映资源编号**，action plan 引用它 |
| `effect_id` | 剪映内部效果 id；与 `resource_id` 一起落盘 |
| `vip` | 是否会员素材；场景音效 73/85 是 VIP |
| `md5` | 资源文件摘要，用于核对本机资源 |
| `params` | 可调参数（音高/音色/强度/混响等），每项含 `default`/`min`/`max` |
| `duration_us` | 本目录没有该字段；音频处理跟随所挂片段的时长 |

## 2. 使用场景表

| 场景 | 什么片子/镜头 | 推荐条目（真实 name） | 参数建议 | 注意 |
|---|---|---|---|---|
| 游戏/科技评测 | 像素风、复古游戏、硬件开箱 | 8bit | 音高 0.5–0.7、音色 1.0、强度 0.7–0.9 | 旁白可懂度优先，别拉满 |
| 复古回忆/老物件 | 胶片、旧照片、年代叙事 | 黑胶 / 低保真 | 强度 0.5–0.7 | 底噪会累积，分段用 |
| 电话/对讲/监控 | 悬疑、刑侦、远程通话 | 对讲机 / 老式电话（VIP） | 强度 0.6–0.8 | VIP 需权益；无权益用扩音器近似 |
| 水下/梦境 | 泳池、潜水、主观幻觉 | 水下 | 强度 0.5–0.7 | 低频闷，别盖住关键信息 |
| 广播/解说/广告 | 商场、电台、广告口播 | 广播 / 超市广播（VIP） | 强度 0.6 | 空间感强，适合画外音 |
| 电音/派对/夜店 | 蹦迪、灯光、快剪 | 电音 / 合成器 | 强度 0.5–0.8 | 与 ktv灯光 特效搭配 |
| 空灵/山洞/环境 | 洞穴、教堂、空镜 | 环绕音 / 山洞（VIP） | 强度 0.4–0.6 | 混响长，镜头切换要留尾 |
| 角色配音 | 动画、短剧、搞笑解说 | 台湾小哥 / 大叔 / 萝莉 | 强度 0.7–0.9 | 先确认角色设定，再选音色 |
| 电量耗尽/故障 | 机器人、设备失灵、故障转场 | 没电了 | 强度 0.6–0.8 | 配「故障」转场更统一 |
| 唱歌/音乐化 | 口播变唱、音乐短剧 | 民谣 / 嘻哈（VIP） | 按资源默认 | 可见引擎无内置歌声转换，需宿主侧流程 |

## 3. 常见编号清单（20 条）

| 名称 | resource_id | 是否会员 | 目录 |
|---|---|---|---|
| 8bit | `7161319747584266766` | 免费 | audio_scene_effects |
| 低保真 | `7024390914537689614` | 免费 | audio_scene_effects |
| 合成器 | `7018011500577034759` | 免费 | audio_scene_effects |
| 回音 | `7018011608408396325` | 免费 | audio_scene_effects |
| 扩音器 | `7018011975514853924` | 免费 | audio_scene_effects |
| 水下 | `7106404450444513806` | 免费 | audio_scene_effects |
| 没电了 | `7018012193769656845` | 免费 | audio_scene_effects |
| 环绕音 | `7161319847819743780` | 免费 | audio_scene_effects |
| 电音 | `7018011438379700773` | 免费 | audio_scene_effects |
| 颤音 | `7018011370289369637` | 免费 | audio_scene_effects |
| 麦霸 | `7018012141332468260` | 免费 | audio_scene_effects |
| 黑胶 | `7024391411764040205` | 免费 | audio_scene_effects |
| 广播 | `7418519152467382794` | VIP | audio_scene_effects |
| 超市广播 | `7431088660709118514` | VIP | audio_scene_effects |
| 对讲机 | `7350214704284832275` | VIP | audio_scene_effects |
| 山洞 | `7392070412865114659` | VIP | audio_scene_effects |
| 台湾小哥 | `7255565276819755576` | 免费 | tone_effects |
| 大叔 | `7020344898033291790` | 免费 | tone_effects |
| 萝莉 | `7020345789599715848` | 免费 | tone_effects |
| 民谣 | `7251868698170888759` | 免费 | speech_to_songs |

> 完整清单用 `node catalogs/query.mjs audio_scene_effects --limit 0`，
> 音色用 `tone_effects`，声音成曲用 `speech_to_songs`。
> **不要凭记忆编造编号**；`params` 的名字也要现查，不要自己发明参数名。

## 4. action plan 用法

### 4a. 给已有音频片段加处理（目录里的绝大多数条目）

```json
{
  "schema": "jianyingcraft-action-plan/v1",
  "meta": {"plan_id": "demo-audio", "title": "川西三日 · 音效", "fps": 30},
  "actions": [
    {
      "id": "a06",
      "action": "effects.apply",
      "target": {"clip": "vo-01", "track": "A1", "kind": "audio"},
      "resource_id": "7161319747584266766",
      "resource_name": "8bit",
      "at": {"seconds": 4.3},
      "duration": {"seconds": 0.6},
      "params": {
        "change_voice_param_pitch_shift": 0.6,
        "change_voice_param_timbre": 1.0,
        "change_voice_param_strength": 0.8,
        "engine_effect": "<effects.list kind=Audio 返回的真实效果名>"
      },
      "ui_hint": "把 A1 旁白 4.3s 处切成独立片段再做 8bit；只处理这一句，不要全片"
    }
  ]
}
```

### 4b. 放置一个音频文件（不是目录条目）

```json
{
  "id": "a06b",
  "action": "timeline.place",
  "target": {"track": "A2", "kind": "audio-file"},
  "resource_id": null,
  "resource_name": "本地音效 whoosh.wav",
  "at": {"seconds": 4.2},
  "duration": {"seconds": 0.8},
  "params": {"path": "assets/sfx/whoosh.wav", "gain_db": -6, "fade_in": 0.05, "fade_out": 0.15},
  "ui_hint": "在 A2 的 4.2s 放 whoosh，不要让 A1 旁白闪避"
}
```

字段到命令的对应：

| action plan 字段 | 引擎命令 / 参数 | 说明 |
|---|---|---|
| `action: "effects.apply"`（音频处理） | `effects.apply` | 先 `effects.list {"kind":"Audio"}` 取引擎效果名 |
| `resource_id` / `params` | `effects.apply` + `effects.setParam` | 参数名必须来自目录 `params`，值在 `min..max` |
| `target.track` | 轨道名/轨道 id | 音频轨必须存在；先用 `sequence.inspect` 看真实轨道 |
| `action: "timeline.place"`（音频文件） | `file.import` → `timeline.place` | `timeline.place` 的 `track` 用 `A1`/`A2` 或轨道 id |
| `at.seconds` | `timeline.place.params.seconds` | 三种时间单位不要混用 |
| `params.path` | `file.import.params.paths` | 路径必须在工作区内 |
| 轨道级效果 | `mixer.addInsert` | 整条 A1 都要处理时用，不要逐片段重复 |
| 对白/音乐类型 | `essentialSound.applyPreset` | 只是响度/类型预设，不等于剪映音效 |

执行顺序（MCP）：

1. `sequence.inspect` 找 `vo-01` 与 A1/A2 的真实 id；没有音频轨先建轨。
2. `effects.list {"kind": "Audio", "detail": true}` 找与 `engine_effect` 对应的真实名字。
3. 音频处理：`command_run {"id":"effects.apply","params":{"clips":["vo-01"],"effect":"<真实名字>"}}`。
4. 改参数：`command_run {"id":"effects.setParam","params":{"clip":"vo-01","effect":"<名字或索引>","param":"<目录参数名>","value":0.6}}`。
5. 放置文件：`file.import` 拿 item id → `timeline.place {"item":..., "track":"A2", "audioTrack":"A2", "seconds":4.2}`。
6. `sequence.inspect` 确认音频条目在正确轨道、时间正确；试听/看波形。

精确绑定剪映编号（可选，宿主侧）：

```bash
jianying resource apply <draft> <segment-id> "8bit" --kind audio_effect --json
```

## 5. 执行前检查

- **只引用本机已下载的资源编号**：音色/音效包没下载时，`resource_id` 只是选型键。
  未下载先让用户下载；不要假装已经变声。
- **VIP**：场景音效 73/85 是 VIP；没有权益就换免费条目（如 8bit、低保真、合成器）。
- **参数范围**：只传目录 `params` 里出现的名字，值必须在 `min..max`；
  传 `pitch` 这种自造名字会被引擎拒绝。
- **可懂度**：变声后必须回听关键词；8bit 音高拉太低会听不清数字和人名。
- **增益**：处理后整体响度会变，必要时用 `mixer.setValue` 或 `clip.audioGain` 校正，不要靠感觉。

## 6. 失败处理

| 现象 | 动作 |
|---|---|
| `effects.apply` 报 "no such effect" | 重新 `effects.list {"kind":"Audio"}`；用返回名字，不要继续猜 |
| 参数报 "no such param" | 回目录查 `params[].name`；不要翻译成英文再猜 |
| `timeline.place` 报轨道不存在 | `sequence.inspect` 看真实轨道名；不要默认 A2 存在 |
| 变声后听不清 | 降强度/提高音高；贴回听结论，不要只说"已处理" |
| 只有 VIP 条目符合设定 | 停在该 action，报告需权益或换免费近似 |
| 声音成曲无法在可见引擎执行 | 明确说"可见引擎无此命令"，不要伪造结果 |

## 7. 禁止

- 不要把 `audio_scene_effects` 的编号当音效文件塞进 `timeline.place`。
- 不要用 `effect_id` 代替 `resource_id`。
- 不要全片套同一个变声；按镜头/角色分段。
- 不要在没有回听的情况下宣称"音效已加好"。
