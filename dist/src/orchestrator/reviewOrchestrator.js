import { defaultStage1Config } from "../config/defaults.js";
import { AggregateContextSkill } from "../skills/aggregateContextSkill.js";
import { DraftCommentSkill } from "../skills/draftCommentSkill.js";
import { ExtractJiraKeysSkill } from "../skills/extractJiraKeysSkill.js";
import { FetchGithubContextSkill } from "../skills/fetchGithubContextSkill.js";
import { FetchJiraContextSkill } from "../skills/fetchJiraContextSkill.js";
import { ScorePrSkill } from "../skills/scorePrSkill.js";
export class Stage1ReviewOrchestrator {
    context;
    fetchGithubContextSkill = new FetchGithubContextSkill();
    extractJiraKeysSkill = new ExtractJiraKeysSkill();
    fetchJiraContextSkill = new FetchJiraContextSkill();
    aggregateContextSkill = new AggregateContextSkill();
    scorePrSkill = new ScorePrSkill();
    draftCommentSkill = new DraftCommentSkill();
    constructor(deps) {
        this.context = {
            config: mergeConfig(defaultStage1Config, deps.config ?? {}),
            providers: {
                github: deps.githubProvider,
                jira: deps.jiraProvider
            },
            llm: deps.llmProvider
        };
    }
    async run(request) {
        const profile = request.reviewProfile ?? "default";
        const githubResult = await this.fetchGithubContextSkill.run({ request }, this.context);
        const jiraKeysResult = await this.extractJiraKeysSkill.run({ githubContext: githubResult.githubContext }, this.context);
        const jiraResult = await this.fetchJiraContextSkill.run({ jiraKeys: jiraKeysResult.jiraKeys }, this.context);
        const aggregateResult = await this.aggregateContextSkill.run({
            prReference: githubResult.prReference,
            profile,
            githubContext: githubResult.githubContext,
            jiraContext: jiraResult.jira
        }, this.context);
        const { reviewContext } = aggregateResult;
        const score = await this.scorePrSkill.run({
            githubContext: reviewContext.github,
            jiraContext: reviewContext.jira,
            profile: reviewContext.profile
        }, this.context);
        const draft = await this.draftCommentSkill.run({
            reviewContext,
            score: score.score
        }, this.context);
        return {
            context: reviewContext,
            score: score.score,
            draft: draft.draft
        };
    }
}
function mergeConfig(base, partial) {
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
