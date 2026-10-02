import assert from 'node:assert/strict';
import test from 'node:test';
import { parseStateDocument } from '../src/state-parser.ts';

const parse = (source) => parseStateDocument(source).map(({ effective, tags, conflicts }) => ({ effective, tags: tags.map(({ namespace, value }) => `${namespace}/${value}`), conflicts }));

test('inherits and overrides the nearest ancestor recursively', () => {
	const lines = parse('- #prd/open/decision Parent\n\t- Child\n\t- #prd/confirmed Confirmed\n\t\t- Inherits confirmed\n\t\t- #prd/open/research Research\n\t\t\t- Inherits research\n- Sibling');
	assert.deepEqual(lines.map((line) => line.effective.prd), ['open/decision', 'open/decision', 'confirmed', 'confirmed', 'open/research', 'open/research', null]);
});

test('task and prd inheritance are independent across multiple levels', () => {
	const lines = parse('- #task/todo #prd/provisional Parent\n\t- #prd/confirmed Child\n\t\t- #task/blocked Grandchild');
	assert.deepEqual(lines.map((line) => line.effective), [
		{ task: 'todo', prd: 'provisional' },
		{ task: 'todo', prd: 'confirmed' },
		{ task: 'blocked', prd: 'confirmed' },
	]);
});

test('continuation lines stay in the item while top-level prose ends the tree', () => {
	const lines = parse('- #task/in_progress A long item\n  continues here\n\t- Child\nOutside paragraph\n- Next');
	assert.deepEqual(lines.map((line) => line.effective.task), ['in_progress', 'in_progress', 'in_progress', null, null]);
});

test('fenced and inline code pseudo-tags never override state', () => {
	const lines = parse('- #prd/confirmed Parent\n\t```md\n\t- #prd/obsolete fake\n\t```\n\t- `#prd/obsolete` literal');
	assert.deepEqual(lines.map((line) => line.effective.prd), ['confirmed', 'confirmed', 'confirmed', 'confirmed', 'confirmed']);
	assert.equal(lines[2].tags.length, 0);
	assert.equal(lines[4].tags.length, 0);
});

test('invalid tags do not override; conflicting explicit states have no effective value', () => {
	const lines = parse('- #task/todo #prd/confirmed Parent\n\t- #task/open Invalid\n\t- #prd/open/research #prd/obsolete Conflict\n\t\t- Child\n\t\t- #prd/provisional Recovery');
	assert.equal(lines[1].effective.task, 'todo');
	assert.equal(lines[2].effective.prd, null);
	assert.deepEqual(lines[2].conflicts, ['prd']);
	assert.equal(lines[3].effective.prd, null);
	assert.equal(lines[4].effective.prd, 'provisional');
});

test('changing indentation changes inherited state without stale results', () => {
	const nested = parse('- #task/todo A\n\t- B');
	const sibling = parse('- #task/todo A\n- B');
	assert.equal(nested[1].effective.task, 'todo');
	assert.equal(sibling[1].effective.task, null);
});
