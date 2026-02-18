# 第一阶段交付说明（PR -> Jira -> 评分 -> 草稿）

## 已交付能力

1. 输入 PR link 并完成 GitHub PR URL 解析与校验。
2. 拉取 GitHub 上下文（metadata/files/commits/checks/comments），并执行 patch 裁剪。
3. 从 commit message 提取 Jira Key（可配置正则、去重、排序）。
4. 按 Jira Key 拉取 Jira issue 上下文并构建统一 ReviewContext。
5. 生成结构化评分结果（overallScore、breakdown、evidence、confidence）。
6. 生成可编辑 Markdown 审计草稿（包含评分表、Jira 追踪、证据、风险）。
7. GitHub/Jira 的 domain 与 credential 已配置化（支持模式与 secret 引用键）。

## 对应代码位置

- 流程编排：`src/orchestrator/reviewOrchestrator.ts`
- 技能实现：`src/skills/*.ts`
- Provider 抽象与 Mock：`src/providers/**/*.ts`
- 配置与默认参数：`src/config/*.ts`
- 核心类型：`src/domain/types.ts`
- 测试样例：`tests/*.test.ts`
- 运行示例：`examples/stage1-demo.ts`

## 第一阶段暂不包含

1. Confluence 扩展检索与相关性优化（第二阶段）。
2. 发布评论与二次确认闭环（第三阶段）。
3. VS Code Webview/UI 渲染与 `vscode.lm` 实际调用（后续集成阶段）。
