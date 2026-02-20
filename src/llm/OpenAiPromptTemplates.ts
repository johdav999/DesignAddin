export interface PromptContext {
	idea: string;
	brief?: string;
	architecture?: string;
	backlog?: string;
}

export interface TaskPromptContext {
	taskId: string;
	taskTitle: string;
	storyId?: string;
	storyTitle?: string;
	acceptanceCriteria: string[];
	architecture: string;
	backlog: string;
	contextSummary: string;
}

export function buildBriefPrompt(context: PromptContext): string {
	return `SYSTEM:
You are an expert product manager and technical writer. Produce clear, structured output and avoid fluff.
Infer the product domain from the idea and keep all recommendations aligned to that domain.
Do not assume this is a VS Code extension unless the idea explicitly says so.

USER:
Create a product brief for the product described in this idea.

IDEA:
<<<
${context.idea}
>>>

Return Markdown with exactly these sections:

# One-liner
# Problem
# Target users & primary persona
# Top use cases (5)
# Functional requirements
# Non-goals
# Quality attributes (NFRs)
# Constraints & assumptions
# Success metrics
# Risks & mitigations
# Open questions`;
}

export function buildArchitecturePrompt(context: PromptContext): string {
	return `SYSTEM:
You are a senior software architect. You design pragmatic architectures with clear module boundaries, data contracts, and implementation details.
Infer the target platform and stack from IDEA and BRIEF.
Do not assume this is a VS Code extension unless the idea explicitly says so.

USER:
Design the technical architecture for the product described in IDEA and BRIEF.

IDEA:
<<<
${context.idea}
>>>

BRIEF:
<<<
${context.brief ?? ''}
>>>

Return Markdown with exactly these sections:

# Architecture overview
# Key decisions
# Components (diagram in text + responsibilities)
# Data model & storage (include persistence choice and schemas)
# Interface design (APIs, commands, events, UI interactions, and integrations as appropriate)
# Security & privacy
# Error handling & observability
# Performance considerations
# Testing strategy
# Incremental delivery plan (phases)`;
}

export function buildBacklogPrompt(context: PromptContext): string {
	return `SYSTEM:
You are a technical product owner. You create backlogs with epics, user stories, acceptance criteria, and implementation notes.
Infer the product domain and implementation stack from IDEA, BRIEF, and ARCHITECTURE.
Do not assume VS Code extension details unless explicitly stated.

USER:
Create an implementation backlog for the product described below.

IDEA:
<<<
${context.idea}
>>>

BRIEF:
<<<
${context.brief ?? ''}
>>>

ARCHITECTURE:
<<<
${context.architecture ?? ''}
>>>

Return Markdown with exactly these sections:

# Epics
(List 4-8 epics with goal statements)

# User stories
For each epic, list 4-10 stories. Each story MUST include:
- Story ID (e.g. ST-101)
- Title
- User story sentence
- Acceptance criteria (3-7 bullet points)
- Notes (important edge cases / constraints)
- Test notes (how to verify)

# Milestones
(2-6 milestones mapping story IDs to releases)`;
}

export function buildPromptSetPrompt(context: PromptContext): string {
	return `SYSTEM:
You are a senior engineer who writes precise implementation prompts for coding agents.
Your prompts must be actionable and reference exact file paths, functions, and test steps.
Infer the stack, runtime, and architecture style from the provided artifacts.
Do not assume VS Code extension conventions unless explicitly stated.

USER:
Generate coding-agent prompts to implement the backlog for the described product.

ARCHITECTURE:
<<<
${context.architecture ?? ''}
>>>

BACKLOG:
<<<
${context.backlog ?? ''}
>>>

Output Markdown with exactly these sections:

# Prompt set
Create 1 prompt per story (ST-### or the story IDs present in BACKLOG). Each prompt MUST include:
- Goal
- Files to touch (explicit paths)
- Step-by-step changes
- New types/interfaces/events to add
- Interfaces/endpoints/commands/events to add (as appropriate for the target domain)
- Logging/error handling requirements
- Tests to add (unit/integration/manual)
- Verification steps

# Integration order
List the recommended order to run the prompts and why.`;
}

export function buildBacklogJsonPrompt(backlogMarkdown: string): string {
	return `Convert the following backlog markdown into strict JSON.

Return ONLY a single \`\`\`json fenced block with this exact shape:
{
  "generatedAt": "ISO-8601 string",
  "epics": [
    {
      "id": "string",
      "title": "string",
      "stories": [
        {
          "id": "string",
          "title": "string",
          "acceptanceCriteria": ["string"],
          "tasks": [
            {
              "id": "string",
              "title": "string",
              "tags": ["string"],
              "status": "todo|in_progress|done",
              "promptPath": null
            }
          ]
        }
      ]
    }
  ]
}

BACKLOG MARKDOWN:
<<<
${backlogMarkdown}
>>>`;
}

export function buildTaskPromptPrompt(context: TaskPromptContext): string {
	const criteria =
		context.acceptanceCriteria.length > 0
			? context.acceptanceCriteria.map((criterion) => `- ${criterion}`).join('\n')
			: '- No explicit acceptance criteria were provided for this story.';

	return `Write a coding-agent implementation prompt for this exact backlog task.

TASK:
- ID: ${context.taskId}
- Title: ${context.taskTitle}
- Story: ${context.storyId ?? 'unknown'} ${context.storyTitle ?? ''}

ACCEPTANCE CRITERIA:
${criteria}

ARCHITECTURE:
<<<
${context.architecture}
>>>

BACKLOG:
<<<
${context.backlog}
>>>

WORKSPACE CONTEXT:
<<<
${context.contextSummary}
>>>

Return Markdown with exactly these sections:
# Goal
# Scope
# Files to touch
# Implementation plan
# Validation steps
# Risks and follow-ups`;
}
