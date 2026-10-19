// JianyingCraft 面板桥的工具目录：adapter 的 MCP 工具面与 `dist/tools.json` 的**唯一来源**。
//
// 改动这里之后必须重新生成目录，否则 `tests/tools.test.mjs` 会失败：
//   node ui/build-tools.mjs
//
// 约定：
// - 以 `_panel_` 开头的工具是面板内部协议（页面身份/回包/下载），不对 Agent 公开。
// - `command_run` 的 `id` 必须来自可见引擎的 `command_list`，不得凭记忆猜。

/** 每个工具的入参 schema（`{}` 表示无参数）。 */
export const TOOL_SCHEMAS = {
  open_editor: { workspace: { type: 'string', description: '工作区绝对路径；第一次打开时确定' }, path: { type: 'string', description: '可选：工作区内的草稿目录相对路径' } },
  open_browser_editor: { workspace: { type: 'string' }, path: { type: 'string' } },
  editor_status: {},
  command_list: {},
  command_run: { id: { type: 'string', description: '真实引擎命令 id，先用 command_list 取目录' }, params: { type: 'object', description: '命令参数对象' } },
  inspect: {},
  open_file: { path: { type: 'string' } },
  save_project: { path: { type: 'string', description: '把可见引擎里的草稿导出到工作区内的 NEW 路径' } },
  save_file: { source: { type: 'string' }, path: { type: 'string' } },
  list_files: {},
  screenshot: {},
  engine_diagnose: {},
  engine_cli_list: { search: { type: 'string' } },
  engine_cli_run: { argv: { type: 'array', items: { type: 'string' }, description: '宿主侧 jianying-cli 命令，例如 ["verify","draft-a","--json"]' } },
  _panel_poll: { pageId: { type: 'string' } },
  _panel_reply: { pageId: { type: 'string' }, id: { type: 'string' }, result: {}, error: { type: 'string' } },
  _panel_download: { pageId: { type: 'string' }, name: { type: 'string' }, data: { type: 'string' } },
};

/** 每个工具的说明（面向 Agent 的行为契约，不是营销文案）。 */
export const TOOL_DESCRIPTIONS = {
  open_editor: '打开 JianyingCraft 编辑器面板。设置绝对工作区路径后，面板就绪前命令不可用。',
  open_browser_editor: '返回同一会话地址给宿主内置浏览器（这不等于宿主内嵌面板验收）。',
  editor_status: '查看引擎运行时、工作区与面板是否就绪。',
  command_list: '列出可见引擎当前可执行的命令目录。不要凭记忆猜命令名。',
  command_run: '在**可见编辑器**里执行一条引擎命令。这是真正的剪辑动作，会改用户看到的那份草稿。',
  inspect: '读取可见引擎当前草稿的真实结构与未覆盖项。',
  open_file: '把工作区内的草稿目录导入可见编辑器。',
  save_project: '把可见引擎中的草稿导出到工作区内的全新路径。',
  save_file: '把工作区内已有文件复制到全新路径。',
  list_files: '列出工作区内的草稿目录与文件。',
  screenshot: '让可见面板回报它当前画面的 PNG，用于人工确认 Agent 操作是否真的显示出来。',
  engine_diagnose: '诊断宿主侧 jianying-cli 运行时（锁定版本、平台、缓存路径、是否可用）。',
  engine_cli_list: '列出宿主侧 jianying-cli 的真实命令目录（预览渲染、结构校验、草稿库发布等）。',
  engine_cli_run: '在工作区内执行宿主侧 jianying-cli 命令。这些动作发生在宿主侧，不经面板引擎。',
};

/** 工具是否对 Agent 公开（`_panel_*` 是面板内部协议）。 */
export function isPublic(name) {
  return !name.startsWith('_panel_');
}

/** 生成 `dist/tools.json` 的内容（纯函数，测试与构建共用）。 */
export function buildToolCatalog() {
  const tools = Object.entries(TOOL_SCHEMAS).map(([name, params]) => ({
    name,
    public: isPublic(name),
    description: TOOL_DESCRIPTIONS[name] ?? '',
    params,
  }));
  return {
    schema: 'jianyingcraft-tools/v1',
    source: 'ui/tools.mjs',
    generatedBy: 'ui/build-tools.mjs',
    toolCount: tools.length,
    publicToolCount: tools.filter((tool) => tool.public).length,
    tools,
  };
}
