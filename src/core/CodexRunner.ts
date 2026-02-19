import * as vscode from 'vscode';
import { ArtifactStore } from './ArtifactStore';

export interface RunLog {
	taskId: string;
	promptPath: string;
	startedAt: string;
	commandLine: string;
	terminalName: string;
	runLogPath: string;
	modelsTried?: string[];
}

export class CodexRunner {
	private static terminal: vscode.Terminal | undefined;
	private static readonly terminalName = 'Codex';

	constructor(private readonly store: ArtifactStore) {}

	public async runPrompt(promptPath: vscode.Uri, workspaceRoot: vscode.Uri, taskId: string): Promise<RunLog> {
		const terminal = this.getOrCreateTerminal(workspaceRoot);
		const startedAt = new Date().toISOString();
		const { commandLine, modelsTried } = this.buildCommandLine(promptPath);

		terminal.show(true);
		terminal.sendText(commandLine, true);

		const timestamp = this.fileSafeTimestamp(startedAt);
		const runLogRelativePath = `runs/${timestamp}_${taskId}.json`;
		const runLog: RunLog = {
			taskId,
			promptPath: vscode.workspace.asRelativePath(promptPath, false),
			startedAt,
			commandLine,
			terminalName: CodexRunner.terminalName,
			runLogPath: `.ai-design/${runLogRelativePath}`,
			modelsTried,
		};

		await this.store.writeJson(runLogRelativePath, runLog);
		await this.store.writeJson('runs/last.json', runLog);
		return runLog;
	}

	private getOrCreateTerminal(workspaceRoot: vscode.Uri): vscode.Terminal {
		if (CodexRunner.terminal) {
			return CodexRunner.terminal;
		}

		CodexRunner.terminal = vscode.window.createTerminal({
			name: CodexRunner.terminalName,
			cwd: workspaceRoot.fsPath,
		});

		return CodexRunner.terminal;
	}

	private buildCommandLine(promptPath: vscode.Uri): { commandLine: string; modelsTried: string[] } {
		const quotedPath = `"${promptPath.fsPath.replace(/"/g, '""')}"`;
		const psSingleQuotedPath = `'${promptPath.fsPath.replace(/'/g, "''")}'`;
		const isWindows = process.platform === 'win32';
		const envShell = (vscode.env as { shell?: string }).shell?.toLowerCase();
		const configuredShell = vscode.workspace
			.getConfiguration('terminal.integrated')
			.get<string>('defaultProfile.windows')
			?.toLowerCase();
		const modelsTried = this.getModelCandidates();

		if (isWindows) {
			const powershellAttempts: string[] = [];
			for (const model of modelsTried) {
				const safeModel = model.replace(/'/g, "''");
				powershellAttempts.push(`Get-Content -Raw ${psSingleQuotedPath} | codex exec -m '${safeModel}' -`);
			}
			let powershellRunner = powershellAttempts[0];
			for (let i = 1; i < powershellAttempts.length; i += 1) {
				powershellRunner += `; if ($LASTEXITCODE -ne 0) { ${powershellAttempts[i]} }`;
			}

			if (
				configuredShell?.includes('command prompt') ||
				configuredShell?.includes('cmd') ||
				envShell?.includes('cmd.exe')
			) {
				const cmdAttempts = modelsTried.map((model) => `type ${quotedPath} | codex exec -m "${model}" -`);
				return { commandLine: cmdAttempts.join(' || '), modelsTried };
			}
			return { commandLine: powershellRunner, modelsTried };
		}

		const unixAttempts = modelsTried.map((model) => `cat ${quotedPath} | codex exec -m "${model}" -`);
		return { commandLine: unixAttempts.join(' || '), modelsTried };
	}

	private getModelCandidates(): string[] {
		const configuredModel = vscode.workspace.getConfiguration('designAddin').get<string>('codexModel');
		const defaults = ['gpt-5.3-codex', 'gpt-5.2-codex', 'gpt-5.1-codex', 'gpt-5-codex'];
		const candidates = [configuredModel, ...defaults].filter((value): value is string => Boolean(value));
		return [...new Set(candidates)];
	}

	private fileSafeTimestamp(isoDate: string): string {
		return isoDate.replace(/[:.]/g, '-');
	}
}
