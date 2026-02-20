import * as assert from 'assert';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { artifactFileName, artifactRelativePath, DesignAddinStorage } from '../storage';

suite('DesignAddinStorage', () => {
	test('artifact path helpers', () => {
		assert.strictEqual(artifactFileName('brief'), 'brief.md');
		assert.strictEqual(artifactRelativePath('architecture'), '.design-addin/architecture.md');
	});

	test('write and read artifact markdown', async () => {
		const root = vscode.Uri.file(path.join(os.tmpdir(), `design-addin-test-${Date.now()}`));
		const storage = new DesignAddinStorage(root);

		await storage.writeArtifact('idea', '# Idea\nTest');
		const value = await storage.readArtifact('idea');
		assert.strictEqual(value, '# Idea\nTest');
	});
});
