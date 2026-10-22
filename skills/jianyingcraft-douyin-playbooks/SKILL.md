---
name: jianyingcraft-douyin-playbooks
description: 抖音/剪映场景化剪辑配方库与批量复制机制。用搜索技能收集平台上的剪辑步骤，沉淀为可执行的 playbook（卡点/口播/美食/旅行/剧情/教程/测评/萌宠/毕业/健身），再用 batch 清单一次生成多条草稿。当用户要"做一批同类型短视频/批量复制爆款结构/整理剪辑案例库"时使用。
license: Apache-2.0
---

# 抖音场景剪辑配方与批量复制（jianyingcraft-douyin-playbooks）

## 0. 两条工作流

```mermaid
flowchart LR
  A[搜索平台案例] --> B[抽取镜头结构/资源/检查点]
  B --> C[写入 playbooks.json]
  C --> D[按 briefs.json 填素材与文案]
  D --> E[batch-build.mjs 逐条 build+verify]
  E --> F[每条草稿 + SRT + 汇总 JSON]
```

## 1. 用搜索技能收集案例

每个场景至少找 **2 个来源**，只抽取可复现的步骤，不抄文案/不搬素材：

| 场景 | 搜索词示例 | 参考来源 |
|---|---|---|
| 卡点变装 | `抖音 卡点视频 剪辑 教程 步骤` | [zol 卡点步骤](https://xiazai.zol.com.cn/jiqiao/115706.html)、[php.cn 卡点节奏](https://www.php.cn/faq/1861506.html) |
| 口播知识 | `抖音 口播视频 剪辑 流程 字幕` | [剪映短视频全流程](https://book.qq.com/book-read/54060985/5)、[综艺感剪辑](https://www.tenlong.com.tw/products/9787122510839) |
| 美食探店 | `抖音 美食视频 剪辑 特写 节奏` | [php.cn 美食探店](https://www.php.cn/faq/1610918.html)、[火星时代 美食拍摄剪辑](https://www.hxsd.com/information/10083/) |
| 旅行 vlog | `抖音 旅行vlog 剪辑 结构 转场` | [周末短途可复制流程](https://www.toutiao.com/article/7617348948629438985/)、[剪映旅行Vlog](https://www.php.cn/faq/1689862.html) |

抽取模板：

```json
{"id":"scenario-id","duration_s":[15,30],"beats":[{"at":0.0,"purpose":"钩子"}],
 "shot_s":[1,2.5],"transition":["叠化"],"filter":["清晰明亮"],"effect":["光晕"],
 "text":"标题规则","subtitle":"字幕规则","audio":"BGM/拟音","check":"验收点"}
```

## 2. 已沉淀的配方

`playbooks.json`（本技能目录）包含 10 个场景：卡点变装、口播知识、美食探店、旅行 vlog、剧情反转、教程三步、产品测评、萌宠日常、毕业纪念、健身打卡。每条都有 **节拍位置 / 镜头时长 / 转场 / 滤镜 / 特效 / 文本 / 字幕 / 音频 / 检查点**。

## 3. 批量复制机制

`tools/batch-build.mjs` 读取批量清单，逐条生成 `plan.json` + `subs.srt`，调用
`jianying project build` 与 `project verify`，输出 `summary.json`：

```jsonc
// batch.json
{"schema":"jianyingcraft-batch/v1","playbook":"image-card",
 "canvas":{"width":1080,"height":1920,"fps":30},
 "defaults":{"bgm":"E:/.../bgm.wav","filter":"清晰明亮","effect":"光晕","transition":"叠化"},
 "briefs":[
   {"id":"case-01","title":"18岁的夏天","lines":["青春是什么","是操场上追风的少年"],
    "images":["E:/.../cut-01.jpg","E:/.../cut-03.jpg"],"duration_s":10},
   {"id":"case-02","title":"少年不散场","lines":["是窗外偷走的晚霞"],"images":["E:/.../cut-05.jpg"],"duration_s":5}
 ]}
```

```powershell
$env:JIANYING_CLI = "C:\Users\hnxyh\.cache\full-aigc\editors\jianyingcraft\1.6.31-win32-x64\jianying.exe"
node tools/batch-build.mjs batch.json --out E:\work\batch-demo
```

规则：

1. 每条 brief 的素材数量 × 单镜时长 = 视频时长；`duration_s` 与素材数不整除时按均分取整到帧；
2. 同一条素材不要重复用于同一 brief 的相邻镜头（避免“一眼假”）；复用时像示例那样做独立 cut 文件；
3. 字幕来自 `lines`，标题来自 `title`；滤镜/特效/转场来自 playbook 或 defaults；
4. **每条都必须 `project verify` 且 issues 为空**，否则整批标记失败，不静默跳过；
5. 贴纸/官方资源没有目录时不要写入，标 `planned`。

## 4. 质量门禁

- 每批至少抽 1 条做抽帧检查（画面、字幕安全区）；
- 声音：BGM 不盖人声，转场处 whoosh 不刺耳；
- 版权：素材/音乐/BGM 必须自有或已授权，平台案例只做结构参考；
- 批量 ≠ 复制粘贴：同一 playbook 的文案、镜头顺序、滤镜至少有一处变化，避免同质化。

## 5. 参考

本技能的 playbook 参数是**工程经验 + 平台公开教程的抽象**，不是抖音官方规则；平台算法/时长/审核规则会变，发布前按最新规则复核。
## 6. 模板批量（同风格、多故事）

批量复制不是复制文件，而是**同一模板 + N 个故事**：

- `templates/youth-memory.json`：风格（画幅、节奏、滤镜/特效/转场池、文字样式、音频）；
- `stories.json`：每个故事只给 `title / lines / images / variation_seed`；
- `tools/template-batch.mjs template.json stories.json --out <dir>`：逐条生成、build、verify；
- 同一模板下滤镜/特效/转场按 seed 轮换，保证「风格一致、细节不同」；\n- 需要逐镜差异时，故事改用 `shots[]`（每镜可覆盖 filter/effect/transition/text/sticker_png），规则见 docs/template-batch.md。

- 模板可配 `audio.bgm_pool` 与 `sfx`（按转场自动放音效）；
- A/B：`tools/variant-batch.mjs a.json,b.json,c.json stories.json --out out`；
- 评分：summary 里每条草稿带 `score/checks`（时长、转场密度、字幕安全、风格覆盖、音频）；
- 详见 `docs/template-batch.md` 与 `examples/template-batch/`。
