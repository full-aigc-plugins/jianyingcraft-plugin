---
name: jianyingcraft-editor
description: 在 Codex、ZCode、Kimi、Claude Code 里打开 JianyingCraft 可见编辑器面板，让 Agent 的剪辑动作实时显示给用户。需要"打开面板""打开编辑器""让我看着剪"时使用。
license: Apache-2.0
---

# JianyingCraft Editor

负责把可见编辑器打开并保持可用；所有剪辑动作都经 `command_run` 落到这份可见工程上。

## 打开面板

```
open_editor { workspace: "<绝对路径>" }
```

第一次必须给绝对工作区路径；打开后**工作区被锁定**，换工作区必须先保存并关闭实例。
返回值里的 `ready` 表示面板是否已连上，为 false 时命令调用会失败。

## 两个 URL 的区别

- `editorUrl`：宿主内嵌面板（ZCode / Codex MCP Apps）。这是"用户看得见"的那条路径。
- `open_browser_editor`：把同一会话交给宿主内置浏览器。**能用不等于内嵌面板验收通过**，
  对外汇报必须说清楚是在哪个界面验证的。

## 命令面

1. `command_list` 取目录（165 条），不要凭记忆猜。
2. `command_run {"id", "params"}` 执行；批量用 `command_batch`（按顺序，遇错停）。
3. 读状态：`sequence.inspect`（轨道/片段/选区）、`project.inspect`（工程树）。
4. 看画面：`render_frame {"seconds"}` 抽帧，或 `screenshot` 取面板画面。
5. 保存：`file.saveAs`（新路径）或 `save_project`（adapter 的导出封装），读回后再确认。

## 排错

| 现象 | 原因 | 处理 |
|---|---|---|
| `command_run` 报"Open the editor panel" | 心跳超 15 秒，面板已关或崩溃 | 重新 `open_editor` |
| 面板卡在"正在加载编辑器" | 宿主 CSP 未放行 WASM | 检查 `.zcode-plugin/panel-meta.json` 的 `wasmUnsafeEval` |
| 引擎下载失败 | 网络受限 | 设 `JIANYINGCRAFT_CLI_UPDATE=off` 手工放置，或 `JIANYINGCRAFT_CLI_BIN` 指向本机二进制 |
| 报错"轨道不存在" | 把素材 id 当成了轨道 id | 先 `sequence.inspect` 看真实轨道名 |
| 导出结果 `offlineMedia` 非空 | 素材缺失/离线 | 先修素材，不要把占位帧当成品 |

## 保存与复核

保存到**全新路径**，不覆盖已有文件。保存后 `file.open` 读回并 `sequence.inspect` 核对，
确认交付的不是空壳。
