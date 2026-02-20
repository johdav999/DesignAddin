import * as vscode from 'vscode';
import { OpenAiClient } from './openaiClient';
import {
	architecturePromptFromIdeaAndBrief,
	backlogPromptFromInputs,
	briefPromptFromIdea,
	promptSetFromBacklogAndArchitecture,
} from './promptTemplates';
import { ArtifactName, DesignAddinStorage } from './storage';

export interface PipelineArtifacts {
	idea: string;
	brief: string;
	architecture: string;
	backlog: string;
	prompts: string;
}

interface StepResult {
	name: ArtifactName;
	content: string;
	usageText: string;
	elapsedMs: number;
}

export class ArtifactPipeline {
	constructor(
		private readonly storage: DesignAddinStorage,
		private readonly client: OpenAiClient,
		private readonly output: vscode.OutputChannel
	) {}

	public async generateAll(
		idea: string,
		onUpdate: (artifact: ArtifactName, content: string) => void,
		progress?: vscode.Progress<{ message?: string; increment?: number }>
	): Promise<PipelineArtifacts> {
		const artifacts: PipelineArtifacts = {
			idea: idea.trim(),
			brief: '',
			architecture: '',
			backlog: '',
			prompts: '',
		};

		await this.storage.writeArtifact('idea', artifacts.idea);
		onUpdate('idea', artifacts.idea);

		const steps: Array<{ key: ArtifactName; label: string; run: () => Promise<StepResult> }> = [
			{
				key: 'brief',
				label: 'Generating brief',
				run: () => this.runStep('brief', briefPromptFromIdea(artifacts.idea)),
			},
			{
				key: 'architecture',
				label: 'Generating architecture',
				run: () =>
					this.runStep('architecture', architecturePromptFromIdeaAndBrief(artifacts.idea, artifacts.brief)),
			},
			{
				key: 'backlog',
				label: 'Generating backlog',
				run: () =>
					this.runStep('backlog', backlogPromptFromInputs(artifacts.idea, artifacts.brief, artifacts.architecture)),
			},
			{
				key: 'prompts',
				label: 'Generating prompt set',
				run: () => this.runStep('prompts', promptSetFromBacklogAndArchitecture(artifacts.backlog, artifacts.architecture)),
			},
		];

		for (const step of steps) {
			progress?.report({ message: step.label, increment: 25 });
			const result = await step.run();
			artifacts[step.key] = result.content;
			onUpdate(step.key, result.content);
		}

		return artifacts;
	}

	public async regenerateFrom(
		start: Exclude<ArtifactName, 'idea'>,
		onUpdate: (artifact: ArtifactName, content: string) => void,
		includeDownstream: boolean
	): Promise<void> {
		const idea = await this.safeRead('idea');
		const brief = await this.safeRead('brief');
		const architecture = await this.safeRead('architecture');
		const backlog = await this.safeRead('backlog');

		const order: Exclude<ArtifactName, 'idea'>[] = ['brief', 'architecture', 'backlog', 'prompts'];
		const startIndex = order.indexOf(start);
		const selected = includeDownstream ? order.slice(startIndex) : [start];

		let currentBrief = brief;
		let currentArchitecture = architecture;
		let currentBacklog = backlog;

		for (const item of selected) {
			if (item === 'brief') {
				const result = await this.runStep('brief', briefPromptFromIdea(idea));
				currentBrief = result.content;
				onUpdate('brief', result.content);
				continue;
			}
			if (item === 'architecture') {
				const result = await this.runStep('architecture', architecturePromptFromIdeaAndBrief(idea, currentBrief));
				currentArchitecture = result.content;
				onUpdate('architecture', result.content);
				continue;
			}
			if (item === 'backlog') {
				const result = await this.runStep('backlog', backlogPromptFromInputs(idea, currentBrief, currentArchitecture));
				currentBacklog = result.content;
				onUpdate('backlog', result.content);
				continue;
			}
			const result = await this.runStep('prompts', promptSetFromBacklogAndArchitecture(currentBacklog, currentArchitecture));
			onUpdate('prompts', result.content);
		}
	}

	private async runStep(name: ArtifactName, prompt: string): Promise<StepResult> {
		this.output.appendLine(`[pipeline] ${name} started`);
		const started = Date.now();
		const result = await this.client.generateMarkdown(prompt);
		await this.storage.writeArtifact(name, result.content);
		const elapsedMs = Date.now() - started;
		const usageText = result.usage?.totalTokens
			? `tokens total=${result.usage.totalTokens}`
			: 'tokens unavailable';
		this.output.appendLine(`[pipeline] ${name} finished in ${elapsedMs}ms (${usageText})`);
		return {
			name,
			content: result.content,
			usageText,
			elapsedMs,
		};
	}

	private async safeRead(name: ArtifactName): Promise<string> {
		if (!(await this.storage.exists(name))) {
			return '';
		}
		return this.storage.readArtifact(name);
	}
}
