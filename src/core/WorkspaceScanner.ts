import * as vscode from 'vscode';
import { ArtifactStore } from './ArtifactStore';

export type StackHint = 'node' | '.net' | 'mixed' | 'unknown';

export interface ContextBundle {
	generatedAt: string;
	rootFolder: string;
	readmeFiles: string[];
	packageJsonFiles: string[];
	csprojFiles: string[];
	solutionFiles: string[];
	stackHint: StackHint;
	candidateBuildCommands: string[];
	topRelevantFiles: string[];
}

export class WorkspaceScanner {
	constructor(
		private readonly workspaceRoot: vscode.Uri,
		private readonly store: ArtifactStore
	) {}

	public async scanAndStoreContextBundle(): Promise<vscode.Uri> {
		const [readmeFiles, packageJsonFiles, csprojFiles, solutionFiles, tsConfigFiles, extensionFiles, allFiles] = await Promise.all([
			this.findRelativePaths('**/README.md'),
			this.findRelativePaths('**/package.json'),
			this.findRelativePaths('**/*.csproj'),
			this.findRelativePaths('**/*.sln'),
			this.findRelativePaths('**/tsconfig.json'),
			this.findRelativePaths('**/extension.ts'),
			this.findRelativePaths('**/*', 400),
		]);
		const stackHint = this.detectStackHint(packageJsonFiles, csprojFiles, solutionFiles);

		const contextBundle: ContextBundle = {
			generatedAt: new Date().toISOString(),
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
				solutionFiles,
			}),
		};

		return this.store.writeJson('contextBundle.json', contextBundle);
	}

	private async findRelativePaths(globPattern: string, maxResults = 20): Promise<string[]> {
		const files = await vscode.workspace.findFiles(
			new vscode.RelativePattern(this.workspaceRoot, globPattern),
			'**/{node_modules,dist,out,.git}/**',
			maxResults
		);
		return files.map((uri) => vscode.workspace.asRelativePath(uri, false));
	}

	private detectStackHint(packageJsonFiles: string[], csprojFiles: string[], solutionFiles: string[]): StackHint {
		const hasNode = packageJsonFiles.length > 0;
		const hasDotNet = csprojFiles.length > 0 || solutionFiles.length > 0;
		if (hasNode && hasDotNet) {
			return 'mixed';
		}
		if (hasNode) {
			return 'node';
		}
		if (hasDotNet) {
			return '.net';
		}
		return 'unknown';
	}

	private getCandidateBuildCommands(stackHint: StackHint): string[] {
		switch (stackHint) {
			case 'node':
				return ['npm test', 'npm run build'];
			case '.net':
				return ['dotnet test', 'dotnet build'];
			case 'mixed':
				return ['npm test', 'npm run build', 'dotnet test', 'dotnet build'];
			default:
				return ['npm test', 'npm run build', 'dotnet test', 'dotnet build'];
		}
	}

	private buildTopRelevantFiles(input: {
		allFiles: string[];
		readmeFiles: string[];
		packageJsonFiles: string[];
		tsConfigFiles: string[];
		extensionFiles: string[];
		csprojFiles: string[];
		solutionFiles: string[];
	}): string[] {
		const priorities = new Map<string, number>();

		const add = (file: string, score: number) => {
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
			if (normalized.endsWith('src/extension.ts')) {
				add(file, 92);
			} else if (normalized.endsWith('src/ui/designstudiopanel.ts')) {
				add(file, 91);
			} else if (normalized.endsWith('src/core/pipeline.ts')) {
				add(file, 89);
			} else if (normalized.endsWith('readme.md')) {
				add(file, 87);
			} else if (normalized.endsWith('.sln') || normalized.endsWith('.csproj')) {
				add(file, 83);
			} else if (normalized.endsWith('package-lock.json')) {
				add(file, 70);
			}
		}

		return Array.from(priorities.entries())
			.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
			.slice(0, 20)
			.map(([file]) => file);
	}
}
