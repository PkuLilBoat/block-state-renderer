import { editorInfoField, editorLivePreviewField } from 'obsidian';
import { StateEffect, type Extension } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { parseStateDocument, type PrdState, type StateTag, type TaskState } from './state-parser';
import { activeColorRules, type ColorRulesDocument } from './color-rules';

export interface RenderSettings {
	opacity: number;
	enabledFiles: string[];
	tagContainers: boolean;
	colorRules: ColorRulesDocument;
}

type Tone = 'warm' | 'yellow' | 'green' | 'red' | 'blue' | 'gray';

const REFRESH = StateEffect.define<void>();

function taskTone(state: TaskState | null): Tone | null {
	switch (state) {
		case 'backlog':
		case 'todo': return 'warm';
		case 'in_progress': return 'yellow';
		case 'in_review': return 'green';
		case 'blocked': return 'red';
		case 'done': return 'blue';
		case 'cancel': return 'gray';
		default: return null;
	}
}

function prdTone(state: PrdState | null): Tone | null {
	switch (state) {
		case 'open/missing':
		case 'open/research':
		case 'open/decision': return 'warm';
		case 'provisional': return 'yellow';
		case 'confirmed': return 'blue';
		case 'obsolete': return 'gray';
		default: return null;
	}
}

function tagTone(tag: StateTag): Tone {
	return tag.namespace === 'task' ? taskTone(tag.value as TaskState) ?? 'gray' : prdTone(tag.value as PrdState) ?? 'gray';
}

function buildDecorations(view: EditorView, settings: RenderSettings): DecorationSet {
	const file = view.state.field(editorInfoField, false)?.file;
	const livePreview = view.state.field(editorLivePreviewField, false);
	if (!file || !livePreview || !settings.enabledFiles.includes(file.path)) return Decoration.none;

	const customColors = activeColorRules(settings.colorRules);
	const parsed = parseStateDocument(view.state.doc.toString(), customColors);
	const decorations = [];
	for (const line of parsed) {
		const docLine = view.state.doc.line(line.number);
		const task = taskTone(line.effective.task);
		const prd = prdTone(line.effective.prd);
		const customColor = line.effectiveCustom ? customColors.get(line.effectiveCustom) : undefined;
		if (task || prd || customColor || line.conflicts.length > 0 || line.customConflict) {
			const classes = ['bsr-line', `bsr-opacity-${settings.opacity}`];
			if (!settings.tagContainers) classes.push('bsr-no-tag-container');
			if (task) classes.push(`bsr-task-${task}`);
			if (prd) classes.push(`bsr-prd-${prd}`);
			if (task && prd) classes.push('bsr-dual');
			if (line.effective.prd === 'obsolete') classes.push('bsr-obsolete');
			if (line.conflicts.length > 0) classes.push('bsr-conflict');
			if (customColor && !task && !prd) classes.push('bsr-custom-line');
			if (line.customConflict) classes.push('bsr-conflict');
			const attributes: Record<string, string> = { class: classes.join(' ') };
			if (customColor && !task && !prd) attributes.style = `--bsr-custom-color:${customColor}`;
			decorations.push(Decoration.line({ attributes }).range(docLine.from));
		}
		for (const tag of line.tags) {
			const classes = ['bsr-tag', `bsr-tag-${tagTone(tag)}`];
			if (line.conflicts.includes(tag.namespace)) classes.push('bsr-tag-conflict');
			decorations.push(Decoration.mark({ class: classes.join(' ') }).range(docLine.from + tag.from, docLine.from + tag.to));
		}
		for (const tag of line.customTags) {
			const color = customColors.get(tag.value);
			if (!color) continue;
			decorations.push(Decoration.mark({ class: 'bsr-tag bsr-custom-tag', attributes: { style: `--bsr-custom-color:${color}` } }).range(docLine.from + tag.from, docLine.from + tag.to));
		}
	}
	return Decoration.set(decorations, true);
}

export class RenderController {
	private readonly views = new Set<EditorView>();
	private currentSettings: RenderSettings;
	readonly extension: Extension;

	constructor(settings: RenderSettings) {
		this.currentSettings = settings;
		const views = this.views;
		const currentSettings = () => this.currentSettings;
		this.extension = ViewPlugin.fromClass(class {
		decorations: DecorationSet;
		private readonly view: EditorView;

		constructor(view: EditorView) {
			this.view = view;
			views.add(view);
			this.decorations = buildDecorations(view, currentSettings());
		}

		update(update: ViewUpdate): void {
			if (update.docChanged || update.viewportChanged || update.transactions.some((tr) => tr.effects.some((effect) => effect.is(REFRESH)))) {
				this.decorations = buildDecorations(update.view, currentSettings());
			}
		}

		destroy(): void {
			views.delete(this.view);
		}
		}, { decorations: (plugin) => plugin.decorations });
	}

	updateSettings(settings: RenderSettings): void {
		this.currentSettings = settings;
		for (const view of this.views) view.dispatch({ effects: REFRESH.of() });
	}

	dispose(): void {
		this.views.clear();
	}
}
