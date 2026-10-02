export type Namespace = 'task' | 'prd';
export type TaskState = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'blocked' | 'done' | 'cancel';
export type PrdState = 'open/missing' | 'open/research' | 'open/decision' | 'provisional' | 'confirmed' | 'obsolete';
export type StateValue = TaskState | PrdState;

export interface StateTag {
	namespace: Namespace;
	value: StateValue;
	from: number;
	to: number;
}

export interface CustomTag {
	value: string;
	from: number;
	to: number;
}

export interface EffectiveStates {
	task: TaskState | null;
	prd: PrdState | null;
}

export interface ParsedLine {
	number: number;
	text: string;
	isListItem: boolean;
	indent: number;
	tags: StateTag[];
	effective: EffectiveStates;
	conflicts: Namespace[];
	customTags: CustomTag[];
	effectiveCustom: string | null;
	customConflict: boolean;
}

interface ListFrame {
	indent: number;
	effective: EffectiveStates;
	effectiveCustom: string | null;
}

const TASK_STATES = new Set<TaskState>(['backlog', 'todo', 'in_progress', 'in_review', 'blocked', 'done', 'cancel']);
const PRD_STATES = new Set<PrdState>(['open/missing', 'open/research', 'open/decision', 'provisional', 'confirmed', 'obsolete']);
const LIST_ITEM = /^([\t ]*)([-+*])(?:[\t ]+|$)(.*)$/;
const STATE_TAG = /(^|[^\w/])#(task|prd)\/([a-z_]+(?:\/[a-z_]+)?)(?![\w/])/g;
const CUSTOM_TAG = /(^|[^\p{L}\p{N}_/])#([\p{L}\p{N}_/-]+)(?![\p{L}\p{N}_/])/gu;
const FENCE = /^(`{3,}|~{3,})/;

function indentation(prefix: string): number {
	let width = 0;
	for (const char of prefix) width += char === '\t' ? 4 - width % 4 : 1;
	return width;
}

function maskInlineCode(text: string): string {
	let output = '';
	let position = 0;
	let closingLength = 0;
	while (position < text.length) {
		if (text[position] !== '`') {
			output += closingLength ? ' ' : text[position];
			position++;
			continue;
		}
		let end = position;
		while (text[end] === '`') end++;
		const runLength = end - position;
		if (closingLength === 0) closingLength = runLength;
		else if (runLength === closingLength) closingLength = 0;
		output += ' '.repeat(runLength);
		position = end;
	}
	return output;
}

function findTags(text: string, offset: number): StateTag[] {
	const tags: StateTag[] = [];
	const visible = maskInlineCode(text);
	STATE_TAG.lastIndex = 0;
	for (const match of visible.matchAll(STATE_TAG)) {
		const namespace = match[2] as Namespace;
		const value = match[3];
		if (!value) continue;
		if (namespace === 'task' && !TASK_STATES.has(value as TaskState)) continue;
		if (namespace === 'prd' && !PRD_STATES.has(value as PrdState)) continue;
		const from = offset + (match.index ?? 0) + (match[1]?.length ?? 0);
		tags.push({ namespace, value: value as StateValue, from, to: from + namespace.length + value.length + 2 });
	}
	return tags;
}

function findCustomTags(text: string, offset: number, configured: ReadonlyMap<string, string>): CustomTag[] {
	const tags: CustomTag[] = [];
	const visible = maskInlineCode(text);
	CUSTOM_TAG.lastIndex = 0;
	for (const match of visible.matchAll(CUSTOM_TAG)) {
		const value = `#${match[2] ?? ''}`;
		if (!configured.has(value)) continue;
		const from = offset + (match.index ?? 0) + (match[1]?.length ?? 0);
		tags.push({ value, from, to: from + value.length });
	}
	return tags;
}

function ownState<T extends StateValue>(tags: StateTag[], namespace: Namespace): { value: T | null; conflict: boolean; present: boolean } {
	const values = tags.filter((tag) => tag.namespace === namespace).map((tag) => tag.value as T);
	if (values.length === 0) return { value: null, conflict: false, present: false };
	const distinct = new Set(values);
	return { value: distinct.size === 1 ? values[0] ?? null : null, conflict: distinct.size > 1, present: true };
}

export function parseStateDocument(markdown: string, configuredCustom: ReadonlyMap<string, string> = new Map()): ParsedLine[] {
	const lines = markdown.split('\n');
	const result: ParsedLine[] = [];
	const frames: ListFrame[] = [];
	let fenceCharacter = '';
	let fenceLength = 0;

	for (let index = 0; index < lines.length; index++) {
		const text = lines[index] ?? '';
		const listMatch = fenceCharacter ? null : LIST_ITEM.exec(text);
		const indent = indentation(listMatch?.[1] ?? /^([\t ]*)/.exec(text)?.[1] ?? '');
		const body = listMatch?.[3] ?? text.trimStart();
		const fenceMatch = FENCE.exec(body);
		const isFenceLine = Boolean(fenceMatch);
		let tags: StateTag[] = [];
		let conflicts: Namespace[] = [];
		let effective: EffectiveStates = { task: null, prd: null };
		let customTags: CustomTag[] = [];
		let effectiveCustom: string | null = null;
		let customConflict = false;

		if (listMatch) {
			while (frames.length > 0 && (frames.at(-1)?.indent ?? -1) >= indent) frames.pop();
			const inherited = frames.at(-1)?.effective ?? effective;
			tags = isFenceLine ? [] : findTags(body, text.length - body.length);
			customTags = isFenceLine ? [] : findCustomTags(body, text.length - body.length, configuredCustom);
			const uniqueColors = new Set(customTags.map((tag) => configuredCustom.get(tag.value)));
			customConflict = uniqueColors.size > 1;
			effectiveCustom = customTags.length > 0 ? (customConflict ? null : customTags[0]?.value ?? null) : frames.at(-1)?.effectiveCustom ?? null;
			const ownTask = ownState<TaskState>(tags, 'task');
			const ownPrd = ownState<PrdState>(tags, 'prd');
			effective = {
				task: ownTask.present ? ownTask.value : inherited.task,
				prd: ownPrd.present ? ownPrd.value : inherited.prd,
			};
			if (ownTask.conflict) conflicts.push('task');
			if (ownPrd.conflict) conflicts.push('prd');
			frames.push({ indent, effective, effectiveCustom });
		} else if (text.trim() && frames.length > 0) {
			if (indent > (frames.at(-1)?.indent ?? -1) || fenceCharacter) {
				effective = frames.at(-1)?.effective ?? effective;
				effectiveCustom = frames.at(-1)?.effectiveCustom ?? null;
			} else {
				frames.length = 0;
			}
		}

		if (isFenceLine && fenceMatch) {
			const delimiter = fenceMatch[1] ?? '';
			if (!fenceCharacter) {
				fenceCharacter = delimiter[0] ?? '';
				fenceLength = delimiter.length;
			} else if (delimiter[0] === fenceCharacter && delimiter.length >= fenceLength) {
				fenceCharacter = '';
				fenceLength = 0;
			}
		}
		result.push({ number: index + 1, text, isListItem: Boolean(listMatch), indent, tags, effective, conflicts, customTags, effectiveCustom, customConflict });
	}
	return result;
}
