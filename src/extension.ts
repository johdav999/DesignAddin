import * as vscode from 'vscode';
import { ArtifactStore } from './core/ArtifactStore';
import { Backlog, BacklogStory, Pipeline } from './core/Pipeline';
import { WorkspaceScanner } from './core/WorkspaceScanner';
import { CodexRunner } from './core/CodexRunner';
import { DesignStudioPanel } from './ui/DesignStudioPanel';
import { createLlmProvider } from './llm/LlmProviderFactory';
import { ArtifactPanel } from './webview/panel';
import { ArtifactPipeline } from './artifactPipeline';
import { OpenAiClient } from './openaiClient';
import { ArtifactName, DesignAddinStorage } from './storage';

const DEFAULT_WORKSPACE_PATH = 'C:\\Users\\Johan\\source\\repos\\TextAdven';

export function activate(context: vscode.ExtensionContext) {
	const output = vscode.window.createOutputChannel('Design Add-in');
	context.subscriptions.push(output);
	output.appendLine(`[activate] ${new Date().toISOString()} extension activated`);
	let artifactsPanel: ArtifactPanel | undefined;

	const register = (commandId: string, action: () => Promise<void>) => {
		const disposable = vscode.commands.registerCommand(commandId, async () => {
			try {
				output.appendLine(`[command] ${new Date().toISOString()} ${commandId}`);
				if (
					commandId === 'designAddin.generateBrief' ||
					commandId === 'designAddin.generateArchitecture' ||
					commandId === 'designAddin.generateBacklog' ||
					commandId === 'designAddin.generatePromptForTask'
				) {
					output.show(true);
				}
				await action();
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				output.appendLine(`[command] ${commandId} failed: ${message}`);
				vscode.window.showErrorMessage(`${commandId} failed: ${message}`);
			}
		});
		context.subscriptions.push(disposable);
	};

	register('designAddin.openStudio', async () => {
		await DesignStudioPanel.createOrShow(context, context.extensionUri, output);
	});

	register('designAddin.generateArtifacts', async () => {
		const workspaceRoot = await ensureWorkspaceRoot();
		if (!workspaceRoot) {
			return;
		}

		const idea = await vscode.window.showInputBox({
			title: 'Design Add-in: Enter Idea',
			prompt: 'Describe the software/business idea to generate artifacts from.',
			placeHolder: 'Example: AI-assisted sprint planning extension for small teams',
			ignoreFocusOut: true,
		});
		if (!idea?.trim()) {
			vscode.window.showWarningMessage('Idea is required to generate artifacts.');
			return;
		}

		const apiKey = process.env.OPENAI_API_KEY;
		if (!apiKey) {
			await vscode.window.showErrorMessage(
				'OPENAI_API_KEY is not set.',
				{
					modal: true,
					detail:
						'Set OPENAI_API_KEY in your terminal/session environment and restart VS Code. ' +
						'If using Extension Development Host, set it in the launch/task environment as well.',
				}
			);
			return;
		}

		const storage = new DesignAddinStorage(workspaceRoot);
		const model = vscode.workspace.getConfiguration('designAddin').get<string>('openaiModel', 'gpt-4.1-mini');
		const maxOutputTokens = vscode.workspace.getConfiguration('designAddin').get<number>('maxOutputTokens', 3000);
		const client = new OpenAiClient(
			apiKey,
			{
				model,
				temperature: 0.2,
				maxOutputTokens,
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

				if (message.type === 'saveIdea') {
					await panelStorage.writeArtifact('idea', message.content);
					return;
				}

				await vscode.window.withProgress(
					{ location: vscode.ProgressLocation.Notification, title: `Regenerating ${message.artifact}` },
					async () => {
						await panelPipeline.regenerateFrom(
							message.artifact,
							(name: ArtifactName, content: string) => {
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
		panel.setStatus('Generating artifacts...');
		panel.updateArtifact('idea', idea);

		try {
			await vscode.window.withProgress(
				{ location: vscode.ProgressLocation.Notification, title: 'Design Add-in: Generate Artifacts' },
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
			panel.setStatus('Artifacts generated successfully.');
			vscode.window.showInformationMessage('Generated .design-addin artifacts.');
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			output.appendLine(`[pipeline] ERROR ${message}`);
			panel.setStatus(`Error: ${message}`, true);
			vscode.window.showErrorMessage(`Artifact generation failed: ${message}`);
		}
	});

	register('designAddin.newIdea', async () => {
		const services = await getServices(output);
		if (!services) {
			return;
		}
		await services.store.ensureDesignFolder();
		const uri = await services.pipeline.newIdea();
		await openTextDocument(uri);
		vscode.window.showInformationMessage('Created .ai-design/idea.json');
	});

	register('designAddin.generateBrief', async () => {
		const services = await getServices(output);
		if (!services) {
			return;
		}
		await services.store.ensureDesignFolder();
		const uri = await services.pipeline.generateBrief();
		await openTextDocument(uri);
		vscode.window.showInformationMessage('Created .ai-design/brief.v1.md');
	});

	register('designAddin.generateArchitecture', async () => {
		const services = await getServices(output);
		if (!services) {
			return;
		}
		await services.store.ensureDesignFolder();
		const uri = await services.pipeline.generateArchitecture();
		await openTextDocument(uri);
		vscode.window.showInformationMessage('Created .ai-design/architecture.v1.md');
	});

	register('designAddin.generateBacklog', async () => {
		const services = await getServices(output);
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
		const services = await getServices(output);
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
		const services = await getServices(output);
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
		const services = await getServices(output);
		if (!services) {
			return;
		}
		await services.store.ensureDesignFolder();
		const uri = await services.scanner.scanAndStoreContextBundle();
		await openTextDocument(uri);
		vscode.window.showInformationMessage('Updated .ai-design/contextBundle.json');
	});
}

async function getServices(outputChannel?: vscode.OutputChannel): Promise<{
	workspaceRoot: vscode.Uri;
	store: ArtifactStore;
	scanner: WorkspaceScanner;
	pipeline: Pipeline;
} | null> {
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

async function ensureWorkspaceRoot(): Promise<vscode.Uri | null> {
	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
	if (workspaceRoot) {
		return workspaceRoot;
	}
	const defaultWorkspaceUri = vscode.Uri.file(DEFAULT_WORKSPACE_PATH);
	await vscode.commands.executeCommand('vscode.openFolder', defaultWorkspaceUri, false);
	return null;
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
