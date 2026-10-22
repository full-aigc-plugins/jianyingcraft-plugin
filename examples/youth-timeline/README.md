# 示例：青春·少年时（分镜时间轴）

这是 `jianyingcraft-shot-timeline` 技能的参考产物：12 个镜头、每镜 2.5s，一张表同时列出
素材 / 滤镜 / 特效 / 文本 / 贴纸 / 音频 / 转场 / 字幕 八类资源。

- `script.md`：短剧式分镜时间轴 + 逐镜导演笔记 + 音频设计 + 资源编号 + 执行状态
- `timeline.json`：机器可读的同一份时间轴（`jianyingcraft-shot-timeline/v1`）
- `plan.json`：由 `make-plan.mjs` 生成的 `jianying-cli-plan/v1`（可直接 build）
- `subs.srt`：6 条字幕
- `make-plan.mjs`：生成器（改镜头/滤镜/特效后重跑）

> 贴纸使用 `catalogs/local-stickers.json` 里的本机资源 id（名称/画面由剪映按 id 拉取）；
> 预览 `render proxy` 不渲染转场/滤镜/特效，且图片轨可能只取首帧，权威画面以草稿在剪映里为准。