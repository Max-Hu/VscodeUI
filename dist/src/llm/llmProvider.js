export class MockLlmProvider {
    async generate(prompt) {
        return `MOCK_RESPONSE:\n${prompt}`;
    }
}
