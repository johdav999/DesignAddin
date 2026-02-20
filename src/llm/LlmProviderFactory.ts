import { ILlmProvider } from './ILlmProvider';
import { OpenAiLlmProvider } from './OpenAiLlmProvider';

export function createLlmProvider(): ILlmProvider {
	return new OpenAiLlmProvider();
}
