import * as vscode from 'vscode';
import { ArtifactStore } from './ArtifactStore';
import { ContextBundle } from './WorkspaceScanner';
import { ILlmProvider } from '../llm/ILlmProvider';
import {
	buildArchitecturePrompt,
	buildBacklogJsonPrompt,
	buildBacklogPrompt,
	buildBriefPrompt,
	buildTaskPromptPrompt,
} from '../llm/OpenAiPromptTemplates';

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
	llmProvider: ILlmProvider;
	outputChannel?: vscode.OutputChannel;
}

export class Pipeline {
	private readonly llmProvider: ILlmProvider;
	private readonly outputChannel: vscode.OutputChannel | undefined;

	constructor(private readonly store: ArtifactStore, options: PipelineOptions) {
		this.llmProvider = options.llmProvider;
		this.outputChannel = options.outputChannel;
	}

	public async newIdea(): Promise<vscode.Uri> {
		const artifact: IdeaArtifact = {
			version: 1,
			createdAt: new Date().toISOString(),
			title: 'Business Idea',
			problem: 'Describe the core workflow or pain point this product should solve.',
			outcome: 'Describe the expected measurable outcome if this succeeds.',
			businessIdea: '',
		};
		return this.store.writeJson('idea.json', artifact);
	}

	public async generateBrief(): Promise<vscode.Uri> {
		const started = Date.now();
		this.logStage('brief', 'start');
		try {
			const ideaText = await this.getIdeaText();
			this.logStage('brief', `idea input loaded (${ideaText.length} chars)`);
			const prompt = buildBriefPrompt({ idea: ideaText });
			this.logStage('brief', `requesting LLM markdown (${prompt.length} prompt chars)`);
			const result = await this.llmProvider.generateJson<{ markdown: string }>('briefMarkdown', prompt);
			const content = this.requireMarkdown(result?.markdown, 'brief');
			this.logStage('brief', `writing .ai-design/brief.v1.md (${content.length} chars)`);
			const uri = await this.store.writeMarkdown('brief.v1.md', content);
			this.logStage('brief', `done in ${Date.now() - started}ms (${uri.fsPath})`);
			return uri;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logStage('brief', `failed: ${message}`);
			throw error;
		}
	}

	public async generateArchitecture(): Promise<vscode.Uri> {
		this.logStage('architecture', 'start');
		const ideaText = await this.getIdeaText();
		const briefText = await this.readMarkdownIfExists('brief.v1.md');
		const prompt = buildArchitecturePrompt({ idea: ideaText, brief: briefText });
		this.logStage('architecture', `requesting LLM markdown (${prompt.length} prompt chars)`);
		const result = await this.llmProvider.generateJson<{ markdown: string }>('architectureMarkdown', prompt);
		const content = this.requireMarkdown(result?.markdown, 'architecture');
		this.logStage('architecture', `writing .ai-design/architecture.v1.md (${content.length} chars)`);
		return this.store.writeMarkdown('architecture.v1.md', content);
	}

	public async generateBacklog(): Promise<{ jsonUri: vscode.Uri; markdownUri: vscode.Uri }> {
		this.logStage('backlog', 'start');
		const ideaText = await this.getIdeaText();
		const briefText = await this.readMarkdownIfExists('brief.v1.md');
		const architectureText = await this.readMarkdownIfExists('architecture.v1.md');

		const markdownPrompt = buildBacklogPrompt({ idea: ideaText, brief: briefText, architecture: architectureText });
		this.logStage('backlog', `requesting markdown (${markdownPrompt.length} prompt chars)`);
		const markdownResult = await this.llmProvider.generateJson<{ markdown: string }>('backlogMarkdown', markdownPrompt);
		const backlogMarkdown = this.requireMarkdown(markdownResult?.markdown, 'backlog');
		const markdownUri = await this.store.writeMarkdown('backlog.v1.md', backlogMarkdown);
		this.logStage('backlog', `wrote backlog markdown (${backlogMarkdown.length} chars)`);

		const jsonPrompt = buildBacklogJsonPrompt(backlogMarkdown);
		this.logStage('backlog', `requesting JSON conversion (${jsonPrompt.length} prompt chars)`);
		const jsonResult = await this.llmProvider.generateJson<{ markdown: string }>('backlogJson', jsonPrompt);
		const backlogJsonText = this.requireMarkdown(jsonResult?.markdown, 'backlog json');
		const backlog = this.parseBacklogFromMarkdownResponse(backlogJsonText);
		const jsonUri = await this.store.writeJson('backlog.v1.json', backlog);
		this.logStage('backlog', `wrote backlog json with ${backlog.epics.length} epics`);
		return { jsonUri, markdownUri };
	}

	public async generatePromptForTask(taskId: string, backlog: Backlog): Promise<vscode.Uri> {
		const task = this.findTaskById(backlog, taskId);
		if (!task) {
			throw new Error(`Task ${taskId} not found in backlog.`);
		}

		const story = this.findStoryForTask(backlog, taskId);
		const contextBundle = await this.tryReadContextBundle();
		const architectureText = await this.readMarkdownIfExists('architecture.v1.md');
		const backlogText = await this.readMarkdownIfExists('backlog.v1.md');
		const prompt = buildTaskPromptPrompt({
			taskId: task.id,
			taskTitle: task.title,
			storyId: story?.id,
			storyTitle: story?.title,
			acceptanceCriteria: story?.acceptanceCriteria ?? [],
			architecture: architectureText,
			backlog: backlogText,
			contextSummary: this.buildContextSummary(contextBundle),
		});

		this.logStage('prompts', `requesting prompt for ${task.id} (${prompt.length} prompt chars)`);
		const result = await this.llmProvider.generateJson<{ markdown: string }>('promptTaskMarkdown', prompt);
		const content = this.requireMarkdown(result?.markdown, `prompt for ${task.id}`);
		this.logStage('prompts', `writing .ai-design/prompts/${taskId}.prompt.md (${content.length} chars)`);
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

	private findStoryForTask(backlog: Backlog, taskId: string): BacklogStory | undefined {
		for (const epic of backlog.epics) {
			for (const story of epic.stories) {
				for (const task of story.tasks) {
					if (task.id === taskId) {
						return story;
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

	private async readMarkdownIfExists(relativePath: string): Promise<string> {
		if (!(await this.store.fileExists(relativePath))) {
			return '';
		}
		try {
			return await this.store.readText(relativePath);
		} catch {
			return '';
		}
	}

	private async getIdeaText(): Promise<string> {
		if (!(await this.store.fileExists('idea.json'))) {
			return '';
		}
		try {
			const idea = await this.store.readJson<{
				title?: string;
				problem?: string;
				outcome?: string;
				businessIdea?: string;
			}>('idea.json');
			const businessIdea = idea.businessIdea?.trim() ?? '';
			if (businessIdea) {
				return businessIdea;
			}

			const ignoredDefaults = new Set([
				'Design Addin Idea',
				'Business Idea',
				'Describe the core workflow or pain point this addin should solve.',
				'Describe the core workflow or pain point this product should solve.',
				'Describe the expected measurable outcome if this succeeds.',
			]);
			const fallbackParts = [idea.title, idea.problem, idea.outcome]
				.map((value) => value?.trim() ?? '')
				.filter((value) => value && !ignoredDefaults.has(value));

			return fallbackParts.join('\n\n');
		} catch {
			return '';
		}
	}

	private requireMarkdown(markdown: string | undefined, artifactName: string): string {
		const content = markdown?.trim() ?? '';
		if (!content) {
			throw new Error(`OpenAI returned empty content for ${artifactName}`);
		}
		return content;
	}

	private buildContextSummary(contextBundle?: ContextBundle): string {
		if (!contextBundle) {
			return 'No workspace context bundle found.';
		}

		const lines: string[] = [];
		lines.push(`Workspace root: ${contextBundle.rootFolder}`);
		lines.push(`Stack hint: ${contextBundle.stackHint}`);
		lines.push('Top relevant files:');
		for (const file of contextBundle.topRelevantFiles.slice(0, 25)) {
			lines.push(`- ${file}`);
		}
		lines.push('Candidate build commands:');
		for (const command of contextBundle.candidateBuildCommands.slice(0, 10)) {
			lines.push(`- ${command}`);
		}
		return lines.join('\n');
	}

	private parseBacklogFromMarkdownResponse(markdown: string): Backlog {
		const payload = this.extractJsonPayload(markdown);
		let parsed: unknown;
		try {
			parsed = JSON.parse(payload);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`Failed to parse backlog JSON from OpenAI output: ${message}`);
		}

		const root = this.asRecord(parsed);
		if (!root) {
			throw new Error('Backlog JSON root is not an object.');
		}

		const epicsRaw = Array.isArray(root.epics) ? root.epics : [];
		const epics = epicsRaw
			.map((epic, index) => this.normalizeEpic(epic, index))
			.filter((epic): epic is BacklogEpic => epic !== undefined);

		if (epics.length === 0) {
			throw new Error('Backlog JSON did not contain any valid epics.');
		}

		const generatedAt =
			typeof root.generatedAt === 'string' && root.generatedAt.trim().length > 0
				? root.generatedAt
				: new Date().toISOString();

		return {
			version: 1,
			generatedAt,
			epics,
		};
	}

	private extractJsonPayload(markdown: string): string {
		const direct = markdown.trim();
		if (direct.startsWith('{') && direct.endsWith('}')) {
			return direct;
		}

		const fenced = markdown.match(/```json\s*([\s\S]*?)```/i);
		if (fenced?.[1]) {
			return fenced[1].trim();
		}

		const genericFenced = markdown.match(/```\s*([\s\S]*?)```/i);
		if (genericFenced?.[1]) {
			return genericFenced[1].trim();
		}

		const firstObjectStart = markdown.indexOf('{');
		const lastObjectEnd = markdown.lastIndexOf('}');
		if (firstObjectStart !== -1 && lastObjectEnd > firstObjectStart) {
			return markdown.slice(firstObjectStart, lastObjectEnd + 1).trim();
		}

		throw new Error('No JSON payload found in backlog conversion output.');
	}

	private normalizeEpic(value: unknown, index: number): BacklogEpic | undefined {
		const record = this.asRecord(value);
		if (!record) {
			return undefined;
		}

		const storiesRaw = Array.isArray(record.stories) ? record.stories : [];
		const stories = storiesRaw
			.map((story, storyIndex) => this.normalizeStory(story, index, storyIndex))
			.filter((story): story is BacklogStory => story !== undefined);

		if (stories.length === 0) {
			return undefined;
		}

		return {
			id: this.asNonEmptyString(record.id) ?? `EPIC-${index + 1}`,
			title: this.asNonEmptyString(record.title) ?? `Epic ${index + 1}`,
			stories,
		};
	}

	private normalizeStory(value: unknown, epicIndex: number, storyIndex: number): BacklogStory | undefined {
		const record = this.asRecord(value);
		if (!record) {
			return undefined;
		}

		const tasksRaw = Array.isArray(record.tasks) ? record.tasks : [];
		const tasks = tasksRaw
			.map((task, taskIndex) => this.normalizeTask(task, epicIndex, storyIndex, taskIndex))
			.filter((task): task is BacklogTask => task !== undefined);

		if (tasks.length === 0) {
			return undefined;
		}

		const acceptanceCriteria = Array.isArray(record.acceptanceCriteria)
			? record.acceptanceCriteria
					.filter((criterion): criterion is string => typeof criterion === 'string')
					.map((criterion) => criterion.trim())
					.filter((criterion) => criterion.length > 0)
			: [];

		return {
			id: this.asNonEmptyString(record.id) ?? `STORY-${epicIndex + 1}-${storyIndex + 1}`,
			title: this.asNonEmptyString(record.title) ?? `Story ${epicIndex + 1}.${storyIndex + 1}`,
			acceptanceCriteria,
			tasks,
		};
	}

	private normalizeTask(value: unknown, epicIndex: number, storyIndex: number, taskIndex: number): BacklogTask | undefined {
		const record = this.asRecord(value);
		if (!record) {
			return undefined;
		}

		const tags = Array.isArray(record.tags)
			? record.tags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean)
			: [];

		const statusRaw = this.asNonEmptyString(record.status);
		const status: BacklogTask['status'] =
			statusRaw === 'done' || statusRaw === 'in_progress' ? statusRaw : 'todo';

		return {
			id: this.asNonEmptyString(record.id) ?? `TASK-${epicIndex + 1}-${storyIndex + 1}-${taskIndex + 1}`,
			title: this.asNonEmptyString(record.title) ?? `Task ${epicIndex + 1}.${storyIndex + 1}.${taskIndex + 1}`,
			tags,
			status,
			promptPath: null,
		};
	}

	private asRecord(value: unknown): Record<string, unknown> | undefined {
		if (!value || typeof value !== 'object' || Array.isArray(value)) {
			return undefined;
		}
		return value as Record<string, unknown>;
	}

	private asNonEmptyString(value: unknown): string | undefined {
		if (typeof value !== 'string') {
			return undefined;
		}
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : undefined;
	}

	private logStage(stage: string, message: string): void {
		this.outputChannel?.appendLine(`[${stage}] ${new Date().toISOString()} ${message}`);
	}
}
