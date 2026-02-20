"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const ArtifactStore_1 = require("./core/ArtifactStore");
const Pipeline_1 = require("./core/Pipeline");
const WorkspaceScanner_1 = require("./core/WorkspaceScanner");
const CodexRunner_1 = require("./core/CodexRunner");
const DesignStudioPanel_1 = require("./ui/DesignStudioPanel");
const LlmProviderFactory_1 = require("./llm/LlmProviderFactory");
const panel_1 = require("./webview/panel");
const artifactPipeline_1 = require("./artifactPipeline");
const openaiClient_1 = require("./openaiClient");
const storage_1 = require("./storage");
const DEFAULT_WORKSPACE_PATH = 'C:\\Users\\Johan\\source\\repos\\TextAdven';
function activate(context) {
    const output = vscode.window.createOutputChannel('Design Add-in');
    context.subscriptions.push(output);
    let artifactsPanel;
    const register = (commandId, action) => {
        const disposable = vscode.commands.registerCommand(commandId, async () => {
            try {
                await action();
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`${commandId} failed: ${message}`);
            }
        });
        context.subscriptions.push(disposable);
    };
    register('designAddin.openStudio', async () => {
        await DesignStudioPanel_1.DesignStudioPanel.createOrShow(context, context.extensionUri);
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
            await vscode.window.showErrorMessage('OPENAI_API_KEY is not set.', {
                modal: true,
                detail: 'Set OPENAI_API_KEY in your terminal/session environment and restart VS Code. ' +
                    'If using Extension Development Host, set it in the launch/task environment as well.',
            });
            return;
        }
        const storage = new storage_1.DesignAddinStorage(workspaceRoot);
        const model = vscode.workspace.getConfiguration('designAddin').get('openaiModel', 'gpt-4.1-mini');
        const maxOutputTokens = vscode.workspace.getConfiguration('designAddin').get('maxOutputTokens', 3000);
        const client = new openaiClient_1.OpenAiClient(apiKey, {
            model,
            temperature: 0.2,
            maxOutputTokens,
        }, output);
        const pipeline = new artifactPipeline_1.ArtifactPipeline(storage, client, output);
        const getPanel = () => {
            if (artifactsPanel) {
                return artifactsPanel;
            }
            artifactsPanel = panel_1.ArtifactPanel.createOrShow(context, async (message) => {
                const root = await ensureWorkspaceRoot();
                if (!root) {
                    return;
                }
                const panelStorage = new storage_1.DesignAddinStorage(root);
                const panelClient = new openaiClient_1.OpenAiClient(apiKey, { model, temperature: 0.2, maxOutputTokens }, output);
                const panelPipeline = new artifactPipeline_1.ArtifactPipeline(panelStorage, panelClient, output);
                if (message.type === 'saveIdea') {
                    await panelStorage.writeArtifact('idea', message.content);
                    return;
                }
                await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `Regenerating ${message.artifact}` }, async () => {
                    await panelPipeline.regenerateFrom(message.artifact, (name, content) => {
                        getPanel().updateArtifact(name, content);
                    }, message.includeDownstream);
                });
            });
            return artifactsPanel;
        };
        const panel = getPanel();
        panel.setStatus('Generating artifacts...');
        panel.updateArtifact('idea', idea);
        try {
            await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Design Add-in: Generate Artifacts' }, async (progress) => {
                await pipeline.generateAll(idea, (name, content) => {
                    panel.updateArtifact(name, content);
                }, progress);
            });
            panel.setStatus('Artifacts generated successfully.');
            vscode.window.showInformationMessage('Generated .design-addin artifacts.');
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            output.appendLine(`[pipeline] ERROR ${message}`);
            panel.setStatus(`Error: ${message}`, true);
            vscode.window.showErrorMessage(`Artifact generation failed: ${message}`);
        }
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
        vscode.window.showInformationMessage(`Created backlog artifacts: ${vscode.workspace.asRelativePath(jsonUri)}, ${vscode.workspace.asRelativePath(markdownUri)}`);
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
        const backlog = await services.store.readJson('backlog.v1.json');
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
        const backlog = await services.store.readJson('backlog.v1.json');
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
        const runner = new CodexRunner_1.CodexRunner(services.store);
        const runLog = await runner.runPrompt(promptUri, services.workspaceRoot, selectedTask.task.id);
        vscode.window.showInformationMessage(`Started Codex for ${selectedTask.task.id}. Run log: ${runLog.runLogPath}`);
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
async function getServices() {
    const workspaceRoot = await ensureWorkspaceRoot();
    if (!workspaceRoot) {
        return null;
    }
    const store = new ArtifactStore_1.ArtifactStore(workspaceRoot);
    const scanner = new WorkspaceScanner_1.WorkspaceScanner(workspaceRoot, store);
    const llmEnabled = vscode.workspace.getConfiguration('designAddin.llm').get('enabled', false);
    const llmProviderName = vscode.workspace.getConfiguration('designAddin.llm').get('provider', 'stub');
    const llmProvider = (0, LlmProviderFactory_1.createLlmProvider)(llmEnabled, llmProviderName);
    const pipeline = new Pipeline_1.Pipeline(store, { llmEnabled, llmProvider });
    return { workspaceRoot, store, scanner, pipeline };
}
async function ensureWorkspaceRoot() {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (workspaceRoot) {
        return workspaceRoot;
    }
    const defaultWorkspaceUri = vscode.Uri.file(DEFAULT_WORKSPACE_PATH);
    await vscode.commands.executeCommand('vscode.openFolder', defaultWorkspaceUri, false);
    return null;
}
async function openTextDocument(uri) {
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document, { preview: false });
}
async function pickTask(backlog) {
    const picks = [];
    const taskLookup = new Map();
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
function deactivate() { }
//# sourceMappingURL=extension.js.map