"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Pipeline = void 0;
const PromptBuilder_1 = require("./PromptBuilder");
const StubLlmProvider_1 = require("../llm/StubLlmProvider");
const OpenAiPromptTemplates_1 = require("../llm/OpenAiPromptTemplates");
class Pipeline {
    store;
    llmEnabled;
    llmProvider;
    constructor(store, options) {
        this.store = store;
        this.llmEnabled = options?.llmEnabled ?? false;
        this.llmProvider = options?.llmProvider ?? new StubLlmProvider_1.StubLlmProvider(false);
    }
    async newIdea() {
        if (this.llmEnabled) {
            const ideaText = await this.getIdeaText();
            await this.llmProvider.generateJson('idea', (0, OpenAiPromptTemplates_1.buildBriefPrompt)({ idea: ideaText }));
        }
        const artifact = {
            version: 1,
            createdAt: new Date().toISOString(),
            title: 'Design Addin Idea',
            problem: 'Describe the core workflow or pain point this addin should solve.',
            outcome: 'Describe the expected measurable outcome if this succeeds.',
            businessIdea: '',
        };
        return this.store.writeJson('idea.json', artifact);
    }
    async generateBrief() {
        if (this.llmEnabled) {
            const ideaText = await this.getIdeaText();
            await this.llmProvider.generateJson('briefMarkdown', (0, OpenAiPromptTemplates_1.buildBriefPrompt)({ idea: ideaText }));
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
    async generateArchitecture() {
        if (this.llmEnabled) {
            const ideaText = await this.getIdeaText();
            const briefText = await this.readMarkdownIfExists('brief.v1.md');
            await this.llmProvider.generateJson('architectureMarkdown', (0, OpenAiPromptTemplates_1.buildArchitecturePrompt)({ idea: ideaText, brief: briefText }));
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
    async generateBacklog() {
        if (this.llmEnabled) {
            const ideaText = await this.getIdeaText();
            const briefText = await this.readMarkdownIfExists('brief.v1.md');
            const architectureText = await this.readMarkdownIfExists('architecture.v1.md');
            await this.llmProvider.generateJson('backlogMarkdown', (0, OpenAiPromptTemplates_1.buildBacklogPrompt)({ idea: ideaText, brief: briefText, architecture: architectureText }));
        }
        const backlog = {
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
    async generatePromptForTask(taskId, backlog) {
        const task = this.findTaskById(backlog, taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found in backlog.`);
        }
        const contextBundle = await this.tryReadContextBundle();
        if (this.llmEnabled) {
            const architectureText = await this.readMarkdownIfExists('architecture.v1.md');
            const backlogText = await this.readMarkdownIfExists('backlog.v1.md');
            await this.llmProvider.generateJson('promptSetMarkdown', (0, OpenAiPromptTemplates_1.buildPromptSetPrompt)({ idea: '', architecture: architectureText, backlog: backlogText }));
        }
        const promptBuilder = new PromptBuilder_1.PromptBuilder();
        const content = promptBuilder.buildPrompt(task, backlog, contextBundle);
        return this.store.writeMarkdown(`prompts/${taskId}.prompt.md`, content);
    }
    findTaskById(backlog, taskId) {
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
    async tryReadContextBundle() {
        if (!(await this.store.fileExists('contextBundle.json'))) {
            return undefined;
        }
        try {
            return await this.store.readJson('contextBundle.json');
        }
        catch {
            return undefined;
        }
    }
    async readMarkdownIfExists(relativePath) {
        if (!(await this.store.fileExists(relativePath))) {
            return '';
        }
        try {
            return await this.store.readText(relativePath);
        }
        catch {
            return '';
        }
    }
    async getIdeaText() {
        if (!(await this.store.fileExists('idea.json'))) {
            return '';
        }
        try {
            const idea = await this.store.readJson('idea.json');
            return [idea.businessIdea, idea.title, idea.problem, idea.outcome].filter(Boolean).join('\n\n');
        }
        catch {
            return '';
        }
    }
    renderBacklog(backlog) {
        const lines = [];
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
exports.Pipeline = Pipeline;
//# sourceMappingURL=Pipeline.js.map