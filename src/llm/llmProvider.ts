export interface ILlmProvider {
  generate(prompt: string): Promise<string>;
}

export class MockLlmProvider implements ILlmProvider {
  constructor(private readonly response: string = "{\"markdown\":\"## Mock Draft\"}") {}

  async generate(_prompt: string): Promise<string> {
    return this.response;
  }
}
