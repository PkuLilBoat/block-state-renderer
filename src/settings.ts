import { App, MarkdownView, Notice, PluginSettingTab, type SettingDefinitionItem } from 'obsidian';
import type BlockStateRendererPlugin from './main';
import { COLOR_RULES_PATH, parseColorRules, type ColorRule } from './color-rules';

export class BlockStateSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: BlockStateRendererPlugin) {
		super(app, plugin);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const definitions: SettingDefinitionItem[] = [
			{
				name: 'Render current file',
				render: (setting) => {
					const activeFile = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
					if (!activeFile) {
						setting.setDesc('Open a Markdown file to use this switch.');
						return;
					}
					setting
						.setDesc(`Show state effects in ${activeFile.basename}. Other files keep their own setting.`)
						.addToggle((toggle) => toggle
							.setValue(this.plugin.isFileEnabled(activeFile.path))
							.onChange(async () => { await this.plugin.toggleFile(activeFile); }));
				},
			},
			{
				name: 'Shared opacity',
				desc: 'Applies to task, prd, and custom block effects. Original tags remain editable.',
				render: (setting) => {
					setting.addSlider((slider) => slider
						.setLimits(0, 100, 10)
						.setValue(this.plugin.settings.opacity)
						.onChange(async (value) => { await this.plugin.setOpacity(value); }));
				},
			},
			{
				name: 'Show tag containers',
				desc: 'Keep the native pill background around recognized state and custom tags while rendering is on.',
				render: (setting) => {
					setting.addToggle((toggle) => toggle
						.setValue(this.plugin.settings.tagContainers)
						.onChange(async (value) => { await this.plugin.setTagContainers(value); }));
				},
			},
			{
				name: 'Custom tag colors',
				desc: `Exact, case-sensitive tag matches. Rules are shared across this vault in ${COLOR_RULES_PATH}.`,
				render: (setting) => {
					let tag = '';
					let color = '#a78bfa';
					setting.addText((input) => input.setPlaceholder('Enter a complete tag').onChange((value) => { tag = value.trim(); }));
					setting.addColorPicker((picker) => picker.setValue('#a78bfa').onChange((value) => { color = value; }));
					setting.addButton((button) => button.setButtonText('Add').onClick(async () => {
						await this.saveRules([...this.plugin.settings.colorRules.rules, { tag, color, enabled: true }]);
					}));
				},
			},
		];
		for (const [index, rule] of this.plugin.settings.colorRules.rules.entries()) {
			definitions.push({
				name: rule.tag,
				desc: 'Save a renamed tag, or change its color and enabled state.',
				render: (setting) => {
					let draftTag = rule.tag;
					setting.addText((input) => input.setValue(rule.tag).onChange((value) => { draftTag = value.trim(); }));
					setting.addButton((button) => button.setButtonText('Save tag').onClick(async () => {
						await this.replaceRule(index, { ...rule, tag: draftTag });
					}));
					setting.addColorPicker((picker) => picker.setValue(rule.color).onChange(async (value) => {
						await this.replaceRule(index, { ...rule, color: value });
					}));
					setting.addToggle((toggle) => toggle.setValue(rule.enabled).onChange(async (value) => {
						await this.replaceRule(index, { ...rule, enabled: value });
					}));
					setting.addButton((button) => button.setButtonText('Remove').onClick(async () => {
						await this.saveRules(this.plugin.settings.colorRules.rules.filter((_, current) => current !== index));
					}));
				},
			});
		}
		return definitions;
	}

	private async replaceRule(index: number, rule: ColorRule, redraw = true): Promise<void> {
		const rules = [...this.plugin.settings.colorRules.rules];
		rules[index] = rule;
		await this.saveRules(rules, redraw);
	}

	private async saveRules(rules: ColorRule[], redraw = true): Promise<void> {
		const document = parseColorRules({ version: 1, rules });
		if (!document) {
			new Notice('Use a unique complete tag and a six-digit hex color. Task and prd states cannot be custom rules.');
			return;
		}
		try {
			await this.plugin.updateColorRules(document);
			if (redraw) this.update();
		} catch {
			new Notice('Could not save color rules; the previous rules remain active.');
		}
	}
}
