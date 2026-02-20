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
exports.ArtifactStore = void 0;
const vscode = __importStar(require("vscode"));
class ArtifactStore {
    workspaceRoot;
    designFolderUri;
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.designFolderUri = vscode.Uri.joinPath(this.workspaceRoot, '.ai-design');
    }
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
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
        return uri;
    }
    async readJson(relativePath) {
        const uri = this.resolveDesignPath(relativePath);
        const bytes = await vscode.workspace.fs.readFile(uri);
        return JSON.parse(Buffer.from(bytes).toString('utf8'));
    }
    async readText(relativePath) {
        const uri = this.resolveDesignPath(relativePath);
        const bytes = await vscode.workspace.fs.readFile(uri);
        return Buffer.from(bytes).toString('utf8');
    }
    async writeMarkdown(relativePath, content) {
        const uri = this.resolveDesignPath(relativePath);
        await this.ensureParentDirectory(uri);
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
        return uri;
    }
    async fileExists(relativePath) {
        const uri = this.resolveDesignPath(relativePath);
        try {
            await vscode.workspace.fs.stat(uri);
            return true;
        }
        catch {
            return false;
        }
    }
    resolveDesignPath(relativePath) {
        const segments = relativePath.split('/').filter(Boolean);
        return vscode.Uri.joinPath(this.designFolderUri, ...segments);
    }
    async ensureParentDirectory(uri) {
        const pathParts = uri.path.split('/');
        pathParts.pop();
        const parentUri = uri.with({ path: pathParts.join('/') });
        await vscode.workspace.fs.createDirectory(parentUri);
    }
}
exports.ArtifactStore = ArtifactStore;
//# sourceMappingURL=ArtifactStore.js.map