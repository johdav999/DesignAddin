import * as vscode from 'vscode';

export interface OpenAiClientOptions {
	model: string;
	temperature: number;
	maxOutputTokens: number;
	baseUrl?: string;
}

export interface ChatCompletionsRequest {
	model: string;
	temperature: number;
	max_tokens: number;
	messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
}

export interface OpenAiGenerationResult {
	content: string;
	usage?: {
		promptTokens?: number;
		completionTokens?: number;
		totalTokens?: number;
	};
}

export function buildChatCompletionsRequest(options: OpenAiClientOptions, prompt: string): ChatCompletionsRequest {
	return {
		model: options.model,
		temperature: options.temperature,
		max_tokens: options.maxOutputTokens,
		messages: [{ role: 'user', content: prompt }],
	};
}

export class OpenAiClient {
	constructor(
		private readonly apiKey: string,
		private readonly options: OpenAiClientOptions,
		private readonly output: vscode.OutputChannel
	) {}

	public async generateMarkdown(prompt: string): Promise<OpenAiGenerationResult> {
		const requestBody = buildChatCompletionsRequest(this.options, prompt);
		const endpoint = `${this.options.baseUrl ?? 'https://api.openai.com'}/v1/chat/completions`;
		const start = Date.now();

		const response = await fetch(endpoint, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(requestBody),
		});

		const elapsed = Date.now() - start;
		if (!response.ok) {
			const errorText = await response.text();
			this.output.appendLine(`[openai] failed ${response.status} in ${elapsed}ms`);
			throw new Error(`OpenAI error ${response.status}: ${errorText}`);
		}

		const json = (await response.json()) as {
			choices?: Array<{ message?: { content?: string } }>;
			usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
		};

		const content = json.choices?.[0]?.message?.content?.trim();
		if (!content) {
			throw new Error('OpenAI returned an empty completion.');
		}

		this.output.appendLine(`[openai] success in ${elapsed}ms`);
		return {
			content,
			usage: {
				promptTokens: json.usage?.prompt_tokens,
				completionTokens: json.usage?.completion_tokens,
				totalTokens: json.usage?.total_tokens,
			},
		};
	}
}
