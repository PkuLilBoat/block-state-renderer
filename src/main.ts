import { MarkdownView, Notice, Plugin, TFile } from 'obsidian';
import { RenderController, type RenderSettings } from './rendering';
import { BlockStateSettingTab } from './settings';
import { COLOR_RULES_PATH, EMPTY_COLOR_RULES, parseColorRules, type ColorRulesDocument } from './color-rules';

const DEFAULT_SETTINGS: RenderSettings = { opacity: 30, enabledFiles: [], tagContainers: false, colorRules: EMPTY_COLOR_RULES };

function readSettings(value: unknown): RenderSettings {
	if (typeof value !== 'object' || value === null) return { ...DEFAULT_SETTINGS };
	const source = value as Record<string, unknown>;
	const opacity = typeof source.opacity === 'number' && Number.isFinite(source.opacity)
		? Math.min(100, Math.max(0, Math.round(source.opacity / 10) * 10))
		: DEFAULT_SETTINGS.opacity;
	const enabledFiles = Array.isArray(source.enabledFiles)
		? source.enabledFiles.filter((path): path is string => typeof path === 'string')
		: [];
	const tagContainers = source.tagContainers === true;
	const colorRules = parseColorRules(source.colorRules) ?? EMPTY_COLOR_RULES;
	return { opacity, enabledFiles: [...new Set(enabledFiles)], tagContainers, colorRules };
}

export default class BlockStateRendererPlugin extends Plugin {
	settings: RenderSettings = { ...DEFAULT_SETTINGS };
	private renderer: RenderController | null = null;
	private settingTab: BlockStateSettingTab | null = null;
	private colorWrite: Promise<void> = Promise.resolve();
	private colorReloadRevision = 0;

	async onload(): Promise<void> {
		this.settings = readSettings(await this.loadData());
		await this.reloadColorRules();
		this.renderer = new RenderController(this.settings);
		this.registerEditorExtension(this.renderer.extension);
		this.settingTab = new BlockStateSettingTab(this.app, this);
		this.addSettingTab(this.settingTab);
		this.addCommand({
			id: 'toggle-current-file',
			name: 'Toggle state rendering for current file',
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
				if (!file) return false;
				if (!checking) void this.toggleFile(file);
				return true;
			},
		});
		this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
			if (!(file instanceof TFile) || !this.settings.enabledFiles.includes(oldPath)) return;
			this.settings.enabledFiles = this.settings.enabledFiles.map((path) => path === oldPath ? file.path : path);
			void this.saveSettings();
		}));
		this.registerEvent(this.app.vault.on('delete', (file) => {
			if (!(file instanceof TFile) || !this.settings.enabledFiles.includes(file.path)) return;
			this.settings.enabledFiles = this.settings.enabledFiles.filter((path) => path !== file.path);
			void this.saveSettings();
		}));
		this.registerEvent(this.app.vault.on('create', (file) => {
			if (file.path === COLOR_RULES_PATH) void this.reloadColorRules();
		}));
		this.registerEvent(this.app.vault.on('modify', (file) => {
			if (file.path === COLOR_RULES_PATH) void this.reloadColorRules();
		}));
		this.registerEvent(this.app.vault.on('delete', (file) => {
			if (file.path === COLOR_RULES_PATH) void this.reloadColorRules();
		}));
	}

	onunload(): void {
		this.renderer?.dispose();
		this.renderer = null;
		this.settingTab = null;
	}

	isFileEnabled(path: string): boolean {
		return this.settings.enabledFiles.includes(path);
	}

	async toggleFile(file: TFile): Promise<void> {
		if (this.isFileEnabled(file.path)) {
			this.settings.enabledFiles = this.settings.enabledFiles.filter((path) => path !== file.path);
		} else {
			this.settings.enabledFiles = [...this.settings.enabledFiles, file.path];
		}
		await this.saveSettings();
	}

	async setOpacity(opacity: number): Promise<void> {
		this.settings.opacity = Math.min(100, Math.max(0, Math.round(opacity / 10) * 10));
		await this.saveSettings();
	}

	async setTagContainers(enabled: boolean): Promise<void> {
		this.settings.tagContainers = enabled;
		await this.saveSettings();
	}

	async updateColorRules(document: ColorRulesDocument): Promise<void> {
		const validated = parseColorRules(document);
		if (!validated) throw new Error('Invalid color rules');
		this.colorWrite = this.colorWrite.catch(() => undefined).then(async () => {
			const content = `${JSON.stringify(validated, null, 2)}\n`;
			const file = this.app.vault.getAbstractFileByPath(COLOR_RULES_PATH);
			if (file instanceof TFile) await this.app.vault.process(file, () => content);
			else if (file === null) await this.app.vault.create(COLOR_RULES_PATH, content);
			else throw new Error('Color rules path is not a file');
			this.settings.colorRules = validated;
			await this.saveSettings();
			this.settingTab?.update();
		});
		await this.colorWrite;
	}

	private async reloadColorRules(): Promise<void> {
		const revision = ++this.colorReloadRevision;
		const file = this.app.vault.getAbstractFileByPath(COLOR_RULES_PATH);
		if (file === null) {
			this.settings.colorRules = EMPTY_COLOR_RULES;
			await this.saveSettings();
			this.settingTab?.update();
			return;
		}
		if (!(file instanceof TFile)) {
			new Notice('Color rules path is not a file; keeping the last valid rules.');
			return;
		}
		try {
			const parsed: unknown = JSON.parse(await this.app.vault.read(file));
			const validated = parseColorRules(parsed);
			if (!validated) throw new Error('Invalid color rules');
			if (revision !== this.colorReloadRevision) return;
			this.settings.colorRules = validated;
			await this.saveSettings();
			this.settingTab?.update();
		} catch {
			if (revision !== this.colorReloadRevision) return;
			new Notice('Invalid color rules JSON; keeping the last valid rules.');
		}
	}

	private async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.renderer?.updateSettings(this.settings);
	}
}
