import { defaultStage1Config } from "../config/defaults.js";
import type { Stage1Config, Stage1ConfigPatch } from "../config/types.js";
import type {
  PublishCommentRequest,
  PublishCommentResult,
  ReviewRequest,
  Stage3ReviewResult
} from "../domain/types.js";
import { CopilotLlmProvider } from "../llm/copilotLlmProvider.js";
import type { ILlmProvider } from "../llm/llmProvider.js";
import { NoopReviewObserver, type IReviewObserver } from "../observability/reviewObserver.js";
import type { IConfluenceProvider } from "../providers/confluenceProvider.js";
import type { IGithubProvider } from "../providers/githubProvider.js";
import type { IJiraProvider } from "../providers/jiraProvider.js";
import type { SkillContext } from "../skills/context.js";
import { AggregateContextSkill } from "../skills/aggregateContextSkill.js";
import { DraftCommentSkill } from "../skills/draftCommentSkill.js";
import { ExtractJiraKeysSkill } from "../skills/extractJiraKeysSkill.js";
import { FetchConfluenceContextSkill } from "../skills/fetchConfluenceContextSkill.js";
import { FetchGithubContextSkill } from "../skills/fetchGithubContextSkill.js";
import { FetchJiraContextSkill } from "../skills/fetchJiraContextSkill.js";
import { PublishCommentSkill } from "../skills/publishCommentSkill.js";
import { ScorePrSkill } from "../skills/scorePrSkill.js";
import { parsePrLink } from "../utils/parsePrLink.js";

export interface ReviewOrchestratorDeps {
  githubProvider: IGithubProvider;
  jiraProvider: IJiraProvider;
  confluenceProvider: IConfluenceProvider;
  llmProvider?: ILlmProvider;
  reviewObserver?: IReviewObserver;
  config?: Stage1ConfigPatch;
}

export class Stage1ReviewOrchestrator {
  private readonly context: SkillContext;
  private readonly reviewObserver: IReviewObserver;
  private readonly fetchGithubContextSkill = new FetchGithubContextSkill();
  private readonly extractJiraKeysSkill = new ExtractJiraKeysSkill();
  private readonly fetchJiraContextSkill = new FetchJiraContextSkill();
  private readonly fetchConfluenceContextSkill = new FetchConfluenceContextSkill();
  private readonly aggregateContextSkill = new AggregateContextSkill();
  private readonly scorePrSkill = new ScorePrSkill();
  private readonly draftCommentSkill = new DraftCommentSkill();
  private readonly publishCommentSkill = new PublishCommentSkill();

  constructor(deps: ReviewOrchestratorDeps) {
    this.reviewObserver = deps.reviewObserver ?? new NoopReviewObserver();
    const resolvedConfig = mergeConfig(defaultStage1Config, deps.config ?? {});
    this.context = {
      config: resolvedConfig,
      providers: {
        github: deps.githubProvider,
        jira: deps.jiraProvider,
        confluence: deps.confluenceProvider
      },
      llm: deps.llmProvider ?? (resolvedConfig.llm.mode === "copilot" ? new CopilotLlmProvider() : undefined)
    };
  }

  async run(request: ReviewRequest): Promise<Stage3ReviewResult> {
    const pipelineStartedAt = Date.now();
    const warnings: string[] = [];
    await this.emit({
      name: "pipeline_started",
      timestamp: new Date().toISOString()
    });

    try {
    // Profile selection is intentionally disabled in panel UX.
    // Always use default profile and rely on prompt instructions to cover
    // security/performance/compliance together.
    const profile = "default";
    const githubResult = await this.runStep("fetch-github-context", () =>
      this.fetchGithubContextSkill.run({ request }, this.context)
    );
    const jiraKeysResult = await this.runStep("extract-jira-keys", () =>
      this.extractJiraKeysSkill.run({ githubContext: githubResult.githubContext }, this.context)
    );
    const jiraResult = await this.runStep("fetch-jira-context", () =>
      this.fetchJiraContextSkill.run({ jiraKeys: jiraKeysResult.jiraKeys }, this.context)
    );

    let confluenceResult;
    try {
      confluenceResult = await this.runStep("fetch-confluence-context", () =>
        this.fetchConfluenceContextSkill.run(
          {
            githubContext: githubResult.githubContext,
            jiraContext: jiraResult.jira
          },
          this.context
        )
      );
    } catch (error) {
      if (!this.context.config.resilience.continueOnConfluenceError) {
        throw error;
      }
      const message = "Confluence retrieval failed; continue with empty Confluence context.";
      warnings.push(message);
      await this.emit({
        name: "degraded",
        step: "fetch-confluence-context",
        message,
        timestamp: new Date().toISOString()
      });
      confluenceResult = {
        confluence: {
          strongLinkedUrls: [],
          searchQueries: [],
          pages: []
        }
      };
    }

    const aggregateResult = await this.runStep("aggregate-context", () =>
      this.aggregateContextSkill.run(
        {
          prReference: githubResult.prReference,
          profile,
          githubContext: githubResult.githubContext,
          jiraContext: jiraResult.jira,
          confluenceContext: confluenceResult.confluence
        },
        this.context
      )
    );
    const { reviewContext } = aggregateResult;

    const score = await this.runStep("score-pr", () =>
      this.scorePrSkill.run(
        {
          githubContext: reviewContext.github,
          jiraContext: reviewContext.jira,
          confluenceContext: reviewContext.confluence,
          profile: reviewContext.profile
        },
        this.context
      )
    );

    const draft = await this.runStep("draft-comment", () =>
      this.draftCommentSkill.run(
        {
          reviewContext,
          score: score.score
        },
        this.context
      )
    );

    const durationMs = Date.now() - pipelineStartedAt;
    await this.emit({
      name: "pipeline_completed",
      durationMs,
      timestamp: new Date().toISOString()
    });

    return {
      context: reviewContext,
      score: score.score,
      draft: draft.draft,
      warnings,
      meta: {
        durationMs,
        usedLlm: draft.usedLlm
      }
    };
    } catch (error) {
      await this.emit({
        name: "pipeline_failed",
        message: error instanceof Error ? error.message : "Unknown pipeline error",
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  async publishEditedComment(request: PublishCommentRequest): Promise<PublishCommentResult> {
    const prReference = parsePrLink(request.prLink);
    const publish = await this.runStep("publish-comment", () =>
      this.publishCommentSkill.run(
        {
          prReference,
          commentBody: request.commentBody,
          confirmed: request.confirmed
        },
        this.context
      )
    );
    return publish.result;
  }

  private async runStep<T>(step: string, runner: () => Promise<T>): Promise<T> {
    const startedAt = Date.now();
    await this.emit({
      name: "step_started",
      step,
      timestamp: new Date().toISOString()
    });
    try {
      const result = await runner();
      await this.emit({
        name: "step_succeeded",
        step,
        durationMs: Date.now() - startedAt,
        timestamp: new Date().toISOString()
      });
      return result;
    } catch (error) {
      await this.emit({
        name: "step_failed",
        step,
        durationMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : "Unknown step error",
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  private async emit(event: Parameters<IReviewObserver["emit"]>[0]): Promise<void> {
    if (!this.context.config.observability.enabled) {
      return;
    }
    await this.reviewObserver.emit(event);
  }
}

function mergeConfig(base: Stage1Config, partial: Stage1ConfigPatch): Stage1Config {
  return {
    ...base,
    ...partial,
    llm: {
      ...base.llm,
      ...(partial.llm ?? {})
    },
    post: {
      ...base.post,
      ...(partial.post ?? {})
    },
    resilience: {
      ...base.resilience,
      ...(partial.resilience ?? {})
    },
    observability: {
      ...base.observability,
      ...(partial.observability ?? {})
    },
    providers: {
      github: {
        ...base.providers.github,
        ...(partial.providers?.github ?? {}),
        credential: {
          ...base.providers.github.credential,
          ...(partial.providers?.github?.credential ?? {})
        }
      },
      jira: {
        ...base.providers.jira,
        ...(partial.providers?.jira ?? {}),
        credential: {
          ...base.providers.jira.credential,
          ...(partial.providers?.jira?.credential ?? {})
        }
      },
      confluence: {
        ...base.providers.confluence,
        ...(partial.providers?.confluence ?? {}),
        credential: {
          ...base.providers.confluence.credential,
          ...(partial.providers?.confluence?.credential ?? {})
        }
      }
    },
    scoring: {
      ...base.scoring,
      ...partial.scoring,
      weights: {
        ...base.scoring.weights,
        ...(partial.scoring?.weights ?? {})
      }
    }
  };
}
