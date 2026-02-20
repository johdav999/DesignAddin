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
var vscode8 = __toESM(require("vscode"));

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

// src/llm/OpenAiPromptTemplates.ts
function buildBriefPrompt(context) {
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
function buildArchitecturePrompt(context) {
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
${context.brief ?? ""}
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
function buildBacklogPrompt(context) {
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
${context.brief ?? ""}
>>>

ARCHITECTURE:
<<<
${context.architecture ?? ""}
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
function buildBacklogJsonPrompt(backlogMarkdown) {
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
function buildTaskPromptPrompt(context) {
  const criteria = context.acceptanceCriteria.length > 0 ? context.acceptanceCriteria.map((criterion) => `- ${criterion}`).join("\n") : "- No explicit acceptance criteria were provided for this story.";
  return `Write a coding-agent implementation prompt for this exact backlog task.

TASK:
- ID: ${context.taskId}
- Title: ${context.taskTitle}
- Story: ${context.storyId ?? "unknown"} ${context.storyTitle ?? ""}

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

// src/core/Pipeline.ts
var Pipeline = class {
  constructor(store, options) {
    this.store = store;
    this.llmProvider = options.llmProvider;
    this.outputChannel = options.outputChannel;
  }
  llmProvider;
  outputChannel;
  async newIdea() {
    const artifact = {
      version: 1,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      title: "Business Idea",
      problem: "Describe the core workflow or pain point this product should solve.",
      outcome: "Describe the expected measurable outcome if this succeeds.",
      businessIdea: ""
    };
    return this.store.writeJson("idea.json", artifact);
  }
  async generateBrief() {
    const started = Date.now();
    this.logStage("brief", "start");
    try {
      const ideaText = await this.getIdeaText();
      this.logStage("brief", `idea input loaded (${ideaText.length} chars)`);
      const prompt = buildBriefPrompt({ idea: ideaText });
      this.logStage("brief", `requesting LLM markdown (${prompt.length} prompt chars)`);
      const result = await this.llmProvider.generateJson("briefMarkdown", prompt);
      const content = this.requireMarkdown(result?.markdown, "brief");
      this.logStage("brief", `writing .ai-design/brief.v1.md (${content.length} chars)`);
      const uri = await this.store.writeMarkdown("brief.v1.md", content);
      this.logStage("brief", `done in ${Date.now() - started}ms (${uri.fsPath})`);
      return uri;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logStage("brief", `failed: ${message}`);
      throw error;
    }
  }
  async generateArchitecture() {
    this.logStage("architecture", "start");
    const ideaText = await this.getIdeaText();
    const briefText = await this.readMarkdownIfExists("brief.v1.md");
    const prompt = buildArchitecturePrompt({ idea: ideaText, brief: briefText });
    this.logStage("architecture", `requesting LLM markdown (${prompt.length} prompt chars)`);
    const result = await this.llmProvider.generateJson("architectureMarkdown", prompt);
    const content = this.requireMarkdown(result?.markdown, "architecture");
    this.logStage("architecture", `writing .ai-design/architecture.v1.md (${content.length} chars)`);
    return this.store.writeMarkdown("architecture.v1.md", content);
  }
  async generateBacklog() {
    this.logStage("backlog", "start");
    const ideaText = await this.getIdeaText();
    const briefText = await this.readMarkdownIfExists("brief.v1.md");
    const architectureText = await this.readMarkdownIfExists("architecture.v1.md");
    const markdownPrompt = buildBacklogPrompt({ idea: ideaText, brief: briefText, architecture: architectureText });
    this.logStage("backlog", `requesting markdown (${markdownPrompt.length} prompt chars)`);
    const markdownResult = await this.llmProvider.generateJson("backlogMarkdown", markdownPrompt);
    const backlogMarkdown = this.requireMarkdown(markdownResult?.markdown, "backlog");
    const markdownUri = await this.store.writeMarkdown("backlog.v1.md", backlogMarkdown);
    this.logStage("backlog", `wrote backlog markdown (${backlogMarkdown.length} chars)`);
    const jsonPrompt = buildBacklogJsonPrompt(backlogMarkdown);
    this.logStage("backlog", `requesting JSON conversion (${jsonPrompt.length} prompt chars)`);
    const jsonResult = await this.llmProvider.generateJson("backlogJson", jsonPrompt);
    const backlogJsonText = this.requireMarkdown(jsonResult?.markdown, "backlog json");
    const backlog = this.parseBacklogFromMarkdownResponse(backlogJsonText);
    const jsonUri = await this.store.writeJson("backlog.v1.json", backlog);
    this.logStage("backlog", `wrote backlog json with ${backlog.epics.length} epics`);
    return { jsonUri, markdownUri };
  }
  async generatePromptForTask(taskId, backlog) {
    const task = this.findTaskById(backlog, taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found in backlog.`);
    }
    const story = this.findStoryForTask(backlog, taskId);
    const contextBundle = await this.tryReadContextBundle();
    const architectureText = await this.readMarkdownIfExists("architecture.v1.md");
    const backlogText = await this.readMarkdownIfExists("backlog.v1.md");
    const prompt = buildTaskPromptPrompt({
      taskId: task.id,
      taskTitle: task.title,
      storyId: story?.id,
      storyTitle: story?.title,
      acceptanceCriteria: story?.acceptanceCriteria ?? [],
      architecture: architectureText,
      backlog: backlogText,
      contextSummary: this.buildContextSummary(contextBundle)
    });
    this.logStage("prompts", `requesting prompt for ${task.id} (${prompt.length} prompt chars)`);
    const result = await this.llmProvider.generateJson("promptTaskMarkdown", prompt);
    const content = this.requireMarkdown(result?.markdown, `prompt for ${task.id}`);
    this.logStage("prompts", `writing .ai-design/prompts/${taskId}.prompt.md (${content.length} chars)`);
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
  findStoryForTask(backlog, taskId) {
    for (const epic of backlog.epics) {
      for (const story of epic.stories) {
        for (const task of story.tasks) {
          if (task.id === taskId) {
            return story;
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
  async readMarkdownIfExists(relativePath) {
    if (!await this.store.fileExists(relativePath)) {
      return "";
    }
    try {
      return await this.store.readText(relativePath);
    } catch {
      return "";
    }
  }
  async getIdeaText() {
    if (!await this.store.fileExists("idea.json")) {
      return "";
    }
    try {
      const idea = await this.store.readJson("idea.json");
      const businessIdea = idea.businessIdea?.trim() ?? "";
      if (businessIdea) {
        return businessIdea;
      }
      const ignoredDefaults = /* @__PURE__ */ new Set([
        "Design Addin Idea",
        "Business Idea",
        "Describe the core workflow or pain point this addin should solve.",
        "Describe the core workflow or pain point this product should solve.",
        "Describe the expected measurable outcome if this succeeds."
      ]);
      const fallbackParts = [idea.title, idea.problem, idea.outcome].map((value) => value?.trim() ?? "").filter((value) => value && !ignoredDefaults.has(value));
      return fallbackParts.join("\n\n");
    } catch {
      return "";
    }
  }
  requireMarkdown(markdown, artifactName) {
    const content = markdown?.trim() ?? "";
    if (!content) {
      throw new Error(`OpenAI returned empty content for ${artifactName}`);
    }
    return content;
  }
  buildContextSummary(contextBundle) {
    if (!contextBundle) {
      return "No workspace context bundle found.";
    }
    const lines = [];
    lines.push(`Workspace root: ${contextBundle.rootFolder}`);
    lines.push(`Stack hint: ${contextBundle.stackHint}`);
    lines.push("Top relevant files:");
    for (const file of contextBundle.topRelevantFiles.slice(0, 25)) {
      lines.push(`- ${file}`);
    }
    lines.push("Candidate build commands:");
    for (const command of contextBundle.candidateBuildCommands.slice(0, 10)) {
      lines.push(`- ${command}`);
    }
    return lines.join("\n");
  }
  parseBacklogFromMarkdownResponse(markdown) {
    const payload = this.extractJsonPayload(markdown);
    let parsed;
    try {
      parsed = JSON.parse(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse backlog JSON from OpenAI output: ${message}`);
    }
    const root = this.asRecord(parsed);
    if (!root) {
      throw new Error("Backlog JSON root is not an object.");
    }
    const epicsRaw = Array.isArray(root.epics) ? root.epics : [];
    const epics = epicsRaw.map((epic, index) => this.normalizeEpic(epic, index)).filter((epic) => epic !== void 0);
    if (epics.length === 0) {
      throw new Error("Backlog JSON did not contain any valid epics.");
    }
    const generatedAt = typeof root.generatedAt === "string" && root.generatedAt.trim().length > 0 ? root.generatedAt : (/* @__PURE__ */ new Date()).toISOString();
    return {
      version: 1,
      generatedAt,
      epics
    };
  }
  extractJsonPayload(markdown) {
    const direct = markdown.trim();
    if (direct.startsWith("{") && direct.endsWith("}")) {
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
    const firstObjectStart = markdown.indexOf("{");
    const lastObjectEnd = markdown.lastIndexOf("}");
    if (firstObjectStart !== -1 && lastObjectEnd > firstObjectStart) {
      return markdown.slice(firstObjectStart, lastObjectEnd + 1).trim();
    }
    throw new Error("No JSON payload found in backlog conversion output.");
  }
  normalizeEpic(value, index) {
    const record = this.asRecord(value);
    if (!record) {
      return void 0;
    }
    const storiesRaw = Array.isArray(record.stories) ? record.stories : [];
    const stories = storiesRaw.map((story, storyIndex) => this.normalizeStory(story, index, storyIndex)).filter((story) => story !== void 0);
    if (stories.length === 0) {
      return void 0;
    }
    return {
      id: this.asNonEmptyString(record.id) ?? `EPIC-${index + 1}`,
      title: this.asNonEmptyString(record.title) ?? `Epic ${index + 1}`,
      stories
    };
  }
  normalizeStory(value, epicIndex, storyIndex) {
    const record = this.asRecord(value);
    if (!record) {
      return void 0;
    }
    const tasksRaw = Array.isArray(record.tasks) ? record.tasks : [];
    const tasks = tasksRaw.map((task, taskIndex) => this.normalizeTask(task, epicIndex, storyIndex, taskIndex)).filter((task) => task !== void 0);
    if (tasks.length === 0) {
      return void 0;
    }
    const acceptanceCriteria = Array.isArray(record.acceptanceCriteria) ? record.acceptanceCriteria.filter((criterion) => typeof criterion === "string").map((criterion) => criterion.trim()).filter((criterion) => criterion.length > 0) : [];
    return {
      id: this.asNonEmptyString(record.id) ?? `STORY-${epicIndex + 1}-${storyIndex + 1}`,
      title: this.asNonEmptyString(record.title) ?? `Story ${epicIndex + 1}.${storyIndex + 1}`,
      acceptanceCriteria,
      tasks
    };
  }
  normalizeTask(value, epicIndex, storyIndex, taskIndex) {
    const record = this.asRecord(value);
    if (!record) {
      return void 0;
    }
    const tags = Array.isArray(record.tags) ? record.tags.filter((tag) => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean) : [];
    const statusRaw = this.asNonEmptyString(record.status);
    const status = statusRaw === "done" || statusRaw === "in_progress" ? statusRaw : "todo";
    return {
      id: this.asNonEmptyString(record.id) ?? `TASK-${epicIndex + 1}-${storyIndex + 1}-${taskIndex + 1}`,
      title: this.asNonEmptyString(record.title) ?? `Task ${epicIndex + 1}.${storyIndex + 1}.${taskIndex + 1}`,
      tags,
      status,
      promptPath: null
    };
  }
  asRecord(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return void 0;
    }
    return value;
  }
  asNonEmptyString(value) {
    if (typeof value !== "string") {
      return void 0;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : void 0;
  }
  logStage(stage, message) {
    this.outputChannel?.appendLine(`[${stage}] ${(/* @__PURE__ */ new Date()).toISOString()} ${message}`);
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
var vscode5 = __toESM(require("vscode"));

// src/llm/OpenAiMarkdownGenerator.ts
var vscode4 = __toESM(require("vscode"));
var OpenAiMarkdownGenerator = class {
  async generateMarkdown(stage, inputs) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      await vscode4.window.showErrorMessage(
        `OpenAI API key is missing.

Windows (PowerShell):

setx OPENAI_API_KEY "your_key_here"
# then restart VS Code

macOS/Linux (zsh/bash):

export OPENAI_API_KEY="your_key_here"
# launch code from same terminal OR add to ~/.zshrc ~/.bashrc

VS Code must be restarted after setting env vars in most cases.`,
        { modal: true }
      );
      throw new Error("OPENAI_API_KEY is not set");
    }
    const model = vscode4.workspace.getConfiguration("designAddin.llm").get("model", "gpt-4.1-mini");
    const temperature = vscode4.workspace.getConfiguration("designAddin.llm").get("temperature", 0.2);
    const maxTokens = vscode4.workspace.getConfiguration("designAddin.llm").get("maxTokens", 3e3);
    const messages = this.buildMessages(stage, inputs);
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens
      })
    });
    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`OpenAI request failed (${response.status}): ${responseText}`);
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("OpenAI response did not contain markdown content");
    }
    return content;
  }
  buildMessages(stage, inputs) {
    if (inputs.prompt) {
      return [
        {
          role: "system",
          content: "You are a senior product and engineering assistant. Follow the user instructions exactly and return markdown only."
        },
        { role: "user", content: inputs.prompt }
      ];
    }
    const systemByStage = {
      brief: "You are an expert product manager and technical writer. Produce clear, structured output and avoid fluff. Infer the product domain from the user idea and do not assume VS Code extension specifics unless explicitly requested.",
      architecture: "You are a senior software architect. You design pragmatic architectures with clear module boundaries, data contracts, and implementation details. Infer platform and stack from the provided context and do not assume VS Code extension specifics unless explicitly requested.",
      backlog: "You are a technical product owner. You create backlogs with epics, user stories, acceptance criteria, and implementation notes aligned to the product domain described in context.",
      prompts: "You are a senior engineer who writes precise implementation prompts for coding agents. Your prompts must be actionable and reference exact file paths, functions, and test steps. Infer stack and runtime from the provided artifacts."
    };
    const userByStage = {
      brief: inputs.idea ?? "",
      architecture: `IDEA:
${inputs.idea ?? ""}

BRIEF:
${inputs.brief ?? ""}`,
      backlog: `IDEA:
${inputs.idea ?? ""}

BRIEF:
${inputs.brief ?? ""}

ARCHITECTURE:
${inputs.architecture ?? ""}`,
      prompts: `ARCHITECTURE:
${inputs.architecture ?? ""}

BACKLOG:
${inputs.backlog ?? ""}`
    };
    return [
      { role: "system", content: systemByStage[stage] },
      { role: "user", content: userByStage[stage] }
    ];
  }
};

// src/llm/OpenAiLlmProvider.ts
var OpenAiLlmProvider = class {
  generator = new OpenAiMarkdownGenerator();
  async generateJson(schemaName, prompt) {
    const stage = this.mapSchemaToStage(schemaName);
    const inputs = { prompt };
    const markdown = await this.generator.generateMarkdown(stage, inputs);
    return { markdown };
  }
  mapSchemaToStage(schemaName) {
    const normalized = schemaName.toLowerCase();
    if (normalized.includes("brief")) {
      return "brief";
    }
    if (normalized.includes("architecture")) {
      return "architecture";
    }
    if (normalized.includes("backlog")) {
      return "backlog";
    }
    return "prompts";
  }
};

// src/llm/LlmProviderFactory.ts
function createLlmProvider() {
  return new OpenAiLlmProvider();
}

// src/ui/DesignStudioPanel.ts
var DEFAULT_WORKSPACE_PATH = "C:\\Users\\Johan\\source\\repos\\TextAdven";
var DesignStudioPanel = class _DesignStudioPanel {
  constructor(panel, context, extensionUri, outputChannel) {
    this.panel = panel;
    this.context = context;
    this.extensionUri = extensionUri;
    this.outputChannel = outputChannel;
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
  outputChannel;
  static async createOrShow(context, extensionUri, outputChannel) {
    const column = vscode5.window.activeTextEditor?.viewColumn ?? vscode5.ViewColumn.One;
    if (_DesignStudioPanel.currentPanel) {
      _DesignStudioPanel.currentPanel.panel.reveal(column);
      await _DesignStudioPanel.currentPanel.refreshAll();
      return;
    }
    const panel = vscode5.window.createWebviewPanel(_DesignStudioPanel.viewType, "Design Studio", column, {
      enableScripts: true,
      retainContextWhenHidden: true
    });
    _DesignStudioPanel.currentPanel = new _DesignStudioPanel(panel, context, extensionUri, outputChannel);
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
      title: existingIdea.title ?? "Business Idea",
      problem: existingIdea.problem ?? "Describe the core workflow or pain point this product should solve.",
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
      const entries = await vscode5.workspace.fs.readDirectory(promptsRoot);
      for (const [name, fileType] of entries) {
        if (fileType !== vscode5.FileType.File || !name.endsWith(".prompt.md")) {
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
    await vscode5.commands.executeCommand("vscode.open", uri);
  }
  async openLastRunLog(store) {
    if (!await store.fileExists("runs/last.json")) {
      this.postToast("error", "No last run log found yet.");
      return;
    }
    const uri = store.resolveDesignPath("runs/last.json");
    await vscode5.commands.executeCommand("vscode.open", uri);
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
    const workspaceRoot = vscode5.workspace.workspaceFolders?.[0]?.uri;
    if (!workspaceRoot) {
      const defaultWorkspaceUri = vscode5.Uri.file(DEFAULT_WORKSPACE_PATH);
      await vscode5.commands.executeCommand("vscode.openFolder", defaultWorkspaceUri, false);
      return null;
    }
    const store = new ArtifactStore(workspaceRoot);
    const scanner = new WorkspaceScanner(workspaceRoot, store);
    this.outputChannel.appendLine(`[config] workspace=${workspaceRoot.fsPath} llm.provider=openai`);
    const llmProvider = createLlmProvider();
    const pipeline = new Pipeline(store, { llmProvider, outputChannel: this.outputChannel });
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
			background: #000;
			color: #fff;
			line-height: 1.45;
		}
		.markdown-output * {
			color: #fff;
		}
		.markdown-output h1, .markdown-output h2, .markdown-output h3 {
			margin: 0 0 8px;
			color: #fff;
		}
		.markdown-output p {
			margin: 0 0 8px;
		}
		.markdown-output ul {
			margin: 0 0 8px 20px;
			padding: 0;
		}
		.markdown-output pre {
			background: #000;
			border: 1px solid var(--line);
			border-radius: 6px;
			padding: 8px;
			overflow: auto;
			white-space: pre-wrap;
			color: #fff;
		}
		.markdown-output code {
			background: #000;
			color: #fff;
			border-radius: 4px;
			padding: 1px 4px;
		}
		.markdown-output ::selection {
			background: #1f2937;
			color: #fff;
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

// src/webview/panel.ts
var vscode7 = __toESM(require("vscode"));

// src/storage.ts
var vscode6 = __toESM(require("vscode"));
function artifactFileName(name) {
  return `${name}.md`;
}
function artifactRelativePath(name) {
  return `.design-addin/${artifactFileName(name)}`;
}
var DesignAddinStorage = class {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.rootUri = vscode6.Uri.joinPath(workspaceRoot, ".design-addin");
  }
  rootUri;
  async ensureRoot() {
    await vscode6.workspace.fs.createDirectory(this.rootUri);
  }
  getArtifactUri(name) {
    return vscode6.Uri.joinPath(this.rootUri, artifactFileName(name));
  }
  async writeArtifact(name, content) {
    await this.ensureRoot();
    const uri = this.getArtifactUri(name);
    await vscode6.workspace.fs.writeFile(uri, Buffer.from(content, "utf8"));
    return uri;
  }
  async readArtifact(name) {
    const uri = this.getArtifactUri(name);
    const bytes = await vscode6.workspace.fs.readFile(uri);
    return Buffer.from(bytes).toString("utf8");
  }
  async exists(name) {
    try {
      await vscode6.workspace.fs.stat(this.getArtifactUri(name));
      return true;
    } catch {
      return false;
    }
  }
};

// src/webview/panel.ts
var ArtifactPanel = class _ArtifactPanel {
  constructor(panel, context, onMessage) {
    this.panel = panel;
    this.context = context;
    this.onMessage = onMessage;
    this.panel.webview.html = this.getHtml();
    this.panel.onDidDispose(() => {
      _ArtifactPanel.current = void 0;
    });
    this.panel.webview.onDidReceiveMessage((message) => {
      void this.onMessage(message);
    });
  }
  static current;
  artifacts = {
    idea: "",
    brief: "",
    architecture: "",
    backlog: "",
    prompts: ""
  };
  static createOrShow(context, onMessage) {
    const column = vscode7.window.activeTextEditor?.viewColumn ?? vscode7.ViewColumn.One;
    if (_ArtifactPanel.current) {
      _ArtifactPanel.current.panel.reveal(column);
      return _ArtifactPanel.current;
    }
    const panel = vscode7.window.createWebviewPanel("designAddin.artifacts", "Design Add-in Artifacts", column, {
      enableScripts: true,
      retainContextWhenHidden: true
    });
    _ArtifactPanel.current = new _ArtifactPanel(panel, context, onMessage);
    return _ArtifactPanel.current;
  }
  updateArtifact(name, content) {
    this.artifacts[name] = content;
    void this.panel.webview.postMessage({ type: "artifact", name, content });
  }
  setStatus(message, isError = false) {
    void this.panel.webview.postMessage({ type: "status", message, isError });
  }
  getIdea() {
    return this.artifacts.idea;
  }
  getHtml() {
    const nonce = Math.random().toString(36).slice(2);
    return `<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8" />
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<style>
		body{font-family:Segoe UI, sans-serif;background:#0d1526;color:#d9e2f1;margin:0}
		.top{padding:10px;border-bottom:1px solid #2e3b55}
		.tabs{display:flex;gap:8px;padding:8px 10px}
		.tab-btn{background:transparent;border:1px solid #2e3b55;color:#d9e2f1;padding:6px 10px;border-radius:6px;cursor:pointer}
		.tab-btn.active{border-color:#31c48d}
		.panel{display:none;padding:10px}
		.panel.active{display:block}
		textarea{width:100%;min-height:360px;background:#0b1220;color:#d9e2f1;border:1px solid #2e3b55;border-radius:6px;padding:8px;font-family:Consolas,monospace}
		.row{display:flex;gap:8px;align-items:center;margin:8px 0}
		button{background:transparent;border:1px solid #2e3b55;color:#d9e2f1;padding:6px 10px;border-radius:6px;cursor:pointer}
		button:hover{border-color:#31c48d}
		.status{font-size:12px;color:#99a8be}
		.status.error{color:#ff8a8a}
	</style>
</head>
<body>
	<div class="top">
		<div id="status" class="status">Ready</div>
		<div class="status">Stored under ${artifactRelativePath("idea").replace("/idea.md", "/")}</div>
	</div>
	<div class="tabs">
		<button class="tab-btn active" data-tab="idea">Idea</button>
		<button class="tab-btn" data-tab="brief">Brief</button>
		<button class="tab-btn" data-tab="architecture">Architecture</button>
		<button class="tab-btn" data-tab="backlog">Backlog</button>
		<button class="tab-btn" data-tab="prompts">Prompts</button>
	</div>
	${this.tabHtml("idea", true)}
	${this.tabHtml("brief")}
	${this.tabHtml("architecture")}
	${this.tabHtml("backlog")}
	${this.tabHtml("prompts")}
	<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		const names = ['idea','brief','architecture','backlog','prompts'];
		let current = 'idea';

		function show(name){
			current = name;
			document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
			document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
			document.getElementById('panel-'+name).classList.add('active');
			document.querySelector('.tab-btn[data-tab="'+name+'"]').classList.add('active');
		}
		function copyCurrent(name){
			const value = document.getElementById(name + '-text').value || '';
			navigator.clipboard.writeText(value);
		}
		function regenerate(name){
			const includeDownstream = document.getElementById(name + '-down').checked;
			vscode.postMessage({ type:'regenerate', artifact:name, includeDownstream });
		}

		document.querySelectorAll('.tab-btn').forEach(btn=>{
			btn.addEventListener('click',()=>show(btn.dataset.tab));
		});
		names.forEach(name=>{
			const copy = document.getElementById(name+'-copy');
			if(copy){ copy.addEventListener('click',()=>copyCurrent(name)); }
			const regen = document.getElementById(name+'-regen');
			if(regen){ regen.addEventListener('click',()=>regenerate(name)); }
			if(name==='idea'){
				document.getElementById('idea-text').addEventListener('input',(e)=>{
					vscode.postMessage({ type:'saveIdea', content:e.target.value });
				});
			}
		});

		window.addEventListener('message', event=>{
			const msg = event.data;
			if(msg.type==='artifact'){
				const el = document.getElementById(msg.name + '-text');
				if(el && el !== document.activeElement){ el.value = msg.content || ''; }
			}
			if(msg.type==='status'){
				const status = document.getElementById('status');
				status.textContent = msg.message || '';
				status.className = msg.isError ? 'status error' : 'status';
			}
		});
	</script>
</body>
</html>`;
  }
  tabHtml(name, isIdea = false) {
    return `<section class="panel${isIdea ? " active" : ""}" id="panel-${name}">
	<div class="row">
		<button id="${name}-copy">Copy to clipboard</button>
		${isIdea ? "" : `<button id="${name}-regen">Regenerate</button><label><input id="${name}-down" type="checkbox" checked/> include downstream</label>`}
	</div>
	<textarea id="${name}-text" ${isIdea ? "" : "readonly"}></textarea>
</section>`;
  }
};

// src/promptTemplates.ts
function briefPromptFromIdea(idea) {
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
function architecturePromptFromIdeaAndBrief(idea, brief) {
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
function backlogPromptFromInputs(idea, brief, architecture) {
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
function promptSetFromBacklogAndArchitecture(backlog, architecture) {
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

// src/artifactPipeline.ts
var ArtifactPipeline = class {
  constructor(storage, client, output) {
    this.storage = storage;
    this.client = client;
    this.output = output;
  }
  async generateAll(idea, onUpdate, progress) {
    const artifacts = {
      idea: idea.trim(),
      brief: "",
      architecture: "",
      backlog: "",
      prompts: ""
    };
    await this.storage.writeArtifact("idea", artifacts.idea);
    onUpdate("idea", artifacts.idea);
    const steps = [
      {
        key: "brief",
        label: "Generating brief",
        run: () => this.runStep("brief", briefPromptFromIdea(artifacts.idea))
      },
      {
        key: "architecture",
        label: "Generating architecture",
        run: () => this.runStep("architecture", architecturePromptFromIdeaAndBrief(artifacts.idea, artifacts.brief))
      },
      {
        key: "backlog",
        label: "Generating backlog",
        run: () => this.runStep("backlog", backlogPromptFromInputs(artifacts.idea, artifacts.brief, artifacts.architecture))
      },
      {
        key: "prompts",
        label: "Generating prompt set",
        run: () => this.runStep("prompts", promptSetFromBacklogAndArchitecture(artifacts.backlog, artifacts.architecture))
      }
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
    const idea = await this.safeRead("idea");
    const brief = await this.safeRead("brief");
    const architecture = await this.safeRead("architecture");
    const backlog = await this.safeRead("backlog");
    const order = ["brief", "architecture", "backlog", "prompts"];
    const startIndex = order.indexOf(start);
    const selected = includeDownstream ? order.slice(startIndex) : [start];
    let currentBrief = brief;
    let currentArchitecture = architecture;
    let currentBacklog = backlog;
    for (const item of selected) {
      if (item === "brief") {
        const result2 = await this.runStep("brief", briefPromptFromIdea(idea));
        currentBrief = result2.content;
        onUpdate("brief", result2.content);
        continue;
      }
      if (item === "architecture") {
        const result2 = await this.runStep("architecture", architecturePromptFromIdeaAndBrief(idea, currentBrief));
        currentArchitecture = result2.content;
        onUpdate("architecture", result2.content);
        continue;
      }
      if (item === "backlog") {
        const result2 = await this.runStep("backlog", backlogPromptFromInputs(idea, currentBrief, currentArchitecture));
        currentBacklog = result2.content;
        onUpdate("backlog", result2.content);
        continue;
      }
      const result = await this.runStep("prompts", promptSetFromBacklogAndArchitecture(currentBacklog, currentArchitecture));
      onUpdate("prompts", result.content);
    }
  }
  async runStep(name, prompt) {
    this.output.appendLine(`[pipeline] ${name} started`);
    const started = Date.now();
    const result = await this.client.generateMarkdown(prompt);
    await this.storage.writeArtifact(name, result.content);
    const elapsedMs = Date.now() - started;
    const usageText = result.usage?.totalTokens ? `tokens total=${result.usage.totalTokens}` : "tokens unavailable";
    this.output.appendLine(`[pipeline] ${name} finished in ${elapsedMs}ms (${usageText})`);
    return {
      name,
      content: result.content,
      usageText,
      elapsedMs
    };
  }
  async safeRead(name) {
    if (!await this.storage.exists(name)) {
      return "";
    }
    return this.storage.readArtifact(name);
  }
};

// src/openaiClient.ts
function buildChatCompletionsRequest(options, prompt) {
  return {
    model: options.model,
    temperature: options.temperature,
    max_tokens: options.maxOutputTokens,
    messages: [{ role: "user", content: prompt }]
  };
}
var OpenAiClient = class {
  constructor(apiKey, options, output) {
    this.apiKey = apiKey;
    this.options = options;
    this.output = output;
  }
  async generateMarkdown(prompt) {
    const requestBody = buildChatCompletionsRequest(this.options, prompt);
    const endpoint = `${this.options.baseUrl ?? "https://api.openai.com"}/v1/chat/completions`;
    const start = Date.now();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });
    const elapsed = Date.now() - start;
    if (!response.ok) {
      const errorText = await response.text();
      this.output.appendLine(`[openai] failed ${response.status} in ${elapsed}ms`);
      throw new Error(`OpenAI error ${response.status}: ${errorText}`);
    }
    const json = await response.json();
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("OpenAI returned an empty completion.");
    }
    this.output.appendLine(`[openai] success in ${elapsed}ms`);
    return {
      content,
      usage: {
        promptTokens: json.usage?.prompt_tokens,
        completionTokens: json.usage?.completion_tokens,
        totalTokens: json.usage?.total_tokens
      }
    };
  }
};

// src/extension.ts
var DEFAULT_WORKSPACE_PATH2 = "C:\\Users\\Johan\\source\\repos\\TextAdven";
function activate(context) {
  const output = vscode8.window.createOutputChannel("Design Add-in");
  context.subscriptions.push(output);
  output.appendLine(`[activate] ${(/* @__PURE__ */ new Date()).toISOString()} extension activated`);
  let artifactsPanel;
  const register = (commandId, action) => {
    const disposable = vscode8.commands.registerCommand(commandId, async () => {
      try {
        output.appendLine(`[command] ${(/* @__PURE__ */ new Date()).toISOString()} ${commandId}`);
        if (commandId === "designAddin.generateBrief" || commandId === "designAddin.generateArchitecture" || commandId === "designAddin.generateBacklog" || commandId === "designAddin.generatePromptForTask") {
          output.show(true);
        }
        await action();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        output.appendLine(`[command] ${commandId} failed: ${message}`);
        vscode8.window.showErrorMessage(`${commandId} failed: ${message}`);
      }
    });
    context.subscriptions.push(disposable);
  };
  register("designAddin.openStudio", async () => {
    await DesignStudioPanel.createOrShow(context, context.extensionUri, output);
  });
  register("designAddin.generateArtifacts", async () => {
    const workspaceRoot = await ensureWorkspaceRoot();
    if (!workspaceRoot) {
      return;
    }
    const idea = await vscode8.window.showInputBox({
      title: "Design Add-in: Enter Idea",
      prompt: "Describe the software/business idea to generate artifacts from.",
      placeHolder: "Example: AI-assisted sprint planning extension for small teams",
      ignoreFocusOut: true
    });
    if (!idea?.trim()) {
      vscode8.window.showWarningMessage("Idea is required to generate artifacts.");
      return;
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      await vscode8.window.showErrorMessage(
        "OPENAI_API_KEY is not set.",
        {
          modal: true,
          detail: "Set OPENAI_API_KEY in your terminal/session environment and restart VS Code. If using Extension Development Host, set it in the launch/task environment as well."
        }
      );
      return;
    }
    const storage = new DesignAddinStorage(workspaceRoot);
    const model = vscode8.workspace.getConfiguration("designAddin").get("openaiModel", "gpt-4.1-mini");
    const maxOutputTokens = vscode8.workspace.getConfiguration("designAddin").get("maxOutputTokens", 3e3);
    const client = new OpenAiClient(
      apiKey,
      {
        model,
        temperature: 0.2,
        maxOutputTokens
      },
      output
    );
    const pipeline = new ArtifactPipeline(storage, client, output);
    const getPanel = () => {
      if (artifactsPanel) {
        return artifactsPanel;
      }
      artifactsPanel = ArtifactPanel.createOrShow(context, async (message) => {
        const root = await ensureWorkspaceRoot();
        if (!root) {
          return;
        }
        const panelStorage = new DesignAddinStorage(root);
        const panelClient = new OpenAiClient(
          apiKey,
          { model, temperature: 0.2, maxOutputTokens },
          output
        );
        const panelPipeline = new ArtifactPipeline(panelStorage, panelClient, output);
        if (message.type === "saveIdea") {
          await panelStorage.writeArtifact("idea", message.content);
          return;
        }
        await vscode8.window.withProgress(
          { location: vscode8.ProgressLocation.Notification, title: `Regenerating ${message.artifact}` },
          async () => {
            await panelPipeline.regenerateFrom(
              message.artifact,
              (name, content) => {
                getPanel().updateArtifact(name, content);
              },
              message.includeDownstream
            );
          }
        );
      });
      return artifactsPanel;
    };
    const panel = getPanel();
    panel.setStatus("Generating artifacts...");
    panel.updateArtifact("idea", idea);
    try {
      await vscode8.window.withProgress(
        { location: vscode8.ProgressLocation.Notification, title: "Design Add-in: Generate Artifacts" },
        async (progress) => {
          await pipeline.generateAll(
            idea,
            (name, content) => {
              panel.updateArtifact(name, content);
            },
            progress
          );
        }
      );
      panel.setStatus("Artifacts generated successfully.");
      vscode8.window.showInformationMessage("Generated .design-addin artifacts.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      output.appendLine(`[pipeline] ERROR ${message}`);
      panel.setStatus(`Error: ${message}`, true);
      vscode8.window.showErrorMessage(`Artifact generation failed: ${message}`);
    }
  });
  register("designAddin.newIdea", async () => {
    const services = await getServices(output);
    if (!services) {
      return;
    }
    await services.store.ensureDesignFolder();
    const uri = await services.pipeline.newIdea();
    await openTextDocument(uri);
    vscode8.window.showInformationMessage("Created .ai-design/idea.json");
  });
  register("designAddin.generateBrief", async () => {
    const services = await getServices(output);
    if (!services) {
      return;
    }
    await services.store.ensureDesignFolder();
    const uri = await services.pipeline.generateBrief();
    await openTextDocument(uri);
    vscode8.window.showInformationMessage("Created .ai-design/brief.v1.md");
  });
  register("designAddin.generateArchitecture", async () => {
    const services = await getServices(output);
    if (!services) {
      return;
    }
    await services.store.ensureDesignFolder();
    const uri = await services.pipeline.generateArchitecture();
    await openTextDocument(uri);
    vscode8.window.showInformationMessage("Created .ai-design/architecture.v1.md");
  });
  register("designAddin.generateBacklog", async () => {
    const services = await getServices(output);
    if (!services) {
      return;
    }
    await services.store.ensureDesignFolder();
    const { jsonUri, markdownUri } = await services.pipeline.generateBacklog();
    await openTextDocument(markdownUri);
    vscode8.window.showInformationMessage(
      `Created backlog artifacts: ${vscode8.workspace.asRelativePath(jsonUri)}, ${vscode8.workspace.asRelativePath(markdownUri)}`
    );
  });
  register("designAddin.generatePromptForTask", async () => {
    const services = await getServices(output);
    if (!services) {
      return;
    }
    await services.store.ensureDesignFolder();
    if (!await services.store.fileExists("backlog.v1.json")) {
      vscode8.window.showWarningMessage('Backlog not found. Run "Generate Backlog" first.');
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
    vscode8.window.showInformationMessage(`Created prompt for ${selectedTask.task.id}`);
  });
  register("designAddin.runTaskWithCodex", async () => {
    const services = await getServices(output);
    if (!services) {
      return;
    }
    await services.store.ensureDesignFolder();
    if (!await services.store.fileExists("backlog.v1.json")) {
      vscode8.window.showWarningMessage('Backlog not found. Run "Generate Backlog" first.');
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
    vscode8.window.showInformationMessage(
      `Started Codex for ${selectedTask.task.id}. Run log: ${runLog.runLogPath}`
    );
  });
  register("designAddin.rescanWorkspaceContext", async () => {
    const services = await getServices(output);
    if (!services) {
      return;
    }
    await services.store.ensureDesignFolder();
    const uri = await services.scanner.scanAndStoreContextBundle();
    await openTextDocument(uri);
    vscode8.window.showInformationMessage("Updated .ai-design/contextBundle.json");
  });
}
async function getServices(outputChannel) {
  const workspaceRoot = await ensureWorkspaceRoot();
  if (!workspaceRoot) {
    return null;
  }
  const store = new ArtifactStore(workspaceRoot);
  const scanner = new WorkspaceScanner(workspaceRoot, store);
  outputChannel?.appendLine(`[config] workspace=${workspaceRoot.fsPath} llm.provider=openai`);
  const llmProvider = createLlmProvider();
  const pipeline = new Pipeline(store, { llmProvider, outputChannel });
  return { workspaceRoot, store, scanner, pipeline };
}
async function ensureWorkspaceRoot() {
  const workspaceRoot = vscode8.workspace.workspaceFolders?.[0]?.uri;
  if (workspaceRoot) {
    return workspaceRoot;
  }
  const defaultWorkspaceUri = vscode8.Uri.file(DEFAULT_WORKSPACE_PATH2);
  await vscode8.commands.executeCommand("vscode.openFolder", defaultWorkspaceUri, false);
  return null;
}
async function openTextDocument(uri) {
  const document = await vscode8.workspace.openTextDocument(uri);
  await vscode8.window.showTextDocument(document, { preview: false });
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
    vscode8.window.showWarningMessage("No tasks found in backlog.v1.json.");
    return void 0;
  }
  const selection = await vscode8.window.showQuickPick(picks, {
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
