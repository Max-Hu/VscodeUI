# VS Code PR Reviewer 插件 — 完整实现需求文档（Codex 可执行版）

> 目标：构建一个 **高可用 / 高可复用 / 易读懂 / 易扩展** 的 VS Code 插件  
> 形式：Panel（WebviewView）  
> 架构：内部 Agent Skills Pipeline  
> LLM：优先使用用户本地 Copilot（VS Code LM API）  
> 上下文来源：GitHub + Jira + Confluence  
> 输入：仅 PR link  

---

# 1. 总体目标

构建一个企业级 PR 审计插件，具备以下能力：

- 用户仅输入 **PR link**
- 自动解析 PR 信息
- 从 commit message 强制提取 Jira ID
- 自动关联 Jira issue 与 Confluence 页面
- 聚合多源上下文
- 对 PR 实现代码进行评分（0–100）
- 生成结构化审计结果
- 生成可发布评论草稿
- 用户可编辑后再发布
- 所有能力基于内部 Skills 架构实现
- 所有核心逻辑具备单元测试
- 代码风格：简洁、低耦合、高内聚、可替换、可扩展

---

# 2. 输入与触发

## 2.1 输入字段（Panel UI）

- PR link（唯一必填）
- Review Profile（default/security/performance/compliance）
- Additional Keywords（可选）

## 2.2 PR link 解析规则

必须支持 GitHub PR URL：

https://github.com/{owner}/{repo}/pull/{number}


解析出：

- owner
- repo
- prNumber

非法 URL 必须提示错误，不允许继续执行。

---

# 3. 架构原则

## 3.1 分层设计（强制）

views/ → 仅 UI 与 message 通信
orchestrator/ → 流程编排
skills/ → 可插拔技能
providers/ → GitHub / Jira / Confluence 适配
llm/ → LLM Provider 抽象
domain/ → 类型定义
config/ → Settings
security/ → SecretStorage 管理
utils/ → 通用工具


### 禁止：

- 业务逻辑写在 extension.ts
- Webview 直接访问 token
- Provider 之间相互调用

---

# 4. 内部 Agent Skills 架构（路线 A）

## 4.1 Skill 接口

```ts
interface Skill<TInput, TOutput> {
  id: string;
  description: string;
  run(input: TInput, context: SkillContext): Promise<TOutput>;
}
4.2 必须实现的 Skills
1️⃣ fetch-github-context
拉 PR metadata

拉 files + patch（裁剪）

拉 commits

拉 checks

抽取 signals：

jiraKeys[]

confluenceLinks[]

keywords[]

2️⃣ extract-jira-keys
从 commit message 提取 Jira ID

正则可配置

去重 + 排序

3️⃣ fetch-jira-context
按 jiraKeys 精准拉 issue

扩展 parent/epic/children（depth=1 默认）

抽取：

summary

description

Acceptance Criteria

NFR

风险

测试要求

4️⃣ fetch-confluence-context
优先从 issue 链接获取页面

否则 CQL 搜索

扩展 children / related（depth=1 默认）

抽取：

Scope

Requirements

API 契约

Security

Rollback

Monitoring

5️⃣ aggregate-context
去重

relevanceScore 排序

topK 截断

构建 ReviewContext

保留 traceability 映射

6️⃣ score-pr
计算 overallScore（0–100）

输出 scoreBreakdown

输出 evidence

输出 confidence

7️⃣ draft-comment
生成 Markdown 草稿

8️⃣ publish-comment
使用编辑后的 commentBody 发布

二次确认

5. 上下文查询策略（必须实现）
5.1 强关联 → 弱关联 → 扩展
Round1
PR → commit → Jira key

PR 文本 → Confluence 链接

Round2（可配置）
用 Jira summary/AC → 扩展搜索 Confluence

用关键词 → JQL / CQL 弱召回

5.2 GitHub 查询内容
必须获取：

PR metadata

changed files + patch

commits（强制包含 Jira ID）

checks/CI 状态

评论

裁剪规则：

maxFiles

maxPatchCharsPerFile

超限标记 TRUNCATED

5.3 Jira 查询内容
精准 key 查询

issue links 扩展

抽取 AC/NFR

relevanceScore 排序

5.4 Confluence 查询内容
优先级：

issue 中链接

key 搜索

关键词搜索

扩展 depth=1

6. 评分系统设计
6.1 输出结构
{
  overallScore: number;
  scoreBreakdown: [
    {
      dimension: string;
      score: number;
      weight: number;
      rationale: string;
    }
  ];
  evidence: [
    {
      file?: string;
      snippet?: string;
    }
  ];
  confidence: "low" | "medium" | "high";
}
6.2 默认评分维度
Correctness

Maintainability

Reliability

Security

Performance

Test Quality

Traceability

权重必须可配置。

7. LLM 集成（Copilot 优先）
7.1 LLM Provider 抽象
interface ILlmProvider {
  generate(prompt: string): Promise<string>;
}
7.2 支持模式
copilot（默认）

external

mock

7.3 Copilot 调用
使用 vscode.lm API

不自行管理 token

不可用时 graceful degrade

8. 发布流程
生成 commentBody

UI 提供编辑器

点击发布

弹 modal 二次确认

发布成功回显

9. 参数与认证配置
9.1 Settings 参数
expandDepth

topK

maxFiles

maxPatchCharsPerFile

scoring.weights

llm.mode

post.enabled

9.2 认证模式
github: pat | oauth | vscodeAuth

jira: pat | basic | oauth

confluence: pat | basic | oauth

敏感信息必须存 SecretStorage。

10. 单元测试要求
必须覆盖：

PR link 解析

Jira key 提取

relevanceScore 排序

上下文裁剪

评分计算

JSON 解析 fallback

发布使用编辑后的文本

Skill 独立测试

Orchestrator 端到端（mock providers + mock llm）

11. 代码风格要求
必须满足：

函数小而清晰

单一职责

依赖通过接口注入

禁止循环依赖

Provider 不依赖 UI

Skill 可独立测试

所有 I/O 逻辑集中在 Provider 层

Orchestrator 只负责编排

12. MVP 验收标准
输入 PR link 可执行

commit 中 Jira ID 可解析

Jira/Confluence 上下文可关联

输出评分 + 审计结果

可编辑后成功发布

单元测试通过

Copilot 调用成功

最终定义
这是一个：

基于 PR link 自动聚合 GitHub/Jira/Confluence 上下文的 VS Code Panel 插件，
采用内部 Agent Skills 架构实现可扩展审计流程，
支持代码评分与可编辑发布，
调用用户本地 Copilot 进行智能分析，
具备参数与认证可配置能力，
并拥有完整单元测试保障与可持续扩展能力。