export class AggregateContextSkill {
    id = "aggregate-context";
    description = "Build the normalized review context for downstream scoring and drafting.";
    async run(input, _context) {
        return {
            reviewContext: {
                prReference: input.prReference,
                profile: input.profile,
                github: input.githubContext,
                jira: input.jiraContext
            }
        };
    }
}
