# 模板批量（jianyingcraft-template/v1 + stories/v1）

用户要的不是"复制文件"，而是：**一批故事 + 同一套模板 → 同一风格、不同内容/效果的视频**。

## 两层输入

`template.json`（风格，固定）：

```jsonc
{"schema":"jianyingcraft-template/v1","id":"youth-memory",
 "canvas":{"width":1080,"height":1920,"fps":30},
 "pacing":{"min_shot_s":2.0,"max_shot_s":3.0},
 "palette":{"filters":["清新","日系奶油","..."],"effects":["光晕","..."],"transitions":["叠化","..."]},
 "rules":{"transition_every_n":2,"alternate_scale":[1.0,1.12],"rotate_filters":true,"rotate_effects":true,
          "background_filling":{"type":"blur","blur":0.0625}},
 "text":{"font":"优设标题圆","title_size":18,"title_y":-0.12,"animation_pool":["变色输入","右上弹入"]},
 "audio":{"volume":0.85,"fade":{"in_us":500000,"out_us":900000}}}
```

`stories.json`（内容，每批可变）：

```jsonc
{"schema":"jianyingcraft-stories/v1",
 "stories":[{"id":"graduation-day","title":"毕业那天","lines":["最后一次穿校服","..."],
             "images":["a.webp","b.jpg","c.jpg"],"duration_s":9,"variation_seed":3,
             "bgm":"可选，覆盖模板"}]}
```

## 绑定规则（`tools/template-batch.mjs`）

- 每张图 = 一个镜头，时长均分（按帧对齐）；
- 滤镜 = `palette.filters[(seed + i) % n]`，特效 = `palette.effects[(seed + 2i + 1) % n]`；
- 转场：每 `transition_every_n` 个镜头一次，从 `palette.transitions` 轮换；
- `scale` 在 `alternate_scale` 之间交替，制造推拉节奏；
- 标题动画从 `text.animation_pool` 选；
- `seed = hash(story.id) + variation_seed`：同一故事可复现，不同故事自然不同；
- 每条都 `project build` + `project verify`，`issues` 非空即整批失败。

## 实测

3 条故事、同一模板、同一批素材池：

| 故事 | 镜头 | 滤镜 / 特效（逐镜） | 转场 |
|---|---|---|---|
| 毕业那天 | 3 | 清晰明亮·光斑虚化 → 夏日小美好·光晕 → 清新漫和·丁达尔 | 第 2 镜泛白 |
| 夏日操场 | 3 | 清新漫和·光晕 → 清新·丁达尔 → 日系奶油·光斑虚化 | 第 2 镜泛白 |
| 晚霞与少年 | 2 | 清晰明亮·光斑虚化 → 夏日小美好·光晕 | 无（不足 2 镜间隔） |

`template-batch: 3 ok: 3 failed: 0`，每条 `issues=[]`。

## 局限与下一步

- 当前是「整条共用一套文本/音频规则」；逐镜文案、逐镜贴纸需要把 `shots[]` 加进 story；
- 模板池目前是固定名字，换风格 = 换模板文件，不改代码；
- 预览 `render proxy` 是近似，权威画面以草稿在剪映里为准。
## 逐镜覆盖（`shots[]`）

故事里可以不用 `images`，改用 `shots`，每个镜头单独覆盖风格参数：

```jsonc
"shots": [
  { "image": "a.webp", "duration_s": 3, "filter": "胶片", "effect": "光斑飘落",
    "text": { "content": "毕业那天", "start_s": 0.3, "duration_s": 2 } },
  { "image": "b.jpg", "duration_s": 3, "effect": "光晕", "transition_out": "泛白" },
  { "image": "c.jpg", "duration_s": 3, "effect": "CCD闪光",
    "text": { "content": "后会有期", "start_s": 0.5 },
    "sticker_png": "stickers/star.png", "sticker": { "x": 0.3, "y": 0.34, "scale": 0.18 } }
]
```

规则：

- `filter` / `effect` / `scale` 省略时按模板轮换；
- `transition_out`：字符串显式指定，`null` 表示硬切；**最后一个镜头不允许转场**（自动忽略）；
- `text`：字符串或 `{content,start_s,duration_s}`，自动夹在本镜时长内；
- 有逐镜文案时**不再叠加全局标题**，避免文本轨重叠；
- `sticker_png` + `sticker{x,y,scale}`：用户自己的透明 PNG 作为叠加图层，离线可用。

实测同一模板 + 3 条逐镜故事：`3 ok: 3 failed: 0`，`issues` 均为空；每条故事可完全不同滤镜/特效/转场/文案，
但画幅、节奏、字体、调色池一致。