# 第二阶段交付说明（Confluence 扩展检索与相关性优化）

## 已交付能力

1. 新增 `fetch-confluence-context` 技能：
- 强关联优先：Jira issue links + PR 文本 Confluence links
- 弱关联扩展：Jira key / summary / AC 与关键词查询
- 去重输出 Confluence 页面集合

2. 升级 `aggregate-context` 技能：
- Confluence 页面 relevanceScore 计算
- 按相关性排序并按 `topK` 截断
- 生成 Jira -> Confluence traceability 映射

3. 升级评分与草稿：
- Traceability 维度纳入 Confluence 覆盖信号
- 草稿新增 Confluence Context 与 Jira->Confluence Mapping

4. 配置扩展：
- 增加 `providers.confluence.domain`
- 增加 `providers.confluence.credential.*`
- 支持从 VS Code settings 读取 Confluence 配置

## 代码位置

- Provider 抽象：`src/providers/confluenceProvider.ts`
- Confluence Mock：`src/providers/mocks/mockConfluenceProvider.ts`
- Confluence 技能：`src/skills/fetchConfluenceContextSkill.ts`
- 聚合优化：`src/skills/aggregateContextSkill.ts`
- 编排升级：`src/orchestrator/reviewOrchestrator.ts`
- 配置读取：`src/config/vscodeSettings.ts`

## 新增测试

- `tests/fetchConfluenceContextSkill.test.ts`
- `tests/aggregateContextSkill.test.ts`
- `tests/reviewOrchestrator.test.ts`（升级为包含 Confluence 链路）
- `tests/vscodeSettings.test.ts`（覆盖 Confluence 配置映射）
