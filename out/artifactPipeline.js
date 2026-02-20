"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArtifactPipeline = void 0;
const promptTemplates_1 = require("./promptTemplates");
class ArtifactPipeline {
    storage;
    client;
    output;
    constructor(storage, client, output) {
        this.storage = storage;
        this.client = client;
        this.output = output;
    }
    async generateAll(idea, onUpdate, progress) {
        const artifacts = {
            idea: idea.trim(),
            brief: '',
            architecture: '',
            backlog: '',
            prompts: '',
        };
        await this.storage.writeArtifact('idea', artifacts.idea);
        onUpdate('idea', artifacts.idea);
        const steps = [
            {
                key: 'brief',
                label: 'Generating brief',
                run: () => this.runStep('brief', (0, promptTemplates_1.briefPromptFromIdea)(artifacts.idea)),
            },
            {
                key: 'architecture',
                label: 'Generating architecture',
                run: () => this.runStep('architecture', (0, promptTemplates_1.architecturePromptFromIdeaAndBrief)(artifacts.idea, artifacts.brief)),
            },
            {
                key: 'backlog',
                label: 'Generating backlog',
                run: () => this.runStep('backlog', (0, promptTemplates_1.backlogPromptFromInputs)(artifacts.idea, artifacts.brief, artifacts.architecture)),
            },
            {
                key: 'prompts',
                label: 'Generating prompt set',
                run: () => this.runStep('prompts', (0, promptTemplates_1.promptSetFromBacklogAndArchitecture)(artifacts.backlog, artifacts.architecture)),
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
    async regenerateFrom(start, onUpdate, includeDownstream) {
        const idea = await this.safeRead('idea');
        const brief = await this.safeRead('brief');
        const architecture = await this.safeRead('architecture');
        const backlog = await this.safeRead('backlog');
        const order = ['brief', 'architecture', 'backlog', 'prompts'];
        const startIndex = order.indexOf(start);
        const selected = includeDownstream ? order.slice(startIndex) : [start];
        let currentBrief = brief;
        let currentArchitecture = architecture;
        let currentBacklog = backlog;
        for (const item of selected) {
            if (item === 'brief') {
                const result = await this.runStep('brief', (0, promptTemplates_1.briefPromptFromIdea)(idea));
                currentBrief = result.content;
                onUpdate('brief', result.content);
                continue;
            }
            if (item === 'architecture') {
                const result = await this.runStep('architecture', (0, promptTemplates_1.architecturePromptFromIdeaAndBrief)(idea, currentBrief));
                currentArchitecture = result.content;
                onUpdate('architecture', result.content);
                continue;
            }
            if (item === 'backlog') {
                const result = await this.runStep('backlog', (0, promptTemplates_1.backlogPromptFromInputs)(idea, currentBrief, currentArchitecture));
                currentBacklog = result.content;
                onUpdate('backlog', result.content);
                continue;
            }
            const result = await this.runStep('prompts', (0, promptTemplates_1.promptSetFromBacklogAndArchitecture)(currentBacklog, currentArchitecture));
            onUpdate('prompts', result.content);
        }
    }
    async runStep(name, prompt) {
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
    async safeRead(name) {
        if (!(await this.storage.exists(name))) {
            return '';
        }
        return this.storage.readArtifact(name);
    }
}
exports.ArtifactPipeline = ArtifactPipeline;
//# sourceMappingURL=artifactPipeline.js.map