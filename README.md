# Design Addin

MVP VS Code extension scaffold for design-to-execution artifacts stored in `.ai-design/`.

## Commands

- `Design Addin: Open Studio` (`designAddin.openStudio`) opens the **Design Studio** webview panel
- `Design Addin: New Idea` (`designAddin.newIdea`)
- `Design Addin: Generate Brief` (`designAddin.generateBrief`)
- `Design Addin: Generate Architecture` (`designAddin.generateArchitecture`)
- `Design Addin: Generate Backlog` (`designAddin.generateBacklog`)
- `Design Addin: Generate Prompt for Task` (`designAddin.generatePromptForTask`)
- `Design Addin: Run Task with Codex` (`designAddin.runTaskWithCodex`)
- `Design Addin: Rescan Workspace Context` (`designAddin.rescanWorkspaceContext`)

## Artifact Storage

All generated files are stored in `.ai-design/` in the workspace root.

Expected artifacts:
- `.ai-design/contextBundle.json`
- `.ai-design/idea.json`
- `.ai-design/brief.v1.md`
- `.ai-design/architecture.v1.md`
- `.ai-design/backlog.v1.json`
- `.ai-design/backlog.v1.md`
- `.ai-design/prompts/<TASK-ID>.prompt.md`
- `.ai-design/runs/<timestamp>_<TASK-ID>.json`
- `.ai-design/runs/last.json`

## LLM Settings (Stub For Now)

- `designAddin.llm.enabled` (default `false`)
- `designAddin.llm.provider` (`openai` or `stub`, default `stub`)
- `designAddin.llm.apiKey` (placeholder for future provider integration)

Note: real provider calls are not implemented yet. For future implementation, store API keys in VS Code Secret Storage instead of plain settings.

## Run And Test In Extension Development Host

1. Run `npm run compile`.
2. Press `F5` in VS Code to launch Extension Development Host.
3. In the new window, run `Design Addin: Open Studio`.
4. In the sidebar buttons, run `New Idea`, `Generate Brief`, `Generate Architecture`, and `Generate Backlog`.
5. Verify files are created/updated under `.ai-design/` and the panel refreshes artifacts/backlog.
6. In `Backlog` tab, click a task. Then use `Prompts` button to generate/refresh prompt files and verify `.ai-design/prompts/<TASK-ID>.prompt.md`.
7. In `Backlog` tab, select a task and click `Run with Codex` (or use `Design Addin: Run Task with Codex` from Command Palette).
8. Verify `.ai-design/runs/last.json` and a timestamped run log file are created.
9. In `Run Logs` tab, verify last run metadata is shown and `Open Run Log` opens the file.

### Simulate without Codex CLI installed

1. Run `Run with Codex` anyway.
2. Confirm run metadata files are still written under `.ai-design/runs/`.
3. Check the `Codex` terminal to see the shell error (`codex` command not found), which is expected for this simulation.
