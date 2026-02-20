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
- `Design Addin: Generate Artifacts (OpenAI)` (`designAddin.generateArtifacts`)

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

## LLM Settings

- `designAddin.llm.provider` (`openai`, default `openai`)
- `designAddin.llm.apiKey` (placeholder for future provider integration)

Brief/architecture/backlog/prompts generation uses OpenAI. If `OPENAI_API_KEY` is missing, generation fails with setup guidance:

Windows (PowerShell):

`setx OPENAI_API_KEY "your_key_here"`
`# then restart VS Code`

macOS/Linux (zsh/bash):

`export OPENAI_API_KEY="your_key_here"`
`# launch code from same terminal OR add to ~/.zshrc ~/.bashrc`

VS Code must be restarted after setting env vars in most cases.

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

## OpenAI Artifact Pipeline

`designAddin.generateArtifacts` creates `.design-addin/` artifacts in this order:

1. `idea.md`
2. `brief.md`
3. `architecture.md`
4. `backlog.md`
5. `prompts.md`

The command opens a webview with tabs (`Idea`, `Brief`, `Architecture`, `Backlog`, `Prompts`), supports per-tab regenerate, and copy-to-clipboard.

Required environment variable:

`OPENAI_API_KEY`

Settings:

- `designAddin.openaiModel` (default `gpt-4.1-mini`)
- `designAddin.maxOutputTokens` (default `3000`)

Manual checklist:

1. With `OPENAI_API_KEY` set, run `Design Addin: Generate Artifacts` and verify all `.design-addin/*.md` files exist.
2. Use regenerate on `Architecture` with downstream enabled and verify `architecture.md`, `backlog.md`, `prompts.md` update.
3. Use copy button on any tab and verify clipboard content.
4. Without `OPENAI_API_KEY`, run command and verify modal guidance appears.
5. With no folder open, run command and verify workspace-open fallback behavior.
