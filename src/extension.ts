import * as vscode from 'vscode';
import { ArtifactStore } from './core/ArtifactStore';
import { Backlog, BacklogStory, Pipeline } from './core/Pipeline';
import { WorkspaceScanner } from './core/WorkspaceScanner';
import { CodexRunner } from './core/CodexRunner';
import { DesignStudioPanel } from './ui/DesignStudioPanel';
import { createLlmProvider } from './llm/LlmProviderFactory';

const DEFAULT_WORKSPACE_PATH = 'C:\\Users\\Johan\\source\\repos\\TextAdven';

export function activate(context: vscode.ExtensionContext) {
	const register = (commandId: string, action: () => Promise<void>) => {
		const disposable = vscode.commands.registerCommand(commandId, async () => {
			try {
				await action();
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				vscode.window.showErrorMessage(`${commandId} failed: ${message}`);
			}
		});
		context.subscriptions.push(disposable);
	};

	register('designAddin.openStudio', async () => {
		await DesignStudioPanel.createOrShow(context, context.extensionUri);
	});

	register('designAddin.newIdea', async () => {
		const services = await getServices();
		if (!services) {
			return;
		}
		await services.store.ensureDesignFolder();
		const uri = await services.pipeline.newIdea();
		await openTextDocument(uri);
		vscode.window.showInformationMessage('Created .ai-design/idea.json');
	});

	register('designAddin.generateBrief', async () => {
		const services = await getServices();
		if (!services) {
			return;
		}
		await services.store.ensureDesignFolder();
		const uri = await services.pipeline.generateBrief();
		await openTextDocument(uri);
		vscode.window.showInformationMessage('Created .ai-design/brief.v1.md');
	});

	register('designAddin.generateArchitecture', async () => {
		const services = await getServices();
		if (!services) {
			return;
		}
		await services.store.ensureDesignFolder();
		const uri = await services.pipeline.generateArchitecture();
		await openTextDocument(uri);
		vscode.window.showInformationMessage('Created .ai-design/architecture.v1.md');
	});

	register('designAddin.generateBacklog', async () => {
		const services = await getServices();
		if (!services) {
			return;
		}
		await services.store.ensureDesignFolder();
		const { jsonUri, markdownUri } = await services.pipeline.generateBacklog();
		await openTextDocument(markdownUri);
		vscode.window.showInformationMessage(
			`Created backlog artifacts: ${vscode.workspace.asRelativePath(jsonUri)}, ${vscode.workspace.asRelativePath(markdownUri)}`
		);
	});

	register('designAddin.generatePromptForTask', async () => {
		const services = await getServices();
		if (!services) {
			return;
		}
		await services.store.ensureDesignFolder();
		if (!(await services.store.fileExists('backlog.v1.json'))) {
			vscode.window.showWarningMessage('Backlog not found. Run "Generate Backlog" first.');
			return;
		}

		const backlog = await services.store.readJson<Backlog>('backlog.v1.json');
		const selectedTask = await pickTask(backlog);
		if (!selectedTask) {
			return;
		}

		await services.scanner.scanAndStoreContextBundle();
		const uri = await services.pipeline.generatePromptForTask(selectedTask.task.id, backlog);
		await openTextDocument(uri);
		vscode.window.showInformationMessage(`Created prompt for ${selectedTask.task.id}`);
	});

register('designAddin.runTaskWithCodex', async () => {
		const services = await getServices();
		if (!services) {
			return;
		}
		await services.store.ensureDesignFolder();
		if (!(await services.store.fileExists('backlog.v1.json'))) {
			vscode.window.showWarningMessage('Backlog not found. Run "Generate Backlog" first.');
			return;
		}

		const backlog = await services.store.readJson<Backlog>('backlog.v1.json');
		const selectedTask = await pickTask(backlog);
		if (!selectedTask) {
			return;
		}

		const promptRelativePath = `prompts/${selectedTask.task.id}.prompt.md`;
		if (!(await services.store.fileExists(promptRelativePath))) {
			await services.scanner.scanAndStoreContextBundle();
			await services.pipeline.generatePromptForTask(selectedTask.task.id, backlog);
		}

		const promptUri = services.store.resolveDesignPath(promptRelativePath);
		const runner = new CodexRunner(services.store);
		const runLog = await runner.runPrompt(promptUri, services.workspaceRoot, selectedTask.task.id);
		vscode.window.showInformationMessage(
			`Started Codex for ${selectedTask.task.id}. Run log: ${runLog.runLogPath}`
		);
	});

	register('designAddin.rescanWorkspaceContext', async () => {
		const services = await getServices();
		if (!services) {
			return;
		}
		await services.store.ensureDesignFolder();
		const uri = await services.scanner.scanAndStoreContextBundle();
		await openTextDocument(uri);
		vscode.window.showInformationMessage('Updated .ai-design/contextBundle.json');
	});
}

async function getServices(): Promise<{
	workspaceRoot: vscode.Uri;
	store: ArtifactStore;
	scanner: WorkspaceScanner;
	pipeline: Pipeline;
} | null> {
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

async function openTextDocument(uri: vscode.Uri): Promise<void> {
	const document = await vscode.workspace.openTextDocument(uri);
	await vscode.window.showTextDocument(document, { preview: false });
}

async function pickTask(
	backlog: Backlog
): Promise<{ task: Backlog['epics'][number]['stories'][number]['tasks'][number]; story: BacklogStory } | undefined> {
	const picks: vscode.QuickPickItem[] = [];
	const taskLookup = new Map<string, { task: Backlog['epics'][number]['stories'][number]['tasks'][number]; story: BacklogStory }>();

	for (const epic of backlog.epics) {
		for (const story of epic.stories) {
			for (const task of story.tasks) {
				const value = { task, story };
				taskLookup.set(task.id, value);
				picks.push({
					label: task.id,
					description: task.title,
					detail: `${epic.id} / ${story.id} / status=${task.status}`,
				});
			}
		}
	}

	if (picks.length === 0) {
		vscode.window.showWarningMessage('No tasks found in backlog.v1.json.');
		return undefined;
	}

	const selection = await vscode.window.showQuickPick(picks, {
		title: 'Select a task to generate prompt',
		placeHolder: 'Choose a task ID',
	});
	if (!selection) {
		return undefined;
	}
	return taskLookup.get(selection.label);
}

export function deactivate() {}
