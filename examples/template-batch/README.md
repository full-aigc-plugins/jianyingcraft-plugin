# 模板批量示例：同一风格，多个故事

`template.json` 定义风格（画幅、节奏、滤镜/特效/转场池、文本样式、音频），
`stories.json` 只给内容和素材；`tools/template-batch.mjs` 把两者绑定，逐条 build + verify。

```powershell
$env:JIANYING_CLI = "C:\Users\hnxyh\.cache\full-aigc\editors\jianyingcraft\1.6.31-win32-x64\jianying.exe"
node ../../tools/template-batch.mjs template.json stories.json --out .\out
```

实测 3 条故事（毕业那天 / 夏日操场 / 晚霞与少年）全部 issues=0，且每条故事的
滤镜、特效、转场按 seed 轮换——风格一致、细节不同。

规则：每 N 个镜头一个转场；滤镜/特效从模板池轮换；`variation_seed` 控制同一模板下的差异；
字幕来自 `lines`，标题来自 `title`。