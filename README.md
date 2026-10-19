# jianyingcraft-plugin

> 在 Codex、ZCode、Kimi、Claude Code 里打开 JianyingCraft 可见剪辑编辑器——
> Agent 的每一次剪辑都发生在你看得见的那份工程上。

[![Version](https://img.shields.io/badge/version-0.1.0--dev-blue)](./kimi.plugin.json)
[![License](https://img.shields.io/badge/license-Apache--2.0-green)](#许可证)

[项目定位](#项目定位) · [一眼看懂](#一眼看懂) · [安装与配置](#安装与配置) ·
[工具契约](#工具契约) · [故障排查](#故障排查) · [当前状态](#当前状态)

> 本插件处于**开发阶段**（0.1.0-dev）：适配层骨架与宿主侧运行时已完成并有测试；
> WASM 引擎桥与可见面板接线尚未完成，**宿主内嵌面板当前不可用**。
> 事实源：[`jianyingcraft` 引擎仓的 openspec 变更](../jianyingcraft/openspec/changes/add-jianyingcraft-editor/tasks.md)。

## 项目定位

`jianyingcraft` 是面向 **Codex / ZCode / Kimi / Claude Code** 的智能剪辑插件。
它把 [JianyingCraft 引擎](../jianyingcraft)（独立 Rust 剪辑内核）接入智能体宿主：
Agent 通过 MCP 命令剪辑，修改实时出现在用户可见的面板里。

JianyingCraft 是**独立的剪辑软件**：工程格式自研（`jianyingcraft-project/v1`），
不依赖抖音/剪映的私有格式或内部接口。

### 解决什么问题

| 问题 | 本插件提供 | 可验证入口 |
|---|---|---|
| Agent 剪辑用户看不见 | 命令派发给可见面板内的引擎，面板不在线即失败 | `ui/adapter.mjs` + e2e 测试 |
| 剪映 GUI 自动化脆弱 | 自有引擎 + 自有格式，无 GUI 依赖 | 引擎仓 22 项 cargo test |
| 宿主清单四套各异 | 可移植核心 + 四份薄适配（只差路径占位符） | `.codex-plugin/` 等四清单 |
| 工具成功 ≠ 画面正确 | `screenshot` 回报真实画面像素；验收要三段证据 | `docs/` + host-acceptance.json |

## 一眼看懂

```text
Agent（Codex / ZCode / Kimi / Claude Code）
  │  MCP stdio: command_run(id, params)
  ▼
adapter.mjs ── 心跳/单活页/队列闸门
  │  入队派发
  ▼
可见面板（宿主内嵌 MCP Apps / 独立浏览器）
  │  WASM 引擎执行（引擎仓编译产物）
  ▼
结构化结果 { changed, gaps, revision } ── 面板按 revision 重绘
  │
  ▼ save_project(path) → 工作区（只写全新路径）
```

| 项目属性 | 值 |
|---|---|
| 插件 ID | `jianyingcraft` |
| 宿主 | Codex / Claude Code / ZCode / Kimi（均待实机验收） |
| 当前版本 | `0.1.0`（开发中，未发布） |
| 插件清单 | `.codex-plugin/plugin.json`、`.claude-plugin/plugin.json`、`.zcode-plugin/plugin.json`、`kimi.plugin.json` |
| MCP 声明 | `.mcp.json`（Claude）/ `.codex-plugin/mcp.json`（Codex）/ 内联（ZCode、Kimi） |
| 引擎仓 | [`../jianyingcraft`](../jianyingcraft) |
| 主要语言 | Node 24+（ESM）+ Rust（引擎） |
| 许可证 | Apache-2.0 |

## 能力与边界

### 已支持（适配层，有测试）

| 能力 | 说明 | 状态 |
|---|---|---|
| photocraft 式调度 | dispatch 入队 + 15s 心跳 + 单活页 + 45s 超时 | 骨架完成 |
| 工作区边界 | 相对路径 + 符号链接逃逸拒绝 + 只写新路径 | ✅ 测试 |
| 宿主侧 CLI 运行时 | cli.lock.json sha256 校验；env→cache→download 三级解析 | ✅ 真实二进制验证 |
| 无依赖归档提取 | 手写 ZIP/TAR.GZ，插件分发不引 npm 依赖 | ✅ 测试 |
| 四宿主清单 | codex/claude/zcode/kimi 薄适配 + CSP 声明 | ✅ 结构就绪 |

### 不负责

- 不替代引擎的剪辑语义（本仓只是宿主接入层，引擎在姊妹仓）。
- 不做剪映草稿读写（导入桥是引擎仓的可选提案）。
- 不把未实机验收的宿主声明为受支持（当前四宿主全部 NOT_RUN）。

## 安装与配置

> 前置：Node 24+。WASM 引擎桥完成前，内嵌面板不可用——以下为安装形态预览。

```bash
# 本地开发模式（不安装，仅生成可审查配置）
cd jianyingcraft-plugin/ui && npm install && npm run build
node dist/adapter.mjs --serve    # 需要 CRAFT_WORKSPACE_ROOT 指向绝对工作区
```

环境变量：

| 变量 | 作用 |
|---|---|
| `CRAFT_WORKSPACE_ROOT` | 工作区绝对路径（或经 `open_editor.workspace` 传入） |
| `JIANYINGCRAFT_CLI_BIN` | 显式指定宿主侧 jianying-cli 二进制（跳过解析） |
| `JIANYINGCRAFT_CLI_UPDATE=off` | 禁止下载，缺二进制时报可诊断错误 |
| `CRAFT_PANEL_METADATA_FILE` | 宿主能力声明（ZCode CSP 等），由宿主清单注入 |

## 工具契约

| 工具 | 职责 |
|---|---|
| `open_editor` / `open_browser_editor` | 打开面板；工作区锁定；返回 editorUrl |
| `command_list` / `command_run` | **编辑器命令**——派发可见引擎（面板未就绪即失败） |
| `inspect` / `screenshot` | 读工程结构 / 回报面板画面 PNG |
| `open_file` / `save_project` / `save_file` / `list_files` | 工作区 IO（防逃逸、不覆盖） |
| `engine_cli_list` / `engine_cli_run` / `engine_diagnose` | **宿主侧** jianying-cli（预览/校验），与编辑器命令严格分离 |

红线：`command_run`（可见引擎）与 `engine_cli_run`（宿主侧子进程）不得互相冒充。

## 故障排查

| 现象 | 原因 | 处理 |
|---|---|---|
| `command_run` 报 "Open the editor panel" | 面板心跳超 15s（未开/崩溃） | 重新 `open_editor` |
| 面板卡"正在加载编辑器" | 宿主 CSP 拦 WASM | 核对 `.zcode-plugin/panel-meta.json` 生效 |
| 引擎下载失败 | 网络受限 | `JIANYINGCRAFT_CLI_UPDATE=off` + 手工放置或 `JIANYINGCRAFT_CLI_BIN` |
| 报"轨道不存在" | 把素材 id 当轨道 id | 先 `project.summary` 看真实 id |

## 当前状态（诚实清单）

| 项 | 状态 | 证据 |
|---|---|---|
| 适配层 node 测试 | ✅ 18/18 | `node --test ui/tests/*.test.mjs` |
| MCP e2e（骨架期） | ✅ 2/2 | `ui/tests/e2e.test.mjs` |
| 宿主侧 CLI 二进制 | ✅ sha256 一致 | 真实下载验证 |
| WASM 面板接线 | ❌ 未实现 | 引擎仓 wasm crate 占位 |
| 四宿主实机验收 | ❌ NOT_RUN | host-acceptance.json 为空 |

## 许可证

Apache-2.0。引擎与规格事实源在 [`jianyingcraft`](../jianyingcraft)（openspec 变更
`add-jianyingcraft-editor` 是本产品目标与任务的唯一事实源）。
