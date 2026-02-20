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
exports.CodexRunner = void 0;
const vscode = __importStar(require("vscode"));
class CodexRunner {
    store;
    static terminal;
    static terminalName = 'Codex';
    constructor(store) {
        this.store = store;
    }
    async runPrompt(promptPath, workspaceRoot, taskId) {
        const terminal = this.getOrCreateTerminal(workspaceRoot);
        const startedAt = new Date().toISOString();
        const { commandLine, modelsTried } = this.buildCommandLine(promptPath);
        terminal.show(true);
        terminal.sendText(commandLine, true);
        const timestamp = this.fileSafeTimestamp(startedAt);
        const runLogRelativePath = `runs/${timestamp}_${taskId}.json`;
        const runLog = {
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
    getOrCreateTerminal(workspaceRoot) {
        if (CodexRunner.terminal) {
            return CodexRunner.terminal;
        }
        CodexRunner.terminal = vscode.window.createTerminal({
            name: CodexRunner.terminalName,
            cwd: workspaceRoot.fsPath,
        });
        return CodexRunner.terminal;
    }
    buildCommandLine(promptPath) {
        const quotedPath = `"${promptPath.fsPath.replace(/"/g, '""')}"`;
        const psSingleQuotedPath = `'${promptPath.fsPath.replace(/'/g, "''")}'`;
        const isWindows = process.platform === 'win32';
        const envShell = vscode.env.shell?.toLowerCase();
        const configuredShell = vscode.workspace
            .getConfiguration('terminal.integrated')
            .get('defaultProfile.windows')
            ?.toLowerCase();
        const modelsTried = this.getModelCandidates();
        if (isWindows) {
            const powershellAttempts = [];
            for (const model of modelsTried) {
                const safeModel = model.replace(/'/g, "''");
                powershellAttempts.push(`Get-Content -Raw ${psSingleQuotedPath} | codex exec -m '${safeModel}' -`);
            }
            let powershellRunner = powershellAttempts[0];
            for (let i = 1; i < powershellAttempts.length; i += 1) {
                powershellRunner += `; if ($LASTEXITCODE -ne 0) { ${powershellAttempts[i]} }`;
            }
            if (configuredShell?.includes('command prompt') ||
                configuredShell?.includes('cmd') ||
                envShell?.includes('cmd.exe')) {
                const cmdAttempts = modelsTried.map((model) => `type ${quotedPath} | codex exec -m "${model}" -`);
                return { commandLine: cmdAttempts.join(' || '), modelsTried };
            }
            return { commandLine: powershellRunner, modelsTried };
        }
        const unixAttempts = modelsTried.map((model) => `cat ${quotedPath} | codex exec -m "${model}" -`);
        return { commandLine: unixAttempts.join(' || '), modelsTried };
    }
    getModelCandidates() {
        const configuredModel = vscode.workspace.getConfiguration('designAddin').get('codexModel');
        const defaults = ['gpt-5.3-codex', 'gpt-5.2-codex', 'gpt-5.1-codex', 'gpt-5-codex'];
        const candidates = [configuredModel, ...defaults].filter((value) => Boolean(value));
        return [...new Set(candidates)];
    }
    fileSafeTimestamp(isoDate) {
        return isoDate.replace(/[:.]/g, '-');
    }
}
exports.CodexRunner = CodexRunner;
//# sourceMappingURL=CodexRunner.js.map