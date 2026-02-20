"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildBriefPrompt = buildBriefPrompt;
exports.buildArchitecturePrompt = buildArchitecturePrompt;
exports.buildBacklogPrompt = buildBacklogPrompt;
exports.buildPromptSetPrompt = buildPromptSetPrompt;
function buildBriefPrompt(context) {
    return `SYSTEM:
You are an expert product manager and technical writer for developer tools. Produce clear, structured output and avoid fluff.

USER:
Create a product brief for a VS Code extension called "Design Add-in" based on this idea:

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
function buildArchitecturePrompt(context) {
    return `SYSTEM:
You are a senior software architect for VS Code extensions. You design pragmatic architectures with clear module boundaries, data contracts, and implementation details.

USER:
Design the technical architecture for the "Design Add-in" VS Code extension.

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
# API design (extension commands, webview messages, OpenAI client wrapper)
# Security & privacy
# Error handling & observability
# Performance considerations
# Testing strategy
# Incremental delivery plan (phases)`;
}
function buildBacklogPrompt(context) {
    return `SYSTEM:
You are a technical product owner. You create backlogs with epics, user stories, acceptance criteria, and implementation notes.

USER:
Create an implementation backlog for the "Design Add-in" VS Code extension.

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
(List 4–8 epics with goal statements)

# User stories
For each epic, list 4–10 stories. Each story MUST include:
- Story ID (e.g. DA-101)
- Title
- User story sentence
- Acceptance criteria (3–7 bullet points)
- Notes (important edge cases / constraints)
- Test notes (how to verify)

# Milestones
(2–6 milestones mapping story IDs to releases)`;
}
function buildPromptSetPrompt(context) {
    return `SYSTEM:
You are a senior engineer who writes precise implementation prompts for coding agents.
Your prompts must be actionable and reference exact file paths, functions, and test steps.
Assume TypeScript VS Code extension + webview.

USER:
Generate coding-agent prompts to implement the backlog for the "Design Add-in".

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
Create 1 prompt per story (DA-###). Each prompt MUST include:
- Goal
- Files to touch (explicit paths)
- Step-by-step changes
- New types/interfaces/events to add
- Commands/messages to add (VS Code commands + webview message names)
- Logging/error handling requirements
- Tests to add (unit/integration/manual)
- Verification steps

# Integration order
List the recommended order to run the prompts and why.`;
}
//# sourceMappingURL=OpenAiPromptTemplates.js.map