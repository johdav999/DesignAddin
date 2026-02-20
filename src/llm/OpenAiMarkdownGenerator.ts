import * as vscode from 'vscode';

export type MarkdownStage = 'brief' | 'architecture' | 'backlog' | 'prompts';

export interface MarkdownInputs {
	prompt?: string;
	idea?: string;
	brief?: string;
	architecture?: string;
	backlog?: string;
}

interface ChatMessage {
	role: 'system' | 'user';
	content: string;
}

interface ChatCompletionsResponse {
	choices?: Array<{
		message?: {
			content?: string;
		};
	}>;
}

export class OpenAiMarkdownGenerator {
	public async generateMarkdown(stage: MarkdownStage, inputs: MarkdownInputs): Promise<string> {
		const apiKey = process.env.OPENAI_API_KEY;
		if (!apiKey) {
			await vscode.window.showErrorMessage(
				`OpenAI API key is missing.

Windows (PowerShell):

setx OPENAI_API_KEY "your_key_here"
# then restart VS Code

macOS/Linux (zsh/bash):

export OPENAI_API_KEY="your_key_here"
# launch code from same terminal OR add to ~/.zshrc ~/.bashrc

VS Code must be restarted after setting env vars in most cases.`,
				{ modal: true }
			);
			throw new Error('OPENAI_API_KEY is not set');
		}

		const model = vscode.workspace.getConfiguration('designAddin.llm').get<string>('model', 'gpt-4.1-mini');
		const temperature = vscode.workspace.getConfiguration('designAddin.llm').get<number>('temperature', 0.2);
		const maxTokens = vscode.workspace.getConfiguration('designAddin.llm').get<number>('maxTokens', 3000);
		const messages = this.buildMessages(stage, inputs);

		const response = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model,
				messages,
				temperature,
				max_tokens: maxTokens,
			}),
		});

		if (!response.ok) {
			const responseText = await response.text();
			throw new Error(`OpenAI request failed (${response.status}): ${responseText}`);
		}

		const data = (await response.json()) as ChatCompletionsResponse;
		const content = data.choices?.[0]?.message?.content?.trim();
		if (!content) {
			throw new Error('OpenAI response did not contain markdown content');
		}

		return content;
	}

	private buildMessages(stage: MarkdownStage, inputs: MarkdownInputs): ChatMessage[] {
		if (inputs.prompt) {
			return [
				{
					role: 'system',
					content:
						'You are a senior product and engineering assistant. Follow the user instructions exactly and return markdown only.',
				},
				{ role: 'user', content: inputs.prompt },
			];
		}

		const systemByStage: Record<MarkdownStage, string> = {
			brief:
				'You are an expert product manager and technical writer. Produce clear, structured output and avoid fluff. Infer the product domain from the user idea and do not assume VS Code extension specifics unless explicitly requested.',
			architecture:
				'You are a senior software architect. You design pragmatic architectures with clear module boundaries, data contracts, and implementation details. Infer platform and stack from the provided context and do not assume VS Code extension specifics unless explicitly requested.',
			backlog:
				'You are a technical product owner. You create backlogs with epics, user stories, acceptance criteria, and implementation notes aligned to the product domain described in context.',
			prompts:
				'You are a senior engineer who writes precise implementation prompts for coding agents. Your prompts must be actionable and reference exact file paths, functions, and test steps. Infer stack and runtime from the provided artifacts.',
		};

		const userByStage: Record<MarkdownStage, string> = {
			brief: inputs.idea ?? '',
			architecture: `IDEA:\n${inputs.idea ?? ''}\n\nBRIEF:\n${inputs.brief ?? ''}`,
			backlog: `IDEA:\n${inputs.idea ?? ''}\n\nBRIEF:\n${inputs.brief ?? ''}\n\nARCHITECTURE:\n${inputs.architecture ?? ''}`,
			prompts: `ARCHITECTURE:\n${inputs.architecture ?? ''}\n\nBACKLOG:\n${inputs.backlog ?? ''}`,
		};

		return [
			{ role: 'system', content: systemByStage[stage] },
			{ role: 'user', content: userByStage[stage] },
		];
	}
}
