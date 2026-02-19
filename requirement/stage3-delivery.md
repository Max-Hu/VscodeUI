# 第三阶段交付说明（发布流程、降级策略、可观测性）

## 已交付能力

1. 新增 `publish-comment` 技能：
- 发布前确认（`post.requireConfirmation`）
- 发布开关（`post.enabled`）
- 强制使用用户编辑后的 commentBody 发布

2. LLM 主路径：
- `score-pr` 与 `draft-comment` 都由 LLM 输出结果
- 不再使用本地规则作为评分与评价主路径
- LLM 输出无效时直接报错（不进行本地评分回退）

3. 编排层降级策略：
- Confluence 查询失败可按 `resilience.continueOnConfluenceError` 降级继续执行
- 输出 `warnings` 标识降级信息

4. 可观测性：
- 新增 pipeline/step 事件观察接口
- 支持 `pipeline_started/pipeline_completed/pipeline_failed`
- 支持 `step_started/step_succeeded/step_failed/degraded`

5. 配置扩展：
- `llm.mode`
- `post.enabled`
- `post.requireConfirmation`
- `resilience.continueOnConfluenceError`
- `observability.enabled`

## 代码位置

- 发布技能：`src/skills/publishCommentSkill.ts`
- 草稿降级：`src/skills/draftCommentSkill.ts`
- LLM 草稿解析：`src/utils/llmDraft.ts`
- 编排升级：`src/orchestrator/reviewOrchestrator.ts`
- 观测接口：`src/observability/reviewObserver.ts`
- 配置映射：`src/config/vscodeSettings.ts`

## 新增/升级测试

- `tests/publishCommentSkill.test.ts`
- `tests/draftCommentSkill.test.ts`
- `tests/reviewOrchestrator.test.ts`（发布 + 降级 + 观测）
- `tests/vscodeSettings.test.ts`（新增 stage3 配置映射）
