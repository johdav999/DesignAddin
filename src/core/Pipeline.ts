import * as vscode from 'vscode';
import { ArtifactStore } from './ArtifactStore';
import { PromptBuilder } from './PromptBuilder';
import { ContextBundle } from './WorkspaceScanner';
import { ILlmProvider } from '../llm/ILlmProvider';
import { StubLlmProvider } from '../llm/StubLlmProvider';

export interface BacklogTask {
	id: string;
	title: string;
	tags: string[];
	status: 'todo' | 'in_progress' | 'done';
	promptPath: string | null;
}

export interface BacklogStory {
	id: string;
	title: string;
	tasks: BacklogTask[];
	acceptanceCriteria: string[];
}

export interface BacklogEpic {
	id: string;
	title: string;
	stories: BacklogStory[];
}

export interface Backlog {
	version: 1;
	generatedAt: string;
	epics: BacklogEpic[];
}

interface IdeaArtifact {
	version: 1;
	createdAt: string;
	title: string;
	problem: string;
	outcome: string;
	businessIdea: string;
}

interface PipelineOptions {
	llmEnabled: boolean;
	llmProvider: ILlmProvider;
}

export class Pipeline {
	private readonly llmEnabled: boolean;
	private readonly llmProvider: ILlmProvider;

	constructor(private readonly store: ArtifactStore, options?: Partial<PipelineOptions>) {
		this.llmEnabled = options?.llmEnabled ?? false;
		this.llmProvider = options?.llmProvider ?? new StubLlmProvider(false);
	}

	public async newIdea(): Promise<vscode.Uri> {
		if (this.llmEnabled) {
			await this.llmProvider.generateJson<IdeaArtifact>('idea', 'Generate idea artifact JSON');
		}

		const artifact: IdeaArtifact = {
			version: 1,
			createdAt: new Date().toISOString(),
			title: 'Design Addin Idea',
			problem: 'Describe the core workflow or pain point this addin should solve.',
			outcome: 'Describe the expected measurable outcome if this succeeds.',
			businessIdea: '',
		};
		return this.store.writeJson('idea.json', artifact);
	}

	public async generateBrief(): Promise<vscode.Uri> {
		if (this.llmEnabled) {
			await this.llmProvider.generateJson<{ markdown: string }>('brief', 'Generate product brief markdown');
		}

		const content = `# Product Brief v1

## Problem
Placeholder: summarize the user problem and why it matters.

## Users
Placeholder: describe primary users and key jobs-to-be-done.

## Goals
- Placeholder goal 1
- Placeholder goal 2

## Non-Goals
- Placeholder non-goal 1

## Success Metrics
- Placeholder metric 1
`;
		return this.store.writeMarkdown('brief.v1.md', content);
	}

	public async generateArchitecture(): Promise<vscode.Uri> {
		if (this.llmEnabled) {
			await this.llmProvider.generateJson<{ markdown: string }>('architecture', 'Generate architecture markdown');
		}

		const content = `# Architecture v1

## System Overview
Placeholder: describe extension-host modules and artifact flow.

## Components
- Artifact Store
- Workspace Scanner
- Pipeline
- Command Handlers

## Data Contracts
Placeholder: define key file formats under \`.ai-design/\`.

## Risks
- Placeholder technical risk
- Placeholder delivery risk
`;
		return this.store.writeMarkdown('architecture.v1.md', content);
	}

	public async generateBacklog(): Promise<{ jsonUri: vscode.Uri; markdownUri: vscode.Uri }> {
		if (this.llmEnabled) {
			await this.llmProvider.generateJson<Backlog>('backlog', 'Generate backlog JSON');
		}

		const backlog: Backlog = {
			version: 1,
			generatedAt: new Date().toISOString(),
			epics: [
				{
					id: 'EPIC-1',
					title: 'MVP Extension Workflow',
					stories: [
						{
							id: 'STORY-1',
							title: 'Generate core artifacts',
							acceptanceCriteria: [
								'Commands create files under .ai-design/',
								'Backlog is available as JSON and Markdown',
							],
							tasks: [
								{
									id: 'TASK-1',
									title: 'Implement artifact storage utilities',
									tags: ['BE'],
									status: 'todo',
									promptPath: null,
								},
								{
									id: 'TASK-2',
									title: 'Wire command handlers in extension activation',
									tags: ['BE'],
									status: 'todo',
									promptPath: null,
								},
							],
						},
						{
							id: 'STORY-2',
							title: 'Support task-level prompt generation',
							acceptanceCriteria: [
								'User can select a task from Quick Pick',
								'Prompt template is created for selected task',
							],
							tasks: [
								{
									id: 'TASK-3',
									title: 'Generate prompt file for backlog task',
									tags: ['FE', 'BE'],
									status: 'todo',
									promptPath: null,
								},
							],
						},
					],
				},
			],
		};

		const jsonUri = await this.store.writeJson('backlog.v1.json', backlog);
		const markdownUri = await this.store.writeMarkdown('backlog.v1.md', this.renderBacklog(backlog));
		return { jsonUri, markdownUri };
	}

	public async generatePromptForTask(taskId: string, backlog: Backlog): Promise<vscode.Uri> {
		const task = this.findTaskById(backlog, taskId);
		if (!task) {
			throw new Error(`Task ${taskId} not found in backlog.`);
		}

		const contextBundle = await this.tryReadContextBundle();
		if (this.llmEnabled) {
			await this.llmProvider.generateJson<{ markdown: string }>(
				'taskPrompt',
				`Generate prompt markdown for task ${taskId}`
			);
		}
		const promptBuilder = new PromptBuilder();
		const content = promptBuilder.buildPrompt(task, backlog, contextBundle);
		return this.store.writeMarkdown(`prompts/${taskId}.prompt.md`, content);
	}

	private findTaskById(backlog: Backlog, taskId: string): BacklogTask | undefined {
		for (const epic of backlog.epics) {
			for (const story of epic.stories) {
				for (const task of story.tasks) {
					if (task.id === taskId) {
						return task;
					}
				}
			}
		}
		return undefined;
	}

	private async tryReadContextBundle(): Promise<ContextBundle | undefined> {
		if (!(await this.store.fileExists('contextBundle.json'))) {
			return undefined;
		}
		try {
			return await this.store.readJson<ContextBundle>('contextBundle.json');
		} catch {
			return undefined;
		}
	}

	private renderBacklog(backlog: Backlog): string {
		const lines: string[] = [];
		lines.push('# Backlog v1');
		lines.push('');
		lines.push(`Generated: ${backlog.generatedAt}`);
		lines.push('');

		for (const epic of backlog.epics) {
			lines.push(`## ${epic.id}: ${epic.title}`);
			lines.push('');
			for (const story of epic.stories) {
				lines.push(`### ${story.id}: ${story.title}`);
				lines.push('');
				lines.push('Acceptance Criteria:');
				for (const criterion of story.acceptanceCriteria) {
					lines.push(`- ${criterion}`);
				}
				lines.push('');
				lines.push('Tasks:');
				for (const task of story.tasks) {
					const tags = task.tags.join(', ');
					lines.push(`- ${task.id} | ${task.title} | status=${task.status} | tags=${tags}`);
				}
				lines.push('');
			}
		}

		return lines.join('\n');
	}
}
