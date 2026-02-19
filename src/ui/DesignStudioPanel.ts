import * as vscode from 'vscode';
import { ArtifactStore } from '../core/ArtifactStore';
import { CodexRunner, RunLog } from '../core/CodexRunner';
import { Backlog, Pipeline } from '../core/Pipeline';
import { WorkspaceScanner } from '../core/WorkspaceScanner';
import { createLlmProvider } from '../llm/LlmProviderFactory';

const DEFAULT_WORKSPACE_PATH = 'C:\\Users\\Johan\\source\\repos\\TextAdven';

type StudioMessage =
	| { type: 'newIdea' }
	| { type: 'saveIdea'; businessIdea: string }
	| { type: 'generateBrief' }
	| { type: 'generateArchitecture' }
	| { type: 'generateBacklog' }
	| { type: 'prompts'; taskId?: string }
	| { type: 'generatePromptForTask'; taskId: string }
	| { type: 'runCodex'; taskId?: string }
	| { type: 'selectTask'; taskId: string };
type StudioFileActionMessage = { type: 'openPromptFile'; taskId: string } | { type: 'openRunLog' };
type StudioInboundMessage = StudioMessage | StudioFileActionMessage;

export class DesignStudioPanel {
	public static readonly viewType = 'designAddin.studio';
	private static currentPanel: DesignStudioPanel | undefined;

	public static async createOrShow(
		context: vscode.ExtensionContext,
		extensionUri: vscode.Uri
	): Promise<void> {
		const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;
		if (DesignStudioPanel.currentPanel) {
			DesignStudioPanel.currentPanel.panel.reveal(column);
			await DesignStudioPanel.currentPanel.refreshAll();
			return;
		}

		const panel = vscode.window.createWebviewPanel(DesignStudioPanel.viewType, 'Design Studio', column, {
			enableScripts: true,
			retainContextWhenHidden: true,
		});

		DesignStudioPanel.currentPanel = new DesignStudioPanel(panel, context, extensionUri);
		await DesignStudioPanel.currentPanel.initialize();
	}

	private constructor(
		private readonly panel: vscode.WebviewPanel,
		private readonly context: vscode.ExtensionContext,
		private readonly extensionUri: vscode.Uri
	) {
		this.panel.onDidDispose(() => this.dispose(), null, this.context.subscriptions);
		this.panel.webview.onDidReceiveMessage(
			(message: StudioInboundMessage) => {
				void this.handleMessage(message);
			},
			null,
			this.context.subscriptions
		);
	}

	private async initialize(): Promise<void> {
		this.panel.webview.html = this.getHtml(this.panel.webview, this.extensionUri);
		await this.refreshAll();
	}

	private dispose(): void {
		DesignStudioPanel.currentPanel = undefined;
	}

	private async handleMessage(message: StudioInboundMessage): Promise<void> {
		try {
			const services = await this.getServices();
			if (!services) {
				return;
			}
			await services.store.ensureDesignFolder();

			switch (message.type) {
				case 'newIdea':
					await services.pipeline.newIdea();
					this.postToast('info', 'Created .ai-design/idea.json');
					await this.refreshAll(services);
					return;
				case 'saveIdea':
					await this.saveIdea(services.store, message.businessIdea);
					return;
				case 'generateBrief':
					await services.pipeline.generateBrief();
					this.postToast('info', 'Created .ai-design/brief.v1.md');
					await this.refreshAll(services);
					return;
				case 'generateArchitecture':
					await services.pipeline.generateArchitecture();
					this.postToast('info', 'Created .ai-design/architecture.v1.md');
					await this.refreshAll(services);
					return;
				case 'generateBacklog':
					await services.pipeline.generateBacklog();
					this.postToast('info', 'Created backlog artifacts');
					await this.refreshAll(services);
					return;
				case 'prompts':
					await this.handlePromptsAction(services, message.taskId);
					await this.refreshAll(services);
					return;
				case 'generatePromptForTask':
					await this.handlePromptsAction(services, message.taskId);
					await this.refreshAll(services);
					return;
				case 'runCodex':
					await this.runTaskWithCodex(services, message.taskId);
					await this.refreshAll(services);
					return;
				case 'selectTask':
					await this.sendPromptForTask(message.taskId, services.store);
					return;
				case 'openPromptFile':
					await this.openPromptFile(message.taskId, services.store);
					return;
				case 'openRunLog':
					await this.openLastRunLog(services.store);
					return;
			}
		} catch (error) {
			const messageText = error instanceof Error ? error.message : String(error);
			this.postToast('error', messageText);
		}
	}

	private async runTaskWithCodex(services: StudioServices, requestedTaskId?: string): Promise<void> {
		if (!(await services.store.fileExists('backlog.v1.json'))) {
			this.postToast('error', 'Backlog not found. Generate backlog first.');
			return;
		}

		const backlog = await services.store.readJson<Backlog>('backlog.v1.json');
		const taskId = requestedTaskId ?? this.findFirstTaskId(backlog);
		if (!taskId) {
			this.postToast('error', 'No tasks found in backlog.');
			return;
		}

		if (!this.findStoryForTask(backlog, taskId)) {
			this.postToast('error', `Task ${taskId} not found in backlog.`);
			return;
		}

		const promptUri = await this.ensurePromptForTask(taskId, backlog, services);
		const runner = new CodexRunner(services.store);
		const runLog = await runner.runPrompt(promptUri, services.workspaceRoot, taskId);

		this.panel.webview.postMessage({
			type: 'runLog',
			content: `${runLog.startedAt} started ${runLog.taskId} using terminal "${runLog.terminalName}"`,
		});
		this.panel.webview.postMessage({
			type: 'lastRun',
			json: runLog,
		});
		this.postToast('info', `Started Codex for ${taskId}. Run log: ${runLog.runLogPath}`);
	}

	private async handlePromptsAction(services: StudioServices, requestedTaskId?: string): Promise<void> {
		if (!(await services.store.fileExists('backlog.v1.json'))) {
			this.postToast('error', 'Backlog not found. Generate backlog first.');
			return;
		}

		const backlog = await services.store.readJson<Backlog>('backlog.v1.json');
		const taskId = requestedTaskId ?? this.findFirstTaskId(backlog);
		if (!taskId) {
			this.postToast('error', 'No tasks found in backlog.');
			return;
		}

		if (!this.findStoryForTask(backlog, taskId)) {
			this.postToast('error', `Task ${taskId} not found in backlog.`);
			return;
		}

		await this.ensurePromptForTask(taskId, backlog, services);
		this.postToast('info', `Created prompt for ${taskId}`);
		await this.sendPromptForTask(taskId, services.store);
	}

	private async ensurePromptForTask(taskId: string, backlog: Backlog, services: StudioServices): Promise<vscode.Uri> {
		const promptRelativePath = `prompts/${taskId}.prompt.md`;
		if (!(await services.store.fileExists(promptRelativePath))) {
			await services.scanner.scanAndStoreContextBundle();
			await services.pipeline.generatePromptForTask(taskId, backlog);
		}
		return services.store.resolveDesignPath(promptRelativePath);
	}

	private async refreshAll(existingServices?: StudioServices): Promise<void> {
		const services = existingServices ?? (await this.getServices());
		if (!services) {
			return;
		}
		await services.store.ensureDesignFolder();
		await services.scanner.scanAndStoreContextBundle();
		await this.sendIdea(services.store);

		await this.sendArtifact('brief', 'brief.v1.md', services.store);
		await this.sendArtifact('architecture', 'architecture.v1.md', services.store);

		if (await services.store.fileExists('backlog.v1.json')) {
			const backlogJson = await services.store.readJson<Backlog>('backlog.v1.json');
			const backlogMarkdown = await services.store.readText('backlog.v1.md').catch(() => '');
			this.panel.webview.postMessage({
				type: 'backlog',
				json: backlogJson,
				markdown: backlogMarkdown,
			});
		} else {
			this.panel.webview.postMessage({
				type: 'backlog',
				json: null,
				markdown: '',
			});
		}

		await this.sendPromptsList(services.store);
		await this.sendLastRun(services.store);
	}

	private async sendIdea(store: ArtifactStore): Promise<void> {
		let idea: { businessIdea?: string } | null = null;
		if (await store.fileExists('idea.json')) {
			try {
				idea = await store.readJson<{ businessIdea?: string }>('idea.json');
			} catch {
				idea = null;
			}
		}

		this.panel.webview.postMessage({
			type: 'idea',
			businessIdea: idea?.businessIdea ?? '',
		});
	}

	private async saveIdea(store: ArtifactStore, businessIdea: string): Promise<void> {
		let existingIdea: Record<string, unknown> = {};
		if (await store.fileExists('idea.json')) {
			try {
				existingIdea = await store.readJson<Record<string, unknown>>('idea.json');
			} catch {
				existingIdea = {};
			}
		}

		const merged = {
			version: (existingIdea.version as number) ?? 1,
			createdAt: (existingIdea.createdAt as string) ?? new Date().toISOString(),
			title: (existingIdea.title as string) ?? 'Design Addin Idea',
			problem:
				(existingIdea.problem as string) ??
				'Describe the core workflow or pain point this addin should solve.',
			outcome:
				(existingIdea.outcome as string) ??
				'Describe the expected measurable outcome if this succeeds.',
			businessIdea,
		};

		await store.writeJson('idea.json', merged);
		this.panel.webview.postMessage({
			type: 'ideaSaved',
			at: new Date().toISOString(),
		});
	}

	private async sendArtifact(name: string, relativePath: string, store: ArtifactStore): Promise<void> {
		let content = '';
		if (await store.fileExists(relativePath)) {
			content = await store.readText(relativePath);
		}
		this.panel.webview.postMessage({
			type: 'artifact',
			name,
			content,
		});
	}

	private async sendPromptsList(store: ArtifactStore): Promise<void> {
		const promptsRoot = store.resolveDesignPath('prompts');
		const items: Array<{ taskId: string; promptPath: string }> = [];

		try {
			const entries = await vscode.workspace.fs.readDirectory(promptsRoot);
			for (const [name, fileType] of entries) {
				if (fileType !== vscode.FileType.File || !name.endsWith('.prompt.md')) {
					continue;
				}
				const taskId = name.replace('.prompt.md', '');
				items.push({
					taskId,
					promptPath: `.ai-design/prompts/${name}`,
				});
			}
		} catch {
			// Prompts directory may not exist yet.
		}

		this.panel.webview.postMessage({
			type: 'promptsList',
			items,
		});
	}

	private async sendPromptForTask(taskId: string, store: ArtifactStore): Promise<void> {
		const promptPath = `prompts/${taskId}.prompt.md`;
		let content = '';
		if (await store.fileExists(promptPath)) {
			content = await store.readText(promptPath);
		}
		this.panel.webview.postMessage({
			type: 'promptPreview',
			taskId,
			content,
		});
		if (!content) {
			this.postToast('info', `No prompt exists for ${taskId} yet.`);
		}
	}

	private async sendLastRun(store: ArtifactStore): Promise<void> {
		let lastRun: RunLog | null = null;
		if (await store.fileExists('runs/last.json')) {
			lastRun = await store.readJson<RunLog>('runs/last.json');
		}
		this.panel.webview.postMessage({
			type: 'lastRun',
			json: lastRun,
		});
	}

	private async openPromptFile(taskId: string, store: ArtifactStore): Promise<void> {
		const uri = store.resolveDesignPath(`prompts/${taskId}.prompt.md`);
		if (!(await store.fileExists(`prompts/${taskId}.prompt.md`))) {
			this.postToast('error', `Prompt file for ${taskId} does not exist.`);
			return;
		}
		await vscode.commands.executeCommand('vscode.open', uri);
	}

	private async openLastRunLog(store: ArtifactStore): Promise<void> {
		if (!(await store.fileExists('runs/last.json'))) {
			this.postToast('error', 'No last run log found yet.');
			return;
		}
		const uri = store.resolveDesignPath('runs/last.json');
		await vscode.commands.executeCommand('vscode.open', uri);
	}

	private postToast(level: 'info' | 'error', message: string): void {
		this.panel.webview.postMessage({
			type: 'toast',
			level,
			message,
		});
	}

	private findFirstTaskId(backlog: Backlog): string | undefined {
		for (const epic of backlog.epics) {
			for (const story of epic.stories) {
				for (const task of story.tasks) {
					return task.id;
				}
			}
		}
		return undefined;
	}

	private findStoryForTask(backlog: Backlog, taskId: string): Backlog['epics'][number]['stories'][number] | undefined {
		for (const epic of backlog.epics) {
			for (const story of epic.stories) {
				if (story.tasks.some((task) => task.id === taskId)) {
					return story;
				}
			}
		}
		return undefined;
	}

	private async getServices(): Promise<StudioServices | null> {
		const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
		if (!workspaceRoot) {
			const defaultWorkspaceUri = vscode.Uri.file(DEFAULT_WORKSPACE_PATH);
			await vscode.commands.executeCommand('vscode.openFolder', defaultWorkspaceUri, false);
			return null;
		}

		const store = new ArtifactStore(workspaceRoot);
		const scanner = new WorkspaceScanner(workspaceRoot, store);
		const llmEnabled = vscode.workspace.getConfiguration('designAddin.llm').get<boolean>('enabled', false);
		const llmProviderName = vscode.workspace.getConfiguration('designAddin.llm').get<string>('provider', 'stub');
		const llmProvider = createLlmProvider(llmEnabled, llmProviderName);
		const pipeline = new Pipeline(store, { llmEnabled, llmProvider });
		return { workspaceRoot, store, scanner, pipeline };
	}

	private getHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
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
}

interface StudioServices {
	workspaceRoot: vscode.Uri;
	store: ArtifactStore;
	scanner: WorkspaceScanner;
	pipeline: Pipeline;
}

function getNonce(): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let nonce = '';
	for (let i = 0; i < 16; i += 1) {
		nonce += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return nonce;
}
