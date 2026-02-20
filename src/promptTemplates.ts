export function briefPromptFromIdea(idea: string): string {
	return `SYSTEM:
You are an expert product manager and technical writer. Produce clear, structured output and avoid fluff.
Infer the product domain from the idea and keep all recommendations aligned to that domain.
Do not assume this is a VS Code extension unless the idea explicitly says so.

USER:
Create a product brief for the product described in this idea.

IDEA:
<<<
${idea}
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

export function architecturePromptFromIdeaAndBrief(idea: string, brief: string): string {
	return `SYSTEM:
You are a senior software architect. You design pragmatic architectures with clear module boundaries, data contracts, and implementation details.
Infer the target platform and stack from IDEA and BRIEF.
Do not assume this is a VS Code extension unless the idea explicitly says so.

USER:
Design the technical architecture for the product described in IDEA and BRIEF.

IDEA:
<<<
${idea}
>>>

BRIEF:
<<<
${brief}
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

export function backlogPromptFromInputs(idea: string, brief: string, architecture: string): string {
	return `SYSTEM:
You are a technical product owner. You create backlogs with epics, user stories, acceptance criteria, and implementation notes.
Infer the product domain and implementation stack from IDEA, BRIEF, and ARCHITECTURE.
Do not assume VS Code extension details unless explicitly stated.

USER:
Create an implementation backlog for the product described below.

IDEA:
<<<
${idea}
>>>

BRIEF:
<<<
${brief}
>>>

ARCHITECTURE:
<<<
${architecture}
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

export function promptSetFromBacklogAndArchitecture(backlog: string, architecture: string): string {
	return `SYSTEM:
You are a senior engineer who writes precise implementation prompts for coding agents.
Your prompts must be actionable and reference exact file paths, functions, and test steps.
Infer the stack, runtime, and architecture style from the provided artifacts.
Do not assume VS Code extension conventions unless explicitly stated.

USER:
Generate coding-agent prompts to implement the backlog for the described product.

ARCHITECTURE:
<<<
${architecture}
>>>

BACKLOG:
<<<
${backlog}
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
