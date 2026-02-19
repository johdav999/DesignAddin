import { ILlmProvider } from './ILlmProvider';

export class StubLlmProvider implements ILlmProvider {
	constructor(private readonly enabled: boolean) {}

	public async generateJson<T>(_schemaName: string, _prompt: string): Promise<T> {
		if (!this.enabled) {
			throw new Error('LLM not configured');
		}

		throw new Error('LLM provider not implemented yet');
	}
}
