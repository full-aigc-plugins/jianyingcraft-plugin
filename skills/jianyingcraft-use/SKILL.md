---
name: jianyingcraft-use
description: JianyingCraft 统一入口。判断任务类型（剪辑/字幕/多轨/导出）并路由到对应能力；需要可见编辑器时交给 jianyingcraft-editor，需要成片套路时交给 jianyingcraft-scenario-playbooks，字幕与批量出片交给专门技能。
license: Apache-2.0
---

# JianyingCraft Use

JianyingCraft 是**独立剪辑软件**，工程格式为 `.fcproj`（派生自 FilmCraft），
不读写任何第三方私有草稿。本技能只做三件事：**判断任务类型 → 选择执行后端 → 交代可验证的交付物**。

## 先决定后端，再动手

| 任务形态 | 后端 | 说明 |
|---|---|---|
| 用户要看画面、改时间轴 | 可见引擎（面板内 WASM） | `command_run` 改的是用户看得见的那份工程 |
| 只要一份可编辑工程文件 | 可见引擎 + `file.saveAs` | 不接受覆盖已有文件 |
| 只有素材、要出成片 | 可见引擎（渲染）+ `file.exportMedia` | 导出后必须检查 `offlineMedia` |

**不要在没打开面板的情况下假装已经剪辑。** 面板未就绪时 `command_run` 会被拒绝，
这是有意的：用户看不到的修改等于没做。

## 执行顺序

1. `editor_status` 确认 `ready`；为 false 就先 `open_editor`（第一次必须给绝对工作区路径）。
2. `command_list` 取真实命令目录（165 条）。**不要凭记忆猜命令名。**
3. 准备工程：`file.newProject` 或 `file.open`；导入素材：`file.import`（工作区内路径）。
4. 放片段：`timeline.place {"item", "track", "audioTrack", "seconds"}`；切分：`timeline.razor`。
5. 每步用 `sequence.inspect` 核对结构，不只看工具返回成功。
6. `render_frame` 抽帧看画面——**工具成功不等于画面正确**。
7. `file.saveAs` 到工作区内的新路径，再 `file.open` 读回确认。

## 硬边界（引擎会拒绝，不要绕过）

- **轨道必须存在**：`timeline.place` 的 `track` 是轨道 id 或 `V1`/`A2` 这类名字，
  命名不存在的轨道是"invalid parameters"，不会自动换轨。
- **时间单位**：命令接受 `seconds` / `frame` / `timecode`，内部权威是 `Tick`
  （254 016 000 000/s）。不要混用单位，也不要用浮点秒做精确对齐。
- **离线素材**：导出会为缺失素材画占位帧，并在结果的 `offlineMedia` 里列出；
  交付前必须为空。
- **读不懂的结构进 gaps**：面板会原样列出，不要用猜测填补。

## 诚实汇报

- 没做过的动作不要说做过；没验证的画面不要用"应该没问题"描述。
- 预览帧（`render_frame`）不等于成片；成片必须有一次 `file.exportMedia` 成功且 `offlineMedia` 为空。
- 面板未就绪、命令 disabled、素材离线，都要把引擎原文错误贴出来。
