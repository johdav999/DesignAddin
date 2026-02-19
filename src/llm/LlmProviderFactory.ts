import { ILlmProvider } from './ILlmProvider';
import { StubLlmProvider } from './StubLlmProvider';

export function createLlmProvider(enabled: boolean, providerName: string): ILlmProvider {
	switch (providerName) {
		case 'openai':
			// OpenAI provider will be plugged in here in a future iteration.
			return new StubLlmProvider(enabled);
		case 'stub':
		default:
			return new StubLlmProvider(enabled);
	}
}
