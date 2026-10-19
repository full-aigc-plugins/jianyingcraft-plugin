---
name: jianyingcraft-batch-remix
description: 用同一模板批量出片：N 条素材套同一模板，替换占位片段、保留字幕与音乐、逐个导出并出对账清单。当用户说"批量混剪""批量出片""套模板出 10 条""矩阵号量产"时使用。
license: Apache-2.0
---

# 批量混剪（JianyingCraft）

交付物不是"一条视频"，而是**一份可对账的产物清单**。任何一条失败都必须留在清单里。

## 0. 命令核对

```
command_list {"filter": "export"}
command_list {"filter": "replace"}
command_list {"filter": "jobs"}
```

必须包含：`file.open`、`file.saveCopy`、`clip.replaceFromBin`、`export.queue.add`、
`jobs.list`、`jobs.cancel`、`sequence.inspect`。缺任何一个：停止并报告。

## 1. 展开矩阵

输入：模板工程路径、素材目录（工作区内）、目标条数 N。

| 项 | 规则 |
|---|---|
| 素材排序 | 按文件名自然序（`a2` 在 `a10` 前），不按修改时间 |
| 输出路径 | `renders/<模板名>/<素材名>_<yyyymmdd-HHmm>.mp4`，冲突加 `-2`、`-3` |
| 上限 | 单批 ≤ 50 条；超过时先问用户是否分批 |

`N > 素材数` 时按实际素材数跑，并在清单里写明缺口，**不重复用同一素材凑数**。

## 2. 逐条执行（串行）

对每条：

1. `file.open {"path": "<模板路径>"}` 打开模板；
2. `file.saveCopy {"path": "<工作副本路径>"}` 复制成工作副本——**绝不改模板本身**；
3. `sequence.inspect` 找到占位片段 id；
4. `clip.replaceFromBin {"clips": [<占位 id>], "item": <素材 id>}` 替换；
5. 若模板有"时长自适应"，执行它；没有就在清单里标注"未自适应，时长按模板"；
6. `export.queue.add {"preset": "<预设>", "path": "<输出路径>", "start": true}` 入队；
7. `edit.undo` 不是必须——每条都从模板重开，天然隔离。

## 3. 等队列

轮询 `jobs.list` 到没有 running 项；单条失败不打断整批。
超过 10 分钟无进度的条目：`jobs.cancel` 并标记 `timeout`。

## 4. 对账（必须）

| 检查 | 判据 |
|---|---|
| 文件存在 | 每条输出路径 stat 成功且 size > 0 |
| 离线素材 | 导出结果 `offlineMedia` 必须为 `[]` |
| 时长 | 与模板时长误差 ≤ 1 帧 |
| 数量 | 成功条数 + 失败条数 == 计划条数（不允许"消失"） |

产出两份清单：Markdown 表格（人看）与 JSON（机器核），字段一致：
`output, source, template, durationFrames, status, error`。

## 失败处理

| 现象 | 动作 |
|---|---|
| 素材少于计划 | 按实际数量跑，清单标 `skipped` 并说明缺口 |
| 单条导出失败 | 记录错误原文，继续下一条，状态 `failed` |
| 队列卡住 | `jobs.cancel` + `timeout`，继续下一条 |
| 磁盘不足 | 立即停止整批，避免半成品堆积 |

## 禁止

- 不修改模板工程（只改 `saveCopy` 出来的工作副本）。
- 不并行开多个面板会话（桥是单会话，第二个会 `panel_busy`）。
- 不把失败条目从清单里删掉。
