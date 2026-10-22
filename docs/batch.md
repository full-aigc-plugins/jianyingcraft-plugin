# 批量复制（jianyingcraft-batch/v1）

把「一个 playbook + N 条 brief」变成 N 份剪映草稿的机制。实现：`tools/batch-build.mjs`。

## 输入

```jsonc
{
  "schema": "jianyingcraft-batch/v1",
  "name": "青春批量示例",
  "playbook": "image-card",
  "canvas": { "width": 1080, "height": 1920, "fps": 30 },
  "defaults": {
    "bgm": "E:/work/audio/bgm.wav",
    "filter": "清晰明亮",
    "effect": "光晕",
    "transition": "叠化"
  },
  "briefs": [
    { "id": "case-01", "title": "18岁的夏天",
      "lines": ["青春是什么", "是操场上追风的少年"],
      "images": ["E:/work/media/a.jpg", "E:/work/media/b.jpg"], "duration_s": 9 }
  ]
}
```

- 每条 brief：`images` 数量 × 单镜时长 = 总时长；`duration_s` 省略时按每张 2.5s；
- `defaults.bgm/filter/effect/transition` 可被单条 brief 覆盖；
- 字幕来自 `lines`，标题来自 `title`（可省）。

## 运行

```powershell
$env:JIANYING_CLI = "C:\Users\hnxyh\.cache\full-aigc\editors\jianyingcraft\1.6.31-win32-x64\jianying.exe"
node tools/batch-build.mjs batch.json --out E:\work\batch-out
```

输出：

```
batch-out/
  case-01/plan.json, subs.srt
  draft-case-01/
  summary.json          # 每条 ok / issues / 时长 / 草稿路径
```

任意一条 `build` 或 `verify` 失败，整批以非 0 退出，并在 `summary.json` 里记录原因——不静默跳过。

## 质量门禁

- 每条草稿 `issues` 必须为空；
- 抽 1 条抽帧看画面/字幕安全区；
- 同一批里文案、镜头顺序、滤镜至少变化一处，避免同质化；
- 素材与音乐必须自有或已授权。

## 限制

- 当前 `image-card` 模板只支持图片 + BGM + 标题 + 字幕；贴纸/花字/特效是按 playbook 的默认值，
  尚未按 brief 做逐镜差异化（下一步可把 `shots[]` 放进 brief）；
- 预览 `render proxy` 是近似，权威画面以草稿在剪映里为准。