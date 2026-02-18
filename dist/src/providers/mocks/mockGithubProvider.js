function createKey(reference) {
    return `${reference.owner}/${reference.repo}#${reference.prNumber}`;
}
export class MockGithubProvider {
    dataset;
    constructor(dataset) {
        this.dataset = dataset;
    }
    async getPullRequest(reference) {
        const key = createKey(reference);
        const data = this.dataset[key];
        if (!data) {
            throw new Error(`No mock pull request found for ${key}`);
        }
        return data;
    }
}
