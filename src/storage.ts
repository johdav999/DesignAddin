import * as vscode from 'vscode';

export type ArtifactName = 'idea' | 'brief' | 'architecture' | 'backlog' | 'prompts';

export function artifactFileName(name: ArtifactName): string {
	return `${name}.md`;
}

export function artifactRelativePath(name: ArtifactName): string {
	return `.design-addin/${artifactFileName(name)}`;
}

export class DesignAddinStorage {
	private readonly rootUri: vscode.Uri;

	constructor(private readonly workspaceRoot: vscode.Uri) {
		this.rootUri = vscode.Uri.joinPath(workspaceRoot, '.design-addin');
	}

	public async ensureRoot(): Promise<void> {
		await vscode.workspace.fs.createDirectory(this.rootUri);
	}

	public getArtifactUri(name: ArtifactName): vscode.Uri {
		return vscode.Uri.joinPath(this.rootUri, artifactFileName(name));
	}

	public async writeArtifact(name: ArtifactName, content: string): Promise<vscode.Uri> {
		await this.ensureRoot();
		const uri = this.getArtifactUri(name);
		await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
		return uri;
	}

	public async readArtifact(name: ArtifactName): Promise<string> {
		const uri = this.getArtifactUri(name);
		const bytes = await vscode.workspace.fs.readFile(uri);
		return Buffer.from(bytes).toString('utf8');
	}

	public async exists(name: ArtifactName): Promise<boolean> {
		try {
			await vscode.workspace.fs.stat(this.getArtifactUri(name));
			return true;
		} catch {
			return false;
		}
	}
}
