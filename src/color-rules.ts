export interface ColorRule {
	tag: string;
	color: string;
	enabled: boolean;
}

export interface ColorRulesDocument {
	version: 1;
	rules: ColorRule[];
}

export const COLOR_RULES_PATH = 'block-state-renderer.colors.json';
export const EMPTY_COLOR_RULES: ColorRulesDocument = { version: 1, rules: [] };

const TAG_PATTERN = /^#[\p{L}\p{N}_-]+(?:\/[\p{L}\p{N}_-]+)*$/u;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function parseColorRules(value: unknown): ColorRulesDocument | null {
	if (typeof value !== 'object' || value === null) return null;
	const source = value as Record<string, unknown>;
	if (source.version !== 1 || !Array.isArray(source.rules)) return null;
	const rules: ColorRule[] = [];
	const seen = new Set<string>();
	for (const candidate of source.rules) {
		if (typeof candidate !== 'object' || candidate === null) return null;
		const rule = candidate as Record<string, unknown>;
		if (typeof rule.tag !== 'string' || !TAG_PATTERN.test(rule.tag) || rule.tag === '#task' || rule.tag === '#prd' || rule.tag.startsWith('#task/') || rule.tag.startsWith('#prd/')) return null;
		if (typeof rule.color !== 'string' || !COLOR_PATTERN.test(rule.color) || typeof rule.enabled !== 'boolean') return null;
		if (seen.has(rule.tag)) return null;
		seen.add(rule.tag);
		rules.push({ tag: rule.tag, color: rule.color.toLowerCase(), enabled: rule.enabled });
	}
	return { version: 1, rules };
}

export function activeColorRules(document: ColorRulesDocument): Map<string, string> {
	return new Map(document.rules.filter((rule) => rule.enabled).map((rule) => [rule.tag, rule.color]));
}
