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
exports.ArtifactPanel = void 0;
const vscode = __importStar(require("vscode"));
const storage_1 = require("../storage");
class ArtifactPanel {
    panel;
    context;
    onMessage;
    static current;
    artifacts = {
        idea: '',
        brief: '',
        architecture: '',
        backlog: '',
        prompts: '',
    };
    static createOrShow(context, onMessage) {
        const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;
        if (ArtifactPanel.current) {
            ArtifactPanel.current.panel.reveal(column);
            return ArtifactPanel.current;
        }
        const panel = vscode.window.createWebviewPanel('designAddin.artifacts', 'Design Add-in Artifacts', column, {
            enableScripts: true,
            retainContextWhenHidden: true,
        });
        ArtifactPanel.current = new ArtifactPanel(panel, context, onMessage);
        return ArtifactPanel.current;
    }
    constructor(panel, context, onMessage) {
        this.panel = panel;
        this.context = context;
        this.onMessage = onMessage;
        this.panel.webview.html = this.getHtml();
        this.panel.onDidDispose(() => {
            ArtifactPanel.current = undefined;
        });
        this.panel.webview.onDidReceiveMessage((message) => {
            void this.onMessage(message);
        });
    }
    updateArtifact(name, content) {
        this.artifacts[name] = content;
        void this.panel.webview.postMessage({ type: 'artifact', name, content });
    }
    setStatus(message, isError = false) {
        void this.panel.webview.postMessage({ type: 'status', message, isError });
    }
    getIdea() {
        return this.artifacts.idea;
    }
    getHtml() {
        const nonce = Math.random().toString(36).slice(2);
        return `<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8" />
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<style>
		body{font-family:Segoe UI, sans-serif;background:#0d1526;color:#d9e2f1;margin:0}
		.top{padding:10px;border-bottom:1px solid #2e3b55}
		.tabs{display:flex;gap:8px;padding:8px 10px}
		.tab-btn{background:transparent;border:1px solid #2e3b55;color:#d9e2f1;padding:6px 10px;border-radius:6px;cursor:pointer}
		.tab-btn.active{border-color:#31c48d}
		.panel{display:none;padding:10px}
		.panel.active{display:block}
		textarea{width:100%;min-height:360px;background:#0b1220;color:#d9e2f1;border:1px solid #2e3b55;border-radius:6px;padding:8px;font-family:Consolas,monospace}
		.row{display:flex;gap:8px;align-items:center;margin:8px 0}
		button{background:transparent;border:1px solid #2e3b55;color:#d9e2f1;padding:6px 10px;border-radius:6px;cursor:pointer}
		button:hover{border-color:#31c48d}
		.status{font-size:12px;color:#99a8be}
		.status.error{color:#ff8a8a}
	</style>
</head>
<body>
	<div class="top">
		<div id="status" class="status">Ready</div>
		<div class="status">Stored under ${(0, storage_1.artifactRelativePath)('idea').replace('/idea.md', '/')}</div>
	</div>
	<div class="tabs">
		<button class="tab-btn active" data-tab="idea">Idea</button>
		<button class="tab-btn" data-tab="brief">Brief</button>
		<button class="tab-btn" data-tab="architecture">Architecture</button>
		<button class="tab-btn" data-tab="backlog">Backlog</button>
		<button class="tab-btn" data-tab="prompts">Prompts</button>
	</div>
	${this.tabHtml('idea', true)}
	${this.tabHtml('brief')}
	${this.tabHtml('architecture')}
	${this.tabHtml('backlog')}
	${this.tabHtml('prompts')}
	<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		const names = ['idea','brief','architecture','backlog','prompts'];
		let current = 'idea';

		function show(name){
			current = name;
			document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
			document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
			document.getElementById('panel-'+name).classList.add('active');
			document.querySelector('.tab-btn[data-tab="'+name+'"]').classList.add('active');
		}
		function copyCurrent(name){
			const value = document.getElementById(name + '-text').value || '';
			navigator.clipboard.writeText(value);
		}
		function regenerate(name){
			const includeDownstream = document.getElementById(name + '-down').checked;
			vscode.postMessage({ type:'regenerate', artifact:name, includeDownstream });
		}

		document.querySelectorAll('.tab-btn').forEach(btn=>{
			btn.addEventListener('click',()=>show(btn.dataset.tab));
		});
		names.forEach(name=>{
			const copy = document.getElementById(name+'-copy');
			if(copy){ copy.addEventListener('click',()=>copyCurrent(name)); }
			const regen = document.getElementById(name+'-regen');
			if(regen){ regen.addEventListener('click',()=>regenerate(name)); }
			if(name==='idea'){
				document.getElementById('idea-text').addEventListener('input',(e)=>{
					vscode.postMessage({ type:'saveIdea', content:e.target.value });
				});
			}
		});

		window.addEventListener('message', event=>{
			const msg = event.data;
			if(msg.type==='artifact'){
				const el = document.getElementById(msg.name + '-text');
				if(el && el !== document.activeElement){ el.value = msg.content || ''; }
			}
			if(msg.type==='status'){
				const status = document.getElementById('status');
				status.textContent = msg.message || '';
				status.className = msg.isError ? 'status error' : 'status';
			}
		});
	</script>
</body>
</html>`;
    }
    tabHtml(name, isIdea = false) {
        return `<section class="panel${isIdea ? ' active' : ''}" id="panel-${name}">
	<div class="row">
		<button id="${name}-copy">Copy to clipboard</button>
		${isIdea ? '' : `<button id="${name}-regen">Regenerate</button><label><input id="${name}-down" type="checkbox" checked/> include downstream</label>`}
	</div>
	<textarea id="${name}-text" ${isIdea ? '' : 'readonly'}></textarea>
</section>`;
    }
}
exports.ArtifactPanel = ArtifactPanel;
//# sourceMappingURL=panel.js.map