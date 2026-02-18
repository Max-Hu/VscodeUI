import { defaultStage1Config } from "../config/defaults.js";
import type { Stage1Config, Stage1ConfigPatch } from "../config/types.js";
import type { ReviewRequest, Stage1ReviewResult } from "../domain/types.js";
import type { ILlmProvider } from "../llm/llmProvider.js";
import type { IGithubProvider } from "../providers/githubProvider.js";
import type { IJiraProvider } from "../providers/jiraProvider.js";
import type { SkillContext } from "../skills/context.js";
import { AggregateContextSkill } from "../skills/aggregateContextSkill.js";
import { DraftCommentSkill } from "../skills/draftCommentSkill.js";
import { ExtractJiraKeysSkill } from "../skills/extractJiraKeysSkill.js";
import { FetchGithubContextSkill } from "../skills/fetchGithubContextSkill.js";
import { FetchJiraContextSkill } from "../skills/fetchJiraContextSkill.js";
import { ScorePrSkill } from "../skills/scorePrSkill.js";

export interface ReviewOrchestratorDeps {
  githubProvider: IGithubProvider;
  jiraProvider: IJiraProvider;
  llmProvider?: ILlmProvider;
  config?: Stage1ConfigPatch;
}

export class Stage1ReviewOrchestrator {
  private readonly context: SkillContext;
  private readonly fetchGithubContextSkill = new FetchGithubContextSkill();
  private readonly extractJiraKeysSkill = new ExtractJiraKeysSkill();
  private readonly fetchJiraContextSkill = new FetchJiraContextSkill();
  private readonly aggregateContextSkill = new AggregateContextSkill();
  private readonly scorePrSkill = new ScorePrSkill();
  private readonly draftCommentSkill = new DraftCommentSkill();

  constructor(deps: ReviewOrchestratorDeps) {
    this.context = {
      config: mergeConfig(defaultStage1Config, deps.config ?? {}),
      providers: {
        github: deps.githubProvider,
        jira: deps.jiraProvider
      },
      llm: deps.llmProvider
    };
  }

  async run(request: ReviewRequest): Promise<Stage1ReviewResult> {
    const profile = request.reviewProfile ?? "default";
    const githubResult = await this.fetchGithubContextSkill.run({ request }, this.context);
    const jiraKeysResult = await this.extractJiraKeysSkill.run(
      { githubContext: githubResult.githubContext },
      this.context
    );
    const jiraResult = await this.fetchJiraContextSkill.run({ jiraKeys: jiraKeysResult.jiraKeys }, this.context);
    const aggregateResult = await this.aggregateContextSkill.run(
      {
        prReference: githubResult.prReference,
        profile,
        githubContext: githubResult.githubContext,
        jiraContext: jiraResult.jira
      },
      this.context
    );
    const { reviewContext } = aggregateResult;

    const score = await this.scorePrSkill.run(
      {
        githubContext: reviewContext.github,
        jiraContext: reviewContext.jira,
        profile: reviewContext.profile
      },
      this.context
    );

    const draft = await this.draftCommentSkill.run(
      {
        reviewContext,
        score: score.score
      },
      this.context
    );

    return {
      context: reviewContext,
      score: score.score,
      draft: draft.draft
    };
  }
}

function mergeConfig(base: Stage1Config, partial: Stage1ConfigPatch): Stage1Config {
  return {
    ...base,
    ...partial,
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
