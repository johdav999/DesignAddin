"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode5 = __toESM(require("vscode"));

// src/core/ArtifactStore.ts
var vscode = __toESM(require("vscode"));
var ArtifactStore = class {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.designFolderUri = vscode.Uri.joinPath(this.workspaceRoot, ".ai-design");
  }
  designFolderUri;
  getDesignFolderUri() {
    return this.designFolderUri;
  }
  async ensureDesignFolder() {
    await vscode.workspace.fs.createDirectory(this.designFolderUri);
  }
  async writeJson(relativePath, data) {
    const uri = this.resolveDesignPath(relativePath);
    await this.ensureParentDirectory(uri);
    const content = JSON.stringify(data, null, 2);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf8"));
    return uri;
  }
  async readJson(relativePath) {
    const uri = this.resolveDesignPath(relativePath);
    const bytes = await vscode.workspace.fs.readFile(uri);
    return JSON.parse(Buffer.from(bytes).toString("utf8"));
  }
  async readText(relativePath) {
    const uri = this.resolveDesignPath(relativePath);
    const bytes = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(bytes).toString("utf8");
  }
  async writeMarkdown(relativePath, content) {
    const uri = this.resolveDesignPath(relativePath);
    await this.ensureParentDirectory(uri);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf8"));
    return uri;
  }
  async fileExists(relativePath) {
    const uri = this.resolveDesignPath(relativePath);
    try {
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }
  resolveDesignPath(relativePath) {
    const segments = relativePath.split("/").filter(Boolean);
    return vscode.Uri.joinPath(this.designFolderUri, ...segments);
  }
  async ensureParentDirectory(uri) {
    const pathParts = uri.path.split("/");
    pathParts.pop();
    const parentUri = uri.with({ path: pathParts.join("/") });
    await vscode.workspace.fs.createDirectory(parentUri);
  }
};

// src/core/PromptBuilder.ts
var PromptBuilder = class {
  buildPrompt(task, backlog, contextBundle) {
    const storyInfo = this.findStoryForTask(task.id, backlog);
    const stack = contextBundle?.stackHint ?? "unknown";
    const buildCommands = this.getBuildCommands(contextBundle);
    const filesToTouch = this.guessFilesToTouch(task, contextBundle);
    const acceptanceCriteria = storyInfo?.acceptanceCriteria ?? [];
    const lines = [];
    lines.push(`# Task Prompt: ${task.id}`);
    lines.push("");
    lines.push("## Context Summary");
    lines.push(`- Stack hint: ${stack}`);
    lines.push(`- Workspace root: ${contextBundle?.rootFolder ?? "unknown"}`);
    lines.push(`- Backlog generated at: ${backlog.generatedAt}`);
    lines.push("- Top relevant files:");
    for (const file of (contextBundle?.topRelevantFiles ?? []).slice(0, 10)) {
      lines.push(`  - ${file}`);
    }
    if (!contextBundle?.topRelevantFiles?.length) {
      lines.push("  - src/extension.ts");
      lines.push("  - src/ui/DesignStudioPanel.ts");
    }
    lines.push("");
    lines.push("## Objective");
    lines.push(`Implement "${task.id}: ${task.title}".`);
    if (storyInfo) {
      lines.push(`Story: ${storyInfo.storyId} - ${storyInfo.storyTitle}`);
    }
    lines.push("");
    lines.push("## Constraints");
    lines.push("- Only touch files in this repository/workspace.");
    lines.push("- Avoid broad refactors; keep changes focused on this task.");
    lines.push("- Preserve existing behavior unless required by acceptance criteria.");
    lines.push("- Keep naming and code style consistent with surrounding code.");
    lines.push("");
    lines.push("## Implementation Plan Checklist");
    lines.push("- [ ] Inspect current code paths and identify exact files to edit.");
    lines.push("- [ ] Implement the smallest viable change for this task.");
    lines.push("- [ ] Add or update tests where behavior is changed.");
    lines.push("- [ ] Verify build/lint/test commands succeed.");
    lines.push("");
    lines.push("## Acceptance Criteria");
    if (acceptanceCriteria.length === 0) {
      lines.push("- No explicit acceptance criteria found in backlog; infer minimal correctness from task title.");
    } else {
      for (const criterion of acceptanceCriteria) {
        lines.push(`- ${criterion}`);
      }
    }
    lines.push("");
    lines.push("## Tests And Commands");
    for (const command of buildCommands) {
      lines.push(`- ${command}`);
    }
    lines.push("");
    lines.push("## Files To Touch (Guessed)");
    for (const file of filesToTouch) {
      lines.push(`- ${file}`);
    }
    lines.push("");
    lines.push("## Definition Of Done");
    lines.push("- Acceptance criteria above are satisfied.");
    lines.push("- Code builds and lint/tests pass for relevant stack commands.");
    lines.push("- Prompt consumer returns:");
    lines.push("  - List of touched files");
    lines.push("  - Brief summary of what changed and why");
    lines.push("");
    lines.push("## Output Requirements");
    lines.push("- Report exactly which files were modified.");
    lines.push("- Provide a concise change summary.");
    lines.push("- Mention any follow-up risks or TODOs.");
    lines.push("");
    return lines.join("\n");
  }
  findStoryForTask(taskId, backlog) {
    for (const epic of backlog.epics) {
      for (const story of epic.stories) {
        if (story.tasks.some((task) => task.id === taskId)) {
          return {
            storyId: story.id,
            storyTitle: story.title,
            acceptanceCriteria: story.acceptanceCriteria
          };
        }
      }
    }
    return void 0;
  }
  getBuildCommands(contextBundle) {
    const candidates = contextBundle?.candidateBuildCommands ?? [];
    if (candidates.length > 0) {
      return candidates;
    }
    return ["npm test", "npm run build", "dotnet test", "dotnet build"];
  }
  guessFilesToTouch(task, contextBundle) {
    const guessed = /* @__PURE__ */ new Set();
    const relevantFiles = contextBundle?.topRelevantFiles ?? [];
    const lowerTitle = task.title.toLowerCase();
    const pinIfExists = (target) => {
      const match = relevantFiles.find((file) => file.toLowerCase().endsWith(target.toLowerCase()));
      if (match) {
        guessed.add(match);
      }
    };
    pinIfExists("src/extension.ts");
    pinIfExists("src/ui/DesignStudioPanel.ts");
    pinIfExists("src/core/Pipeline.ts");
    pinIfExists("src/core/ArtifactStore.ts");
    pinIfExists("src/core/WorkspaceScanner.ts");
    pinIfExists("README.md");
    for (const file of relevantFiles) {
      if (guessed.size >= 6) {
        break;
      }
      const lower = file.toLowerCase();
      if (lowerTitle.includes("ui") && lower.includes("ui/")) {
        guessed.add(file);
      } else if (lowerTitle.includes("command") && lower.includes("extension.ts")) {
        guessed.add(file);
      } else if (lowerTitle.includes("artifact") && lower.includes("core/")) {
        guessed.add(file);
      } else if (lowerTitle.includes("prompt") && lower.includes("prompt")) {
        guessed.add(file);
      }
    }
    if (guessed.size === 0) {
      guessed.add("src/extension.ts");
      guessed.add("src/ui/DesignStudioPanel.ts");
    }
    return Array.from(guessed).slice(0, 8);
  }
};

// src/llm/StubLlmProvider.ts
var StubLlmProvider = class {
  constructor(enabled) {
    this.enabled = enabled;
  }
  async generateJson(_schemaName, _prompt) {
    if (!this.enabled) {
      throw new Error("LLM not configured");
    }
    throw new Error("LLM provider not implemented yet");
  }
};

// src/core/Pipeline.ts
var Pipeline = class {
  constructor(store, options) {
    this.store = store;
    this.llmEnabled = options?.llmEnabled ?? false;
    this.llmProvider = options?.llmProvider ?? new StubLlmProvider(false);
  }
  llmEnabled;
  llmProvider;
  async newIdea() {
    if (this.llmEnabled) {
      await this.llmProvider.generateJson("idea", "Generate idea artifact JSON");
    }
    const artifact = {
      version: 1,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      title: "Design Addin Idea",
      problem: "Describe the core workflow or pain point this addin should solve.",
      outcome: "Describe the expected measurable outcome if this succeeds.",
      businessIdea: ""
    };
    return this.store.writeJson("idea.json", artifact);
  }
  async generateBrief() {
    if (this.llmEnabled) {
      await this.llmProvider.generateJson("brief", "Generate product brief markdown");
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
    return this.store.writeMarkdown("brief.v1.md", content);
  }
  async generateArchitecture() {
    if (this.llmEnabled) {
      await this.llmProvider.generateJson("architecture", "Generate architecture markdown");
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
    return this.store.writeMarkdown("architecture.v1.md", content);
  }
  async generateBacklog() {
    if (this.llmEnabled) {
      await this.llmProvider.generateJson("backlog", "Generate backlog JSON");
    }
    const backlog = {
      version: 1,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      epics: [
        {
          id: "EPIC-1",
          title: "MVP Extension Workflow",
          stories: [
            {
              id: "STORY-1",
              title: "Generate core artifacts",
              acceptanceCriteria: [
                "Commands create files under .ai-design/",
                "Backlog is available as JSON and Markdown"
              ],
              tasks: [
                {
                  id: "TASK-1",
                  title: "Implement artifact storage utilities",
                  tags: ["BE"],
                  status: "todo",
                  promptPath: null
                },
                {
                  id: "TASK-2",
                  title: "Wire command handlers in extension activation",
                  tags: ["BE"],
                  status: "todo",
                  promptPath: null
                }
              ]
            },
            {
              id: "STORY-2",
              title: "Support task-level prompt generation",
              acceptanceCriteria: [
                "User can select a task from Quick Pick",
                "Prompt template is created for selected task"
              ],
              tasks: [
                {
                  id: "TASK-3",
                  title: "Generate prompt file for backlog task",
                  tags: ["FE", "BE"],
                  status: "todo",
                  promptPath: null
                }
              ]
            }
          ]
        }
      ]
    };
    const jsonUri = await this.store.writeJson("backlog.v1.json", backlog);
    const markdownUri = await this.store.writeMarkdown("backlog.v1.md", this.renderBacklog(backlog));
    return { jsonUri, markdownUri };
  }
  async generatePromptForTask(taskId, backlog) {
    const task = this.findTaskById(backlog, taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found in backlog.`);
    }
    const contextBundle = await this.tryReadContextBundle();
    if (this.llmEnabled) {
      await this.llmProvider.generateJson(
        "taskPrompt",
        `Generate prompt markdown for task ${taskId}`
      );
    }
    const promptBuilder = new PromptBuilder();
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
    return void 0;
  }
  async tryReadContextBundle() {
    if (!await this.store.fileExists("contextBundle.json")) {
      return void 0;
    }
    try {
      return await this.store.readJson("contextBundle.json");
    } catch {
      return void 0;
    }
  }
  renderBacklog(backlog) {
    const lines = [];
    lines.push("# Backlog v1");
    lines.push("");
    lines.push(`Generated: ${backlog.generatedAt}`);
    lines.push("");
    for (const epic of backlog.epics) {
      lines.push(`## ${epic.id}: ${epic.title}`);
      lines.push("");
      for (const story of epic.stories) {
        lines.push(`### ${story.id}: ${story.title}`);
        lines.push("");
        lines.push("Acceptance Criteria:");
        for (const criterion of story.acceptanceCriteria) {
          lines.push(`- ${criterion}`);
        }
        lines.push("");
        lines.push("Tasks:");
        for (const task of story.tasks) {
          const tags = task.tags.join(", ");
          lines.push(`- ${task.id} | ${task.title} | status=${task.status} | tags=${tags}`);
        }
        lines.push("");
      }
    }
    return lines.join("\n");
  }
};

// src/core/WorkspaceScanner.ts
var vscode2 = __toESM(require("vscode"));
var WorkspaceScanner = class {
  constructor(workspaceRoot, store) {
    this.workspaceRoot = workspaceRoot;
    this.store = store;
  }
  async scanAndStoreContextBundle() {
    const [readmeFiles, packageJsonFiles, csprojFiles, solutionFiles, tsConfigFiles, extensionFiles, allFiles] = await Promise.all([
      this.findRelativePaths("**/README.md"),
      this.findRelativePaths("**/package.json"),
      this.findRelativePaths("**/*.csproj"),
      this.findRelativePaths("**/*.sln"),
      this.findRelativePaths("**/tsconfig.json"),
      this.findRelativePaths("**/extension.ts"),
      this.findRelativePaths("**/*", 400)
    ]);
    const stackHint = this.detectStackHint(packageJsonFiles, csprojFiles, solutionFiles);
    const contextBundle = {
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      rootFolder: this.workspaceRoot.fsPath,
      readmeFiles,
      packageJsonFiles,
      csprojFiles,
      solutionFiles,
      stackHint,
      candidateBuildCommands: this.getCandidateBuildCommands(stackHint),
      topRelevantFiles: this.buildTopRelevantFiles({
        allFiles,
        readmeFiles,
        packageJsonFiles,
        tsConfigFiles,
        extensionFiles,
        csprojFiles,
        solutionFiles
      })
    };
    return this.store.writeJson("contextBundle.json", contextBundle);
  }
  async findRelativePaths(globPattern, maxResults = 20) {
    const files = await vscode2.workspace.findFiles(
      new vscode2.RelativePattern(this.workspaceRoot, globPattern),
      "**/{node_modules,dist,out,.git}/**",
      maxResults
    );
    return files.map((uri) => vscode2.workspace.asRelativePath(uri, false));
  }
  detectStackHint(packageJsonFiles, csprojFiles, solutionFiles) {
    const hasNode = packageJsonFiles.length > 0;
    const hasDotNet = csprojFiles.length > 0 || solutionFiles.length > 0;
    if (hasNode && hasDotNet) {
      return "mixed";
    }
    if (hasNode) {
      return "node";
    }
    if (hasDotNet) {
      return ".net";
    }
    return "unknown";
  }
  getCandidateBuildCommands(stackHint) {
    switch (stackHint) {
      case "node":
        return ["npm test", "npm run build"];
      case ".net":
        return ["dotnet test", "dotnet build"];
      case "mixed":
        return ["npm test", "npm run build", "dotnet test", "dotnet build"];
      default:
        return ["npm test", "npm run build", "dotnet test", "dotnet build"];
    }
  }
  buildTopRelevantFiles(input) {
    const priorities = /* @__PURE__ */ new Map();
    const add = (file, score) => {
      const existing = priorities.get(file) ?? -1;
      if (score > existing) {
        priorities.set(file, score);
      }
    };
    for (const file of input.readmeFiles) {
      add(file, 100);
    }
    for (const file of input.packageJsonFiles) {
      add(file, 95);
    }
    for (const file of input.tsConfigFiles) {
      add(file, 90);
    }
    for (const file of input.extensionFiles) {
      add(file, 88);
    }
    for (const file of input.csprojFiles) {
      add(file, 85);
    }
    for (const file of input.solutionFiles) {
      add(file, 84);
    }
    for (const file of input.allFiles) {
      const normalized = file.toLowerCase();
      if (normalized.endsWith("src/extension.ts")) {
        add(file, 92);
      } else if (normalized.endsWith("src/ui/designstudiopanel.ts")) {
        add(file, 91);
      } else if (normalized.endsWith("src/core/pipeline.ts")) {
        add(file, 89);
      } else if (normalized.endsWith("readme.md")) {
        add(file, 87);
      } else if (normalized.endsWith(".sln") || normalized.endsWith(".csproj")) {
        add(file, 83);
      } else if (normalized.endsWith("package-lock.json")) {
        add(file, 70);
      }
    }
    return Array.from(priorities.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 20).map(([file]) => file);
  }
};

// src/core/CodexRunner.ts
var vscode3 = __toESM(require("vscode"));
var CodexRunner = class _CodexRunner {
  constructor(store) {
    this.store = store;
  }
  static terminal;
  static terminalName = "Codex";
  async runPrompt(promptPath, workspaceRoot, taskId) {
    const terminal = this.getOrCreateTerminal(workspaceRoot);
    const startedAt = (/* @__PURE__ */ new Date()).toISOString();
    const { commandLine, modelsTried } = this.buildCommandLine(promptPath);
    terminal.show(true);
    terminal.sendText(commandLine, true);
    const timestamp = this.fileSafeTimestamp(startedAt);
    const runLogRelativePath = `runs/${timestamp}_${taskId}.json`;
    const runLog = {
      taskId,
      promptPath: vscode3.workspace.asRelativePath(promptPath, false),
      startedAt,
      commandLine,
      terminalName: _CodexRunner.terminalName,
      runLogPath: `.ai-design/${runLogRelativePath}`,
      modelsTried
    };
    await this.store.writeJson(runLogRelativePath, runLog);
    await this.store.writeJson("runs/last.json", runLog);
    return runLog;
  }
  getOrCreateTerminal(workspaceRoot) {
    if (_CodexRunner.terminal) {
      return _CodexRunner.terminal;
    }
    _CodexRunner.terminal = vscode3.window.createTerminal({
      name: _CodexRunner.terminalName,
      cwd: workspaceRoot.fsPath
    });
    return _CodexRunner.terminal;
  }
  buildCommandLine(promptPath) {
    const quotedPath = `"${promptPath.fsPath.replace(/"/g, '""')}"`;
    const psSingleQuotedPath = `'${promptPath.fsPath.replace(/'/g, "''")}'`;
    const isWindows = process.platform === "win32";
    const envShell = vscode3.env.shell?.toLowerCase();
    const configuredShell = vscode3.workspace.getConfiguration("terminal.integrated").get("defaultProfile.windows")?.toLowerCase();
    const modelsTried = this.getModelCandidates();
    if (isWindows) {
      const powershellAttempts = [];
      for (const model of modelsTried) {
        const safeModel = model.replace(/'/g, "''");
        powershellAttempts.push(`Get-Content -Raw ${psSingleQuotedPath} | codex exec -m '${safeModel}' -`);
      }
      let powershellRunner = powershellAttempts[0];
      for (let i = 1; i < powershellAttempts.length; i += 1) {
        powershellRunner += `; if ($LASTEXITCODE -ne 0) { ${powershellAttempts[i]} }`;
      }
      if (configuredShell?.includes("command prompt") || configuredShell?.includes("cmd") || envShell?.includes("cmd.exe")) {
        const cmdAttempts = modelsTried.map((model) => `type ${quotedPath} | codex exec -m "${model}" -`);
        return { commandLine: cmdAttempts.join(" || "), modelsTried };
      }
      return { commandLine: powershellRunner, modelsTried };
    }
    const unixAttempts = modelsTried.map((model) => `cat ${quotedPath} | codex exec -m "${model}" -`);
    return { commandLine: unixAttempts.join(" || "), modelsTried };
  }
  getModelCandidates() {
    const configuredModel = vscode3.workspace.getConfiguration("designAddin").get("codexModel");
    const defaults = ["gpt-5.3-codex", "gpt-5.2-codex", "gpt-5.1-codex", "gpt-5-codex"];
    const candidates = [configuredModel, ...defaults].filter((value) => Boolean(value));
    return [...new Set(candidates)];
  }
  fileSafeTimestamp(isoDate) {
    return isoDate.replace(/[:.]/g, "-");
  }
};

// src/ui/DesignStudioPanel.ts
var vscode4 = __toESM(require("vscode"));

// src/llm/LlmProviderFactory.ts
function createLlmProvider(enabled, providerName) {
  switch (providerName) {
    case "openai":
      return new StubLlmProvider(enabled);
    case "stub":
    default:
      return new StubLlmProvider(enabled);
  }
}

// src/ui/DesignStudioPanel.ts
var DEFAULT_WORKSPACE_PATH = "C:\\Users\\Johan\\source\\repos\\TextAdven";
var DesignStudioPanel = class _DesignStudioPanel {
  constructor(panel, context, extensionUri) {
    this.panel = panel;
    this.context = context;
    this.extensionUri = extensionUri;
    this.panel.onDidDispose(() => this.dispose(), null, this.context.subscriptions);
    this.panel.webview.onDidReceiveMessage(
      (message) => {
        void this.handleMessage(message);
      },
      null,
      this.context.subscriptions
    );
  }
  static viewType = "designAddin.studio";
  static currentPanel;
  static async createOrShow(context, extensionUri) {
    const column = vscode4.window.activeTextEditor?.viewColumn ?? vscode4.ViewColumn.One;
    if (_DesignStudioPanel.currentPanel) {
      _DesignStudioPanel.currentPanel.panel.reveal(column);
      await _DesignStudioPanel.currentPanel.refreshAll();
      return;
    }
    const panel = vscode4.window.createWebviewPanel(_DesignStudioPanel.viewType, "Design Studio", column, {
      enableScripts: true,
      retainContextWhenHidden: true
    });
    _DesignStudioPanel.currentPanel = new _DesignStudioPanel(panel, context, extensionUri);
    await _DesignStudioPanel.currentPanel.initialize();
  }
  async initialize() {
    this.panel.webview.html = this.getHtml(this.panel.webview, this.extensionUri);
    await this.refreshAll();
  }
  dispose() {
    _DesignStudioPanel.currentPanel = void 0;
  }
  async handleMessage(message) {
    try {
      const services = await this.getServices();
      if (!services) {
        return;
      }
      await services.store.ensureDesignFolder();
      switch (message.type) {
        case "newIdea":
          await services.pipeline.newIdea();
          this.postToast("info", "Created .ai-design/idea.json");
          await this.refreshAll(services);
          return;
        case "saveIdea":
          await this.saveIdea(services.store, message.businessIdea);
          return;
        case "generateBrief":
          await services.pipeline.generateBrief();
          this.postToast("info", "Created .ai-design/brief.v1.md");
          await this.refreshAll(services);
          return;
        case "generateArchitecture":
          await services.pipeline.generateArchitecture();
          this.postToast("info", "Created .ai-design/architecture.v1.md");
          await this.refreshAll(services);
          return;
        case "generateBacklog":
          await services.pipeline.generateBacklog();
          this.postToast("info", "Created backlog artifacts");
          await this.refreshAll(services);
          return;
        case "prompts":
          await this.handlePromptsAction(services, message.taskId);
          await this.refreshAll(services);
          return;
        case "generatePromptForTask":
          await this.handlePromptsAction(services, message.taskId);
          await this.refreshAll(services);
          return;
        case "runCodex":
          await this.runTaskWithCodex(services, message.taskId);
          await this.refreshAll(services);
          return;
        case "selectTask":
          await this.sendPromptForTask(message.taskId, services.store);
          return;
        case "openPromptFile":
          await this.openPromptFile(message.taskId, services.store);
          return;
        case "openRunLog":
          await this.openLastRunLog(services.store);
          return;
      }
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      this.postToast("error", messageText);
    }
  }
  async runTaskWithCodex(services, requestedTaskId) {
    if (!await services.store.fileExists("backlog.v1.json")) {
      this.postToast("error", "Backlog not found. Generate backlog first.");
      return;
    }
    const backlog = await services.store.readJson("backlog.v1.json");
    const taskId = requestedTaskId ?? this.findFirstTaskId(backlog);
    if (!taskId) {
      this.postToast("error", "No tasks found in backlog.");
      return;
    }
    if (!this.findStoryForTask(backlog, taskId)) {
      this.postToast("error", `Task ${taskId} not found in backlog.`);
      return;
    }
    const promptUri = await this.ensurePromptForTask(taskId, backlog, services);
    const runner = new CodexRunner(services.store);
    const runLog = await runner.runPrompt(promptUri, services.workspaceRoot, taskId);
    this.panel.webview.postMessage({
      type: "runLog",
      content: `${runLog.startedAt} started ${runLog.taskId} using terminal "${runLog.terminalName}"`
    });
    this.panel.webview.postMessage({
      type: "lastRun",
      json: runLog
    });
    this.postToast("info", `Started Codex for ${taskId}. Run log: ${runLog.runLogPath}`);
  }
  async handlePromptsAction(services, requestedTaskId) {
    if (!await services.store.fileExists("backlog.v1.json")) {
      this.postToast("error", "Backlog not found. Generate backlog first.");
      return;
    }
    const backlog = await services.store.readJson("backlog.v1.json");
    const taskId = requestedTaskId ?? this.findFirstTaskId(backlog);
    if (!taskId) {
      this.postToast("error", "No tasks found in backlog.");
      return;
    }
    if (!this.findStoryForTask(backlog, taskId)) {
      this.postToast("error", `Task ${taskId} not found in backlog.`);
      return;
    }
    await this.ensurePromptForTask(taskId, backlog, services);
    this.postToast("info", `Created prompt for ${taskId}`);
    await this.sendPromptForTask(taskId, services.store);
  }
  async ensurePromptForTask(taskId, backlog, services) {
    const promptRelativePath = `prompts/${taskId}.prompt.md`;
    if (!await services.store.fileExists(promptRelativePath)) {
      await services.scanner.scanAndStoreContextBundle();
      await services.pipeline.generatePromptForTask(taskId, backlog);
    }
    return services.store.resolveDesignPath(promptRelativePath);
  }
  async refreshAll(existingServices) {
    const services = existingServices ?? await this.getServices();
    if (!services) {
      return;
    }
    await services.store.ensureDesignFolder();
    await services.scanner.scanAndStoreContextBundle();
    await this.sendIdea(services.store);
    await this.sendArtifact("brief", "brief.v1.md", services.store);
    await this.sendArtifact("architecture", "architecture.v1.md", services.store);
    if (await services.store.fileExists("backlog.v1.json")) {
      const backlogJson = await services.store.readJson("backlog.v1.json");
      const backlogMarkdown = await services.store.readText("backlog.v1.md").catch(() => "");
      this.panel.webview.postMessage({
        type: "backlog",
        json: backlogJson,
        markdown: backlogMarkdown
      });
    } else {
      this.panel.webview.postMessage({
        type: "backlog",
        json: null,
        markdown: ""
      });
    }
    await this.sendPromptsList(services.store);
    await this.sendLastRun(services.store);
  }
  async sendIdea(store) {
    let idea = null;
    if (await store.fileExists("idea.json")) {
      try {
        idea = await store.readJson("idea.json");
      } catch {
        idea = null;
      }
    }
    this.panel.webview.postMessage({
      type: "idea",
      businessIdea: idea?.businessIdea ?? ""
    });
  }
  async saveIdea(store, businessIdea) {
    let existingIdea = {};
    if (await store.fileExists("idea.json")) {
      try {
        existingIdea = await store.readJson("idea.json");
      } catch {
        existingIdea = {};
      }
    }
    const merged = {
      version: existingIdea.version ?? 1,
      createdAt: existingIdea.createdAt ?? (/* @__PURE__ */ new Date()).toISOString(),
      title: existingIdea.title ?? "Design Addin Idea",
      problem: existingIdea.problem ?? "Describe the core workflow or pain point this addin should solve.",
      outcome: existingIdea.outcome ?? "Describe the expected measurable outcome if this succeeds.",
      businessIdea
    };
    await store.writeJson("idea.json", merged);
    this.panel.webview.postMessage({
      type: "ideaSaved",
      at: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  async sendArtifact(name, relativePath, store) {
    let content = "";
    if (await store.fileExists(relativePath)) {
      content = await store.readText(relativePath);
    }
    this.panel.webview.postMessage({
      type: "artifact",
      name,
      content
    });
  }
  async sendPromptsList(store) {
    const promptsRoot = store.resolveDesignPath("prompts");
    const items = [];
    try {
      const entries = await vscode4.workspace.fs.readDirectory(promptsRoot);
      for (const [name, fileType] of entries) {
        if (fileType !== vscode4.FileType.File || !name.endsWith(".prompt.md")) {
          continue;
        }
        const taskId = name.replace(".prompt.md", "");
        items.push({
          taskId,
          promptPath: `.ai-design/prompts/${name}`
        });
      }
    } catch {
    }
    this.panel.webview.postMessage({
      type: "promptsList",
      items
    });
  }
  async sendPromptForTask(taskId, store) {
    const promptPath = `prompts/${taskId}.prompt.md`;
    let content = "";
    if (await store.fileExists(promptPath)) {
      content = await store.readText(promptPath);
    }
    this.panel.webview.postMessage({
      type: "promptPreview",
      taskId,
      content
    });
    if (!content) {
      this.postToast("info", `No prompt exists for ${taskId} yet.`);
    }
  }
  async sendLastRun(store) {
    let lastRun = null;
    if (await store.fileExists("runs/last.json")) {
      lastRun = await store.readJson("runs/last.json");
    }
    this.panel.webview.postMessage({
      type: "lastRun",
      json: lastRun
    });
  }
  async openPromptFile(taskId, store) {
    const uri = store.resolveDesignPath(`prompts/${taskId}.prompt.md`);
    if (!await store.fileExists(`prompts/${taskId}.prompt.md`)) {
      this.postToast("error", `Prompt file for ${taskId} does not exist.`);
      return;
    }
    await vscode4.commands.executeCommand("vscode.open", uri);
  }
  async openLastRunLog(store) {
    if (!await store.fileExists("runs/last.json")) {
      this.postToast("error", "No last run log found yet.");
      return;
    }
    const uri = store.resolveDesignPath("runs/last.json");
    await vscode4.commands.executeCommand("vscode.open", uri);
  }
  postToast(level, message) {
    this.panel.webview.postMessage({
      type: "toast",
      level,
      message
    });
  }
  findFirstTaskId(backlog) {
    for (const epic of backlog.epics) {
      for (const story of epic.stories) {
        for (const task of story.tasks) {
          return task.id;
        }
      }
    }
    return void 0;
  }
  findStoryForTask(backlog, taskId) {
    for (const epic of backlog.epics) {
      for (const story of epic.stories) {
        if (story.tasks.some((task) => task.id === taskId)) {
          return story;
        }
      }
    }
    return void 0;
  }
  async getServices() {
    const workspaceRoot = vscode4.workspace.workspaceFolders?.[0]?.uri;
    if (!workspaceRoot) {
      const defaultWorkspaceUri = vscode4.Uri.file(DEFAULT_WORKSPACE_PATH);
      await vscode4.commands.executeCommand("vscode.openFolder", defaultWorkspaceUri, false);
      return null;
    }
    const store = new ArtifactStore(workspaceRoot);
    const scanner = new WorkspaceScanner(workspaceRoot, store);
    const llmEnabled = vscode4.workspace.getConfiguration("designAddin.llm").get("enabled", false);
    const llmProviderName = vscode4.workspace.getConfiguration("designAddin.llm").get("provider", "stub");
    const llmProvider = createLlmProvider(llmEnabled, llmProviderName);
    const pipeline = new Pipeline(store, { llmEnabled, llmProvider });
    return { workspaceRoot, store, scanner, pipeline };
  }
  getHtml(webview, extensionUri) {
    const nonce = getNonce();
    const rootPath = extensionUri.toString();
    return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
	<title>Design Studio</title>
	<style>
		:root {
			--bg: #0f172a;
			--panel: #111827;
			--line: #334155;
			--text: #e2e8f0;
			--muted: #94a3b8;
			--accent: #22c55e;
			--error: #ef4444;
		}
		* { box-sizing: border-box; }
		body {
			margin: 0;
			color: var(--text);
			background: radial-gradient(circle at top left, #1e293b, var(--bg) 55%);
			font-family: Consolas, "Courier New", monospace;
		}
		.app {
			display: grid;
			grid-template-columns: 230px 1fr;
			min-height: 100vh;
		}
		.sidebar {
			border-right: 1px solid var(--line);
			padding: 14px;
			background: color-mix(in srgb, var(--panel) 88%, black 12%);
		}
		.sidebar h2 {
			margin: 0 0 12px 0;
			font-size: 14px;
			letter-spacing: 0.08em;
			color: var(--muted);
			text-transform: uppercase;
		}
		.nav-btn {
			width: 100%;
			display: block;
			margin-bottom: 8px;
			padding: 8px 10px;
			border-radius: 6px;
			border: 1px solid var(--line);
			background: transparent;
			color: var(--text);
			cursor: pointer;
			text-align: left;
		}
		.nav-btn:hover {
			border-color: var(--accent);
			color: #fff;
		}
		.content {
			padding: 12px;
			display: flex;
			flex-direction: column;
			gap: 10px;
			min-width: 0;
		}
		.tabs {
			display: flex;
			gap: 8px;
			flex-wrap: wrap;
		}
		.tab-btn {
			padding: 7px 10px;
			border-radius: 6px;
			border: 1px solid var(--line);
			background: transparent;
			color: var(--text);
			cursor: pointer;
		}
		.tab-btn.active {
			border-color: var(--accent);
			color: #fff;
		}
		.tab {
			display: none;
			border: 1px solid var(--line);
			border-radius: 8px;
			background: color-mix(in srgb, var(--panel) 94%, black 6%);
			padding: 12px;
			min-height: 400px;
			overflow: auto;
		}
		.tab.active {
			display: block;
		}
		pre {
			white-space: pre-wrap;
			word-break: break-word;
			margin: 0;
			color: #d1fae5;
		}
		.section {
			margin-bottom: 14px;
		}
		.section h3 {
			margin: 0 0 6px;
			color: #f8fafc;
		}
		.markdown-output {
			border: 1px solid var(--line);
			border-radius: 6px;
			padding: 10px;
			background: #0b1221;
			line-height: 1.45;
		}
		.markdown-output h1, .markdown-output h2, .markdown-output h3 {
			margin: 0 0 8px;
			color: #f8fafc;
		}
		.markdown-output p {
			margin: 0 0 8px;
		}
		.markdown-output ul {
			margin: 0 0 8px 20px;
			padding: 0;
		}
		.markdown-output pre {
			background: #020617;
			border: 1px solid var(--line);
			border-radius: 6px;
			padding: 8px;
			overflow: auto;
			white-space: pre-wrap;
		}
		.markdown-output code {
			background: #1e293b;
			border-radius: 4px;
			padding: 1px 4px;
		}
		.idea-input {
			width: 100%;
			min-height: 110px;
			resize: vertical;
			border: 1px solid var(--line);
			background: #020617;
			color: var(--text);
			border-radius: 6px;
			padding: 8px;
			font-family: Consolas, "Courier New", monospace;
			font-size: 13px;
			line-height: 1.4;
		}
		.task-row {
			width: 100%;
			display: block;
			text-align: left;
			background: transparent;
			color: var(--text);
			border: 1px solid var(--line);
			border-radius: 6px;
			padding: 8px 10px;
			margin-bottom: 8px;
			cursor: pointer;
		}
		.task-row:hover {
			border-color: var(--accent);
		}
		.task-row.selected {
			border-color: var(--accent);
			background: color-mix(in srgb, var(--accent) 18%, transparent 82%);
		}
		.backlog-grid {
			display: grid;
			grid-template-columns: minmax(260px, 1fr) minmax(260px, 1fr);
			gap: 10px;
		}
		.story-group {
			border: 1px solid var(--line);
			border-radius: 6px;
			padding: 8px;
			margin-bottom: 10px;
		}
		.story-title {
			font-weight: 700;
			margin-bottom: 8px;
		}
		.epic-title {
			font-size: 12px;
			color: var(--muted);
			margin-bottom: 4px;
		}
		.detail-panel {
			border: 1px solid var(--line);
			border-radius: 6px;
			padding: 10px;
			background: #0b1221;
		}
		.inline-list {
			margin: 8px 0 0 18px;
			padding: 0;
		}
		.inline-list li {
			margin-bottom: 4px;
		}
		.action-btn {
			margin-top: 10px;
			padding: 8px 10px;
			border-radius: 6px;
			border: 1px solid var(--line);
			background: transparent;
			color: var(--text);
			cursor: pointer;
		}
		.action-btn:hover {
			border-color: var(--accent);
		}
		.action-btn:disabled {
			opacity: 0.5;
			cursor: default;
		}
		.button-row {
			display: flex;
			gap: 8px;
			flex-wrap: wrap;
		}
		.small {
			color: var(--muted);
			font-size: 12px;
		}
		.toast {
			position: fixed;
			right: 12px;
			bottom: 12px;
			max-width: 420px;
			padding: 8px 10px;
			border-radius: 8px;
			border: 1px solid var(--line);
			background: var(--panel);
			display: none;
		}
		.toast.error {
			border-color: var(--error);
		}
	</style>
</head>
<body>
	<div class="app" data-root="${rootPath}">
		<aside class="sidebar">
			<h2>Design Studio</h2>
			<button class="nav-btn" data-action="newIdea">New Idea</button>
			<button class="nav-btn" data-action="generateBrief">Generate Brief</button>
			<button class="nav-btn" data-action="generateArchitecture">Generate Architecture</button>
			<button class="nav-btn" data-action="generateBacklog">Generate Backlog</button>
			<button class="nav-btn" data-action="prompts">Prompts</button>
			<button class="nav-btn" data-action="runCodex">Run Codex</button>
		</aside>
		<main class="content">
			<div class="tabs">
				<button class="tab-btn active" data-tab="artifacts">Artifacts</button>
				<button class="tab-btn" data-tab="backlog">Backlog</button>
				<button class="tab-btn" data-tab="prompt">Prompt Preview</button>
				<button class="tab-btn" data-tab="logs">Run Logs</button>
			</div>
			<section class="tab active" id="tab-artifacts">
				<div class="section">
					<h3>Business Idea</h3>
					<textarea id="idea-input" class="idea-input" placeholder="Describe your business idea..."></textarea>
					<div class="small" id="idea-save-status">Auto-save is on.</div>
				</div>
				<div class="section">
					<h3>Brief</h3>
					<div class="markdown-output" id="artifact-brief"></div>
				</div>
				<div class="section">
					<h3>Architecture</h3>
					<div class="markdown-output" id="artifact-architecture"></div>
				</div>
				<div class="section">
					<h3>Backlog (Markdown)</h3>
					<div class="markdown-output" id="artifact-backlog"></div>
				</div>
			</section>
			<section class="tab" id="tab-backlog">
				<div class="small">Click a task to preview its prompt and acceptance criteria.</div>
				<div class="backlog-grid">
					<div id="backlog-list"></div>
					<div class="detail-panel">
						<div id="selected-task-title">No task selected.</div>
						<div class="small" id="selected-task-meta"></div>
						<ul class="inline-list" id="selected-acceptance"></ul>
						<div class="button-row">
							<button class="action-btn" id="generate-selected-prompt" disabled>Generate Prompt</button>
							<button class="action-btn" id="run-selected-task" disabled>Run with Codex</button>
						</div>
					</div>
				</div>
			</section>
			<section class="tab" id="tab-prompt">
				<div class="section">
					<h3 id="prompt-title">Prompt</h3>
					<div class="markdown-output" id="prompt-preview"></div>
					<div class="button-row">
						<button class="action-btn" id="copy-prompt" disabled>Copy Prompt</button>
						<button class="action-btn" id="open-prompt-editor" disabled>Open In Editor</button>
					</div>
				</div>
				<div class="section">
					<h3>Known Prompt Files</h3>
					<pre id="prompt-list"></pre>
				</div>
			</section>
			<section class="tab" id="tab-logs">
				<div class="section">
					<h3>Last Run Metadata</h3>
					<pre id="last-run"></pre>
					<button class="action-btn" id="open-run-log">Open Run Log</button>
				</div>
				<pre id="run-logs"></pre>
			</section>
		</main>
	</div>
	<div class="toast" id="toast"></div>
	<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		const state = {
			artifacts: { brief: '', architecture: '', backlog: '' },
			backlogJson: null,
			promptContent: '',
			promptTaskId: '',
			selectedTaskId: '',
			selectedStoryId: '',
			prompts: [],
			runLogs: [],
			lastRun: null,
			businessIdea: '',
			ideaSavedAt: ''
		};

		function setText(id, text) {
			const element = document.getElementById(id);
			if (element) {
				element.textContent = text || '';
			}
		}

		function setHtml(id, html) {
			const element = document.getElementById(id);
			if (element) {
				element.innerHTML = html || '';
			}
		}

		function escapeHtml(text) {
			return String(text)
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&#39;');
		}

		function renderInline(text) {
			const segments = String(text).split(/(\\x60[^\\x60]*\\x60)/g);
			return segments.map((segment) => {
				if (segment.startsWith('\\x60') && segment.endsWith('\\x60')) {
					return '<code>' + escapeHtml(segment.slice(1, -1)) + '</code>';
				}
				let safe = escapeHtml(segment);
				safe = safe.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
				safe = safe.replace(/\\*([^*]+)\\*/g, '<em>$1</em>');
				return safe;
			}).join('');
		}

		function renderMarkdown(md) {
			const lines = String(md || '').split(/\\r?\\n/);
			const output = [];
			let inCode = false;
			let codeBuffer = [];
			let inList = false;

			function closeList() {
				if (inList) {
					output.push('</ul>');
					inList = false;
				}
			}

			for (const line of lines) {
				if (inCode) {
					if (/^\\s*\\x60\\x60\\x60/.test(line)) {
						output.push('<pre><code>' + escapeHtml(codeBuffer.join('\\n')) + '</code></pre>');
						codeBuffer = [];
						inCode = false;
					} else {
						codeBuffer.push(line);
					}
					continue;
				}

				if (/^\\s*\\x60\\x60\\x60/.test(line)) {
					closeList();
					inCode = true;
					continue;
				}

				const h3 = line.match(/^###\\s+(.*)$/);
				const h2 = line.match(/^##\\s+(.*)$/);
				const h1 = line.match(/^#\\s+(.*)$/);
				const listItem = line.match(/^\\s*[-*]\\s+(.*)$/);

				if (h3) {
					closeList();
					output.push('<h3>' + renderInline(h3[1]) + '</h3>');
					continue;
				}
				if (h2) {
					closeList();
					output.push('<h2>' + renderInline(h2[1]) + '</h2>');
					continue;
				}
				if (h1) {
					closeList();
					output.push('<h1>' + renderInline(h1[1]) + '</h1>');
					continue;
				}
				if (listItem) {
					if (!inList) {
						output.push('<ul>');
						inList = true;
					}
					output.push('<li>' + renderInline(listItem[1]) + '</li>');
					continue;
				}
				if (!line.trim()) {
					closeList();
					continue;
				}

				closeList();
				output.push('<p>' + renderInline(line) + '</p>');
			}

			if (inCode) {
				output.push('<pre><code>' + escapeHtml(codeBuffer.join('\\n')) + '</code></pre>');
			}
			if (inList) {
				output.push('</ul>');
			}

			return output.join('');
		}

		function findTaskNode(taskId) {
			if (!state.backlogJson || !state.backlogJson.epics) {
				return null;
			}
			for (const epic of state.backlogJson.epics) {
				for (const story of epic.stories) {
					for (const task of story.tasks) {
						if (task.id === taskId) {
							return { epic, story, task };
						}
					}
				}
			}
			return null;
		}

		function showTab(name) {
			document.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'));
			document.querySelectorAll('.tab-btn').forEach((btn) => btn.classList.remove('active'));
			const activeTab = document.getElementById('tab-' + name);
			if (activeTab) {
				activeTab.classList.add('active');
			}
			const activeBtn = document.querySelector('.tab-btn[data-tab="' + name + '"]');
			if (activeBtn) {
				activeBtn.classList.add('active');
			}
		}

		function renderArtifacts() {
			const ideaInput = document.getElementById('idea-input');
			if (ideaInput && ideaInput.value !== state.businessIdea) {
				ideaInput.value = state.businessIdea || '';
			}
			const saveStatus = document.getElementById('idea-save-status');
			if (saveStatus) {
				saveStatus.textContent = state.ideaSavedAt
					? 'Saved at ' + new Date(state.ideaSavedAt).toLocaleTimeString()
					: 'Auto-save is on.';
			}
			setHtml('artifact-brief', renderMarkdown(state.artifacts.brief || 'No brief generated yet.'));
			setHtml('artifact-architecture', renderMarkdown(state.artifacts.architecture || 'No architecture generated yet.'));
			setHtml('artifact-backlog', renderMarkdown(state.artifacts.backlog || 'No backlog markdown generated yet.'));
		}

		function renderBacklog() {
			const container = document.getElementById('backlog-list');
			if (!container) {
				return;
			}
			container.innerHTML = '';
			if (!state.backlogJson || !state.backlogJson.epics) {
				container.textContent = 'No backlog generated yet.';
				return;
			}
			state.backlogJson.epics.forEach((epic) => {
				const epicHeader = document.createElement('div');
				epicHeader.className = 'epic-title';
				epicHeader.textContent = epic.id + ': ' + epic.title;
				container.appendChild(epicHeader);

				epic.stories.forEach((story) => {
					const storyCard = document.createElement('div');
					storyCard.className = 'story-group';

					const storyTitle = document.createElement('div');
					storyTitle.className = 'story-title';
					storyTitle.textContent = story.id + ': ' + story.title;
					storyCard.appendChild(storyTitle);

					story.tasks.forEach((task) => {
						const btn = document.createElement('button');
						btn.className = 'task-row';
						if (task.id === state.selectedTaskId) {
							btn.classList.add('selected');
						}
						btn.dataset.taskId = task.id;

						const title = document.createElement('div');
						title.textContent = task.id + ' ' + task.title;
						btn.appendChild(title);

						const detail = document.createElement('div');
						detail.className = 'small';
						detail.textContent = 'status=' + task.status + ' | tags=' + (task.tags || []).join(', ');
						btn.appendChild(detail);

						btn.addEventListener('click', () => {
							state.selectedTaskId = task.id;
							state.selectedStoryId = story.id;
							vscode.postMessage({ type: 'selectTask', taskId: task.id });
							renderBacklog();
						});
						storyCard.appendChild(btn);
					});
					container.appendChild(storyCard);
				});
			});

			const selectedNode = findTaskNode(state.selectedTaskId);
			const titleEl = document.getElementById('selected-task-title');
			const metaEl = document.getElementById('selected-task-meta');
			const acceptanceEl = document.getElementById('selected-acceptance');
			const generateBtn = document.getElementById('generate-selected-prompt');
			const runBtn = document.getElementById('run-selected-task');
			if (titleEl && metaEl && acceptanceEl && generateBtn && runBtn) {
				acceptanceEl.innerHTML = '';
				if (!selectedNode) {
					titleEl.textContent = 'No task selected.';
					metaEl.textContent = '';
					generateBtn.disabled = true;
					runBtn.disabled = true;
				} else {
					titleEl.textContent = selectedNode.task.id + ': ' + selectedNode.task.title;
					metaEl.textContent = selectedNode.epic.id + ' / ' + selectedNode.story.id +
						' | status=' + selectedNode.task.status +
						' | tags=' + (selectedNode.task.tags || []).join(', ');
					const criteria = selectedNode.story.acceptanceCriteria || [];
					if (!criteria.length) {
						const li = document.createElement('li');
						li.textContent = 'No acceptance criteria defined.';
						acceptanceEl.appendChild(li);
					} else {
						criteria.forEach((item) => {
							const li = document.createElement('li');
							li.textContent = item;
							acceptanceEl.appendChild(li);
						});
					}
					generateBtn.disabled = false;
					runBtn.disabled = false;
				}
			}
		}

		function renderPrompt() {
			setText('prompt-title', state.promptTaskId ? 'Prompt: ' + state.promptTaskId : 'Prompt');
			setHtml('prompt-preview', renderMarkdown(state.promptContent || 'No prompt selected.'));
			const listText = state.prompts.length
				? state.prompts.map((item) => item.taskId + ' -> ' + item.promptPath).join('\\n')
				: 'No generated prompt files yet.';
			setText('prompt-list', listText);
			const openPromptButton = document.getElementById('open-prompt-editor');
			const copyPromptButton = document.getElementById('copy-prompt');
			if (openPromptButton && copyPromptButton) {
				const disabled = !state.promptTaskId || !state.promptContent;
				openPromptButton.disabled = disabled;
				copyPromptButton.disabled = disabled;
			}
		}

		function renderLogs() {
			setText('run-logs', state.runLogs.length ? state.runLogs.join('\\n') : 'No runs yet.');
			const lastRunText = state.lastRun ? JSON.stringify(state.lastRun, null, 2) : 'No run log yet.';
			setText('last-run', lastRunText);
		}

		function showToast(level, message) {
			const toast = document.getElementById('toast');
			if (!toast) {
				return;
			}
			toast.className = 'toast ' + (level || '');
			toast.textContent = message;
			toast.style.display = 'block';
			window.setTimeout(() => {
				toast.style.display = 'none';
			}, 2600);
		}

		document.querySelectorAll('.nav-btn').forEach((button) => {
			button.addEventListener('click', () => {
				const action = button.dataset.action;
				if (action) {
					if (action === 'prompts') {
						vscode.postMessage({ type: action, taskId: state.selectedTaskId || undefined });
						return;
					}
					if (action === 'runCodex') {
						vscode.postMessage({ type: action, taskId: state.selectedTaskId || undefined });
						showTab('logs');
						return;
					}
					vscode.postMessage({ type: action });
				}
			});
		});

		document.querySelectorAll('.tab-btn').forEach((button) => {
			button.addEventListener('click', () => {
				const tabName = button.dataset.tab;
				if (tabName) {
					showTab(tabName);
				}
			});
		});

		const generateSelectedPromptBtn = document.getElementById('generate-selected-prompt');
		if (generateSelectedPromptBtn) {
			generateSelectedPromptBtn.addEventListener('click', () => {
				if (!state.selectedTaskId) {
					return;
				}
				vscode.postMessage({ type: 'generatePromptForTask', taskId: state.selectedTaskId });
				showTab('prompt');
			});
		}
		const runSelectedTaskBtn = document.getElementById('run-selected-task');
		if (runSelectedTaskBtn) {
			runSelectedTaskBtn.addEventListener('click', () => {
				if (!state.selectedTaskId) {
					return;
				}
				vscode.postMessage({ type: 'runCodex', taskId: state.selectedTaskId });
				showTab('logs');
			});
		}
		const openPromptFileBtn = document.getElementById('open-prompt-editor');
		if (openPromptFileBtn) {
			openPromptFileBtn.addEventListener('click', () => {
				if (!state.promptTaskId) {
					return;
				}
				vscode.postMessage({ type: 'openPromptFile', taskId: state.promptTaskId });
			});
		}
		const copyPromptBtn = document.getElementById('copy-prompt');
		if (copyPromptBtn) {
			copyPromptBtn.addEventListener('click', async () => {
				if (!state.promptContent) {
					return;
				}
				try {
					if (navigator.clipboard && navigator.clipboard.writeText) {
						await navigator.clipboard.writeText(state.promptContent);
					} else {
						const temp = document.createElement('textarea');
						temp.value = state.promptContent;
						document.body.appendChild(temp);
						temp.select();
						document.execCommand('copy');
						document.body.removeChild(temp);
					}
					showToast('info', 'Prompt copied to clipboard.');
				} catch {
					showToast('error', 'Failed to copy prompt.');
				}
			});
		}
		const openRunLogBtn = document.getElementById('open-run-log');
		if (openRunLogBtn) {
			openRunLogBtn.addEventListener('click', () => {
				vscode.postMessage({ type: 'openRunLog' });
			});
		}
		const ideaInput = document.getElementById('idea-input');
		let ideaSaveTimer = null;
		if (ideaInput) {
			ideaInput.addEventListener('input', () => {
				state.businessIdea = ideaInput.value;
				const saveStatus = document.getElementById('idea-save-status');
				if (saveStatus) {
					saveStatus.textContent = 'Saving...';
				}
				if (ideaSaveTimer) {
					clearTimeout(ideaSaveTimer);
				}
				ideaSaveTimer = setTimeout(() => {
					vscode.postMessage({ type: 'saveIdea', businessIdea: state.businessIdea });
				}, 450);
			});
		}

		window.addEventListener('message', (event) => {
			const message = event.data || {};
			if (message.type === 'artifact') {
				state.artifacts[message.name] = message.content || '';
				renderArtifacts();
				return;
			}
			if (message.type === 'idea') {
				state.businessIdea = message.businessIdea || '';
				renderArtifacts();
				return;
			}
			if (message.type === 'ideaSaved') {
				state.ideaSavedAt = message.at || '';
				renderArtifacts();
				return;
			}
			if (message.type === 'backlog') {
				state.backlogJson = message.json;
				state.artifacts.backlog = message.markdown || '';
				renderBacklog();
				renderArtifacts();
				return;
			}
			if (message.type === 'promptsList') {
				state.prompts = message.items || [];
				renderPrompt();
				return;
			}
			if (message.type === 'promptPreview') {
				state.promptTaskId = message.taskId || '';
				state.promptContent = message.content || '';
				state.selectedTaskId = message.taskId || state.selectedTaskId;
				renderPrompt();
				renderBacklog();
				return;
			}
			if (message.type === 'runLog') {
				state.runLogs.unshift(message.content || '');
				state.runLogs = state.runLogs.slice(0, 40);
				renderLogs();
				return;
			}
			if (message.type === 'lastRun') {
				state.lastRun = message.json || null;
				renderLogs();
				return;
			}
			if (message.type === 'toast') {
				showToast(message.level, message.message);
			}
		});

		renderArtifacts();
		renderBacklog();
		renderPrompt();
		renderLogs();
	</script>
</body>
</html>`;
  }
};
function getNonce() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let i = 0; i < 16; i += 1) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

// src/extension.ts
var DEFAULT_WORKSPACE_PATH2 = "C:\\Users\\Johan\\source\\repos\\TextAdven";
function activate(context) {
  const register = (commandId, action) => {
    const disposable = vscode5.commands.registerCommand(commandId, async () => {
      try {
        await action();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode5.window.showErrorMessage(`${commandId} failed: ${message}`);
      }
    });
    context.subscriptions.push(disposable);
  };
  register("designAddin.openStudio", async () => {
    await DesignStudioPanel.createOrShow(context, context.extensionUri);
  });
  register("designAddin.newIdea", async () => {
    const services = await getServices();
    if (!services) {
      return;
    }
    await services.store.ensureDesignFolder();
    const uri = await services.pipeline.newIdea();
    await openTextDocument(uri);
    vscode5.window.showInformationMessage("Created .ai-design/idea.json");
  });
  register("designAddin.generateBrief", async () => {
    const services = await getServices();
    if (!services) {
      return;
    }
    await services.store.ensureDesignFolder();
    const uri = await services.pipeline.generateBrief();
    await openTextDocument(uri);
    vscode5.window.showInformationMessage("Created .ai-design/brief.v1.md");
  });
  register("designAddin.generateArchitecture", async () => {
    const services = await getServices();
    if (!services) {
      return;
    }
    await services.store.ensureDesignFolder();
    const uri = await services.pipeline.generateArchitecture();
    await openTextDocument(uri);
    vscode5.window.showInformationMessage("Created .ai-design/architecture.v1.md");
  });
  register("designAddin.generateBacklog", async () => {
    const services = await getServices();
    if (!services) {
      return;
    }
    await services.store.ensureDesignFolder();
    const { jsonUri, markdownUri } = await services.pipeline.generateBacklog();
    await openTextDocument(markdownUri);
    vscode5.window.showInformationMessage(
      `Created backlog artifacts: ${vscode5.workspace.asRelativePath(jsonUri)}, ${vscode5.workspace.asRelativePath(markdownUri)}`
    );
  });
  register("designAddin.generatePromptForTask", async () => {
    const services = await getServices();
    if (!services) {
      return;
    }
    await services.store.ensureDesignFolder();
    if (!await services.store.fileExists("backlog.v1.json")) {
      vscode5.window.showWarningMessage('Backlog not found. Run "Generate Backlog" first.');
      return;
    }
    const backlog = await services.store.readJson("backlog.v1.json");
    const selectedTask = await pickTask(backlog);
    if (!selectedTask) {
      return;
    }
    await services.scanner.scanAndStoreContextBundle();
    const uri = await services.pipeline.generatePromptForTask(selectedTask.task.id, backlog);
    await openTextDocument(uri);
    vscode5.window.showInformationMessage(`Created prompt for ${selectedTask.task.id}`);
  });
  register("designAddin.runTaskWithCodex", async () => {
    const services = await getServices();
    if (!services) {
      return;
    }
    await services.store.ensureDesignFolder();
    if (!await services.store.fileExists("backlog.v1.json")) {
      vscode5.window.showWarningMessage('Backlog not found. Run "Generate Backlog" first.');
      return;
    }
    const backlog = await services.store.readJson("backlog.v1.json");
    const selectedTask = await pickTask(backlog);
    if (!selectedTask) {
      return;
    }
    const promptRelativePath = `prompts/${selectedTask.task.id}.prompt.md`;
    if (!await services.store.fileExists(promptRelativePath)) {
      await services.scanner.scanAndStoreContextBundle();
      await services.pipeline.generatePromptForTask(selectedTask.task.id, backlog);
    }
    const promptUri = services.store.resolveDesignPath(promptRelativePath);
    const runner = new CodexRunner(services.store);
    const runLog = await runner.runPrompt(promptUri, services.workspaceRoot, selectedTask.task.id);
    vscode5.window.showInformationMessage(
      `Started Codex for ${selectedTask.task.id}. Run log: ${runLog.runLogPath}`
    );
  });
  register("designAddin.rescanWorkspaceContext", async () => {
    const services = await getServices();
    if (!services) {
      return;
    }
    await services.store.ensureDesignFolder();
    const uri = await services.scanner.scanAndStoreContextBundle();
    await openTextDocument(uri);
    vscode5.window.showInformationMessage("Updated .ai-design/contextBundle.json");
  });
}
async function getServices() {
  const workspaceRoot = vscode5.workspace.workspaceFolders?.[0]?.uri;
  if (!workspaceRoot) {
    const defaultWorkspaceUri = vscode5.Uri.file(DEFAULT_WORKSPACE_PATH2);
    await vscode5.commands.executeCommand("vscode.openFolder", defaultWorkspaceUri, false);
    return null;
  }
  const store = new ArtifactStore(workspaceRoot);
  const scanner = new WorkspaceScanner(workspaceRoot, store);
  const llmEnabled = vscode5.workspace.getConfiguration("designAddin.llm").get("enabled", false);
  const llmProviderName = vscode5.workspace.getConfiguration("designAddin.llm").get("provider", "stub");
  const llmProvider = createLlmProvider(llmEnabled, llmProviderName);
  const pipeline = new Pipeline(store, { llmEnabled, llmProvider });
  return { workspaceRoot, store, scanner, pipeline };
}
async function openTextDocument(uri) {
  const document = await vscode5.workspace.openTextDocument(uri);
  await vscode5.window.showTextDocument(document, { preview: false });
}
async function pickTask(backlog) {
  const picks = [];
  const taskLookup = /* @__PURE__ */ new Map();
  for (const epic of backlog.epics) {
    for (const story of epic.stories) {
      for (const task of story.tasks) {
        const value = { task, story };
        taskLookup.set(task.id, value);
        picks.push({
          label: task.id,
          description: task.title,
          detail: `${epic.id} / ${story.id} / status=${task.status}`
        });
      }
    }
  }
  if (picks.length === 0) {
    vscode5.window.showWarningMessage("No tasks found in backlog.v1.json.");
    return void 0;
  }
  const selection = await vscode5.window.showQuickPick(picks, {
    title: "Select a task to generate prompt",
    placeHolder: "Choose a task ID"
  });
  if (!selection) {
    return void 0;
  }
  return taskLookup.get(selection.label);
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
