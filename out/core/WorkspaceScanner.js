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
exports.WorkspaceScanner = void 0;
const vscode = __importStar(require("vscode"));
class WorkspaceScanner {
    workspaceRoot;
    store;
    constructor(workspaceRoot, store) {
        this.workspaceRoot = workspaceRoot;
        this.store = store;
    }
    async scanAndStoreContextBundle() {
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
        const contextBundle = {
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
    async findRelativePaths(globPattern, maxResults = 20) {
        const files = await vscode.workspace.findFiles(new vscode.RelativePattern(this.workspaceRoot, globPattern), '**/{node_modules,dist,out,.git}/**', maxResults);
        return files.map((uri) => vscode.workspace.asRelativePath(uri, false));
    }
    detectStackHint(packageJsonFiles, csprojFiles, solutionFiles) {
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
    getCandidateBuildCommands(stackHint) {
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
    buildTopRelevantFiles(input) {
        const priorities = new Map();
        const add = (file, score) => {
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
            }
            else if (normalized.endsWith('src/ui/designstudiopanel.ts')) {
                add(file, 91);
            }
            else if (normalized.endsWith('src/core/pipeline.ts')) {
                add(file, 89);
            }
            else if (normalized.endsWith('readme.md')) {
                add(file, 87);
            }
            else if (normalized.endsWith('.sln') || normalized.endsWith('.csproj')) {
                add(file, 83);
            }
            else if (normalized.endsWith('package-lock.json')) {
                add(file, 70);
            }
        }
        return Array.from(priorities.entries())
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .slice(0, 20)
            .map(([file]) => file);
    }
}
exports.WorkspaceScanner = WorkspaceScanner;
//# sourceMappingURL=WorkspaceScanner.js.map