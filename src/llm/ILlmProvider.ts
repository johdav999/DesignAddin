export interface ILlmProvider {
	generateJson<T>(schemaName: string, prompt: string): Promise<T>;
}
