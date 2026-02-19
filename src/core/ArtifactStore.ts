import * as vscode from 'vscode';

export class ArtifactStore {
	private readonly designFolderUri: vscode.Uri;

	constructor(private readonly workspaceRoot: vscode.Uri) {
		this.designFolderUri = vscode.Uri.joinPath(this.workspaceRoot, '.ai-design');
	}

	public getDesignFolderUri(): vscode.Uri {
		return this.designFolderUri;
	}

	public async ensureDesignFolder(): Promise<void> {
		await vscode.workspace.fs.createDirectory(this.designFolderUri);
	}

	public async writeJson(relativePath: string, data: unknown): Promise<vscode.Uri> {
		const uri = this.resolveDesignPath(relativePath);
		await this.ensureParentDirectory(uri);
		const content = JSON.stringify(data, null, 2);
		await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
		return uri;
	}

	public async readJson<T>(relativePath: string): Promise<T> {
		const uri = this.resolveDesignPath(relativePath);
		const bytes = await vscode.workspace.fs.readFile(uri);
		return JSON.parse(Buffer.from(bytes).toString('utf8')) as T;
	}

	public async readText(relativePath: string): Promise<string> {
		const uri = this.resolveDesignPath(relativePath);
		const bytes = await vscode.workspace.fs.readFile(uri);
		return Buffer.from(bytes).toString('utf8');
	}

	public async writeMarkdown(relativePath: string, content: string): Promise<vscode.Uri> {
		const uri = this.resolveDesignPath(relativePath);
		await this.ensureParentDirectory(uri);
		await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
		return uri;
	}

	public async fileExists(relativePath: string): Promise<boolean> {
		const uri = this.resolveDesignPath(relativePath);
		try {
			await vscode.workspace.fs.stat(uri);
			return true;
		} catch {
			return false;
		}
	}

	public resolveDesignPath(relativePath: string): vscode.Uri {
		const segments = relativePath.split('/').filter(Boolean);
		return vscode.Uri.joinPath(this.designFolderUri, ...segments);
	}

	private async ensureParentDirectory(uri: vscode.Uri): Promise<void> {
		const pathParts = uri.path.split('/');
		pathParts.pop();
		const parentUri = uri.with({ path: pathParts.join('/') });
		await vscode.workspace.fs.createDirectory(parentUri);
	}
}
