export interface ILlmProvider {
  generate(prompt: string): Promise<string>;
}

export class MockLlmProvider implements ILlmProvider {
  async generate(prompt: string): Promise<string> {
    return `MOCK_RESPONSE:\n${prompt}`;
  }
}
