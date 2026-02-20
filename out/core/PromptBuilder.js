"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptBuilder = void 0;
class PromptBuilder {
    buildPrompt(task, backlog, contextBundle) {
        const storyInfo = this.findStoryForTask(task.id, backlog);
        const stack = contextBundle?.stackHint ?? 'unknown';
        const buildCommands = this.getBuildCommands(contextBundle);
        const filesToTouch = this.guessFilesToTouch(task, contextBundle);
        const acceptanceCriteria = storyInfo?.acceptanceCriteria ?? [];
        const lines = [];
        lines.push(`# Task Prompt: ${task.id}`);
        lines.push('');
        lines.push('## Context Summary');
        lines.push(`- Stack hint: ${stack}`);
        lines.push(`- Workspace root: ${contextBundle?.rootFolder ?? 'unknown'}`);
        lines.push(`- Backlog generated at: ${backlog.generatedAt}`);
        lines.push('- Top relevant files:');
        for (const file of (contextBundle?.topRelevantFiles ?? []).slice(0, 10)) {
            lines.push(`  - ${file}`);
        }
        if (!contextBundle?.topRelevantFiles?.length) {
            lines.push('  - src/extension.ts');
            lines.push('  - src/ui/DesignStudioPanel.ts');
        }
        lines.push('');
        lines.push('## Objective');
        lines.push(`Implement "${task.id}: ${task.title}".`);
        if (storyInfo) {
            lines.push(`Story: ${storyInfo.storyId} - ${storyInfo.storyTitle}`);
        }
        lines.push('');
        lines.push('## Constraints');
        lines.push('- Only touch files in this repository/workspace.');
        lines.push('- Avoid broad refactors; keep changes focused on this task.');
        lines.push('- Preserve existing behavior unless required by acceptance criteria.');
        lines.push('- Keep naming and code style consistent with surrounding code.');
        lines.push('');
        lines.push('## Implementation Plan Checklist');
        lines.push('- [ ] Inspect current code paths and identify exact files to edit.');
        lines.push('- [ ] Implement the smallest viable change for this task.');
        lines.push('- [ ] Add or update tests where behavior is changed.');
        lines.push('- [ ] Verify build/lint/test commands succeed.');
        lines.push('');
        lines.push('## Acceptance Criteria');
        if (acceptanceCriteria.length === 0) {
            lines.push('- No explicit acceptance criteria found in backlog; infer minimal correctness from task title.');
        }
        else {
            for (const criterion of acceptanceCriteria) {
                lines.push(`- ${criterion}`);
            }
        }
        lines.push('');
        lines.push('## Tests And Commands');
        for (const command of buildCommands) {
            lines.push(`- ${command}`);
        }
        lines.push('');
        lines.push('## Files To Touch (Guessed)');
        for (const file of filesToTouch) {
            lines.push(`- ${file}`);
        }
        lines.push('');
        lines.push('## Definition Of Done');
        lines.push('- Acceptance criteria above are satisfied.');
        lines.push('- Code builds and lint/tests pass for relevant stack commands.');
        lines.push('- Prompt consumer returns:');
        lines.push('  - List of touched files');
        lines.push('  - Brief summary of what changed and why');
        lines.push('');
        lines.push('## Output Requirements');
        lines.push('- Report exactly which files were modified.');
        lines.push('- Provide a concise change summary.');
        lines.push('- Mention any follow-up risks or TODOs.');
        lines.push('');
        return lines.join('\n');
    }
    findStoryForTask(taskId, backlog) {
        for (const epic of backlog.epics) {
            for (const story of epic.stories) {
                if (story.tasks.some((task) => task.id === taskId)) {
                    return {
                        storyId: story.id,
                        storyTitle: story.title,
                        acceptanceCriteria: story.acceptanceCriteria,
                    };
                }
            }
        }
        return undefined;
    }
    getBuildCommands(contextBundle) {
        const candidates = contextBundle?.candidateBuildCommands ?? [];
        if (candidates.length > 0) {
            return candidates;
        }
        return ['npm test', 'npm run build', 'dotnet test', 'dotnet build'];
    }
    guessFilesToTouch(task, contextBundle) {
        const guessed = new Set();
        const relevantFiles = contextBundle?.topRelevantFiles ?? [];
        const lowerTitle = task.title.toLowerCase();
        const pinIfExists = (target) => {
            const match = relevantFiles.find((file) => file.toLowerCase().endsWith(target.toLowerCase()));
            if (match) {
                guessed.add(match);
            }
        };
        pinIfExists('src/extension.ts');
        pinIfExists('src/ui/DesignStudioPanel.ts');
        pinIfExists('src/core/Pipeline.ts');
        pinIfExists('src/core/ArtifactStore.ts');
        pinIfExists('src/core/WorkspaceScanner.ts');
        pinIfExists('README.md');
        for (const file of relevantFiles) {
            if (guessed.size >= 6) {
                break;
            }
            const lower = file.toLowerCase();
            if (lowerTitle.includes('ui') && lower.includes('ui/')) {
                guessed.add(file);
            }
            else if (lowerTitle.includes('command') && lower.includes('extension.ts')) {
                guessed.add(file);
            }
            else if (lowerTitle.includes('artifact') && lower.includes('core/')) {
                guessed.add(file);
            }
            else if (lowerTitle.includes('prompt') && lower.includes('prompt')) {
                guessed.add(file);
            }
        }
        if (guessed.size === 0) {
            guessed.add('src/extension.ts');
            guessed.add('src/ui/DesignStudioPanel.ts');
        }
        return Array.from(guessed).slice(0, 8);
    }
}
exports.PromptBuilder = PromptBuilder;
//# sourceMappingURL=PromptBuilder.js.map