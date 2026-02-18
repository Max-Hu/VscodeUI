export interface Skill<TInput, TOutput, TContext> {
  id: string;
  description: string;
  run(input: TInput, context: TContext): Promise<TOutput>;
}
