import { ILlmProvider } from './ILlmProvider';
import { OpenAiMarkdownGenerator, MarkdownInputs, MarkdownStage } from './OpenAiMarkdownGenerator';

export class OpenAiLlmProvider implements ILlmProvider {
	private readonly generator = new OpenAiMarkdownGenerator();

	public async generateJson<T>(schemaName: string, prompt: string): Promise<T> {
		const stage = this.mapSchemaToStage(schemaName);
		const inputs: MarkdownInputs = { prompt };
		const markdown = await this.generator.generateMarkdown(stage, inputs);
		return { markdown } as T;
	}

	private mapSchemaToStage(schemaName: string): MarkdownStage {
		const normalized = schemaName.toLowerCase();
		if (normalized.includes('brief')) {
			return 'brief';
		}
		if (normalized.includes('architecture')) {
			return 'architecture';
		}
		if (normalized.includes('backlog')) {
			return 'backlog';
		}
		return 'prompts';
	}

}
