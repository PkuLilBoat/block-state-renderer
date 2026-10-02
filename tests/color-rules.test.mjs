import assert from 'node:assert/strict';
import test from 'node:test';
import { activeColorRules, parseColorRules } from '../src/color-rules.ts';
import { parseStateDocument } from '../src/state-parser.ts';

test('accepts exact case-sensitive nested tags and excludes disabled rules', () => {
	const document = parseColorRules({ version: 1, rules: [
		{ tag: '#area/research', color: '#ABCDEF', enabled: true },
		{ tag: '#area/done', color: '#111111', enabled: false },
	] });
	assert.ok(document);
	assert.deepEqual([...activeColorRules(document)], [['#area/research', '#abcdef']]);
	const lines = parseStateDocument('- #area/research Match\n- #area/Research No match\n- #area No prefix match', activeColorRules(document));
	assert.deepEqual(lines.map((line) => line.effectiveCustom), ['#area/research', null, null]);
});

test('rejects invalid colors, duplicates and built-in state namespaces', () => {
	for (const rules of [
		[{ tag: '#a', color: 'red', enabled: true }],
		[{ tag: '#a', color: '#000000', enabled: true }, { tag: '#a', color: '#ffffff', enabled: true }],
		[{ tag: '#prd/confirmed', color: '#000000', enabled: true }],
		[{ tag: '#task', color: '#000000', enabled: true }],
	]) assert.equal(parseColorRules({ version: 1, rules }), null);
});

test('custom colors inherit, override and conflict without changing built-in states', () => {
	const colors = new Map([['#area/a', '#111111'], ['#area/b', '#222222']]);
	const lines = parseStateDocument('- #area/a Parent\n\t- Inherit\n\t- #area/b Override\n\t\t- Descendant\n\t- #area/a #area/b Conflict\n\t\t- No color\n\t\t- #area/a Recover\n- Sibling', colors);
	assert.deepEqual(lines.map((line) => line.effectiveCustom), ['#area/a', '#area/a', '#area/b', '#area/b', null, null, '#area/a', null]);
	assert.equal(lines[4].customConflict, true);
	const both = parseStateDocument('- #prd/confirmed #area/a Both', colors)[0];
	assert.equal(both?.effective.prd, 'confirmed');
	assert.equal(both?.effectiveCustom, '#area/a');
});

test('same-color labels share one gradient and pseudo-tags stay ignored', () => {
	const colors = new Map([['#area/a', '#123456'], ['#area/b', '#123456']]);
	const lines = parseStateDocument('- #area/a #area/b Same color\n\t- `#area/b` inline\n\t```md\n\t- #area/b fenced\n\t```', colors);
	assert.equal(lines[0]?.customConflict, false);
	assert.equal(lines[0]?.effectiveCustom, '#area/a');
	assert.equal(lines[1]?.customTags.length, 0);
	assert.equal(lines[3]?.customTags.length, 0);
});
