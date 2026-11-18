#!/usr/bin/env node
// transform-test: run the "transform" tests in a Bolt App's bolt-app.json offline.
//
// Why: `bolt-apps lint` checks the shape of tests but does not run them ("Bolt runs them").
// An author of a tier 2 app only learns that an `expect` is wrong after packing and adding
// the app in Bolt. This runner executes the common pipe steps locally so the edit/test loop
// takes a second instead of a reinstall.
//
// It is NOT Bolt's engine: it re-implements the documented steps in JavaScript. Steps it does
// not model are reported as "skipped", never as passed. Regex dialect differences between this
// runner (JS RegExp) and Bolt's engine are possible.
//
// Usage: node tools/transform-test.mjs <app-folder> [--bolt-apps <path to bolt-apps clone>]

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const appDir = args.find((a) => !a.startsWith('--'));
const cloneIdx = args.indexOf('--bolt-apps');
const clone = cloneIdx >= 0 ? args[cloneIdx + 1] : process.env.BOLT_APPS_DIR;
if (!appDir || !clone) {
	console.error('usage: node tools/transform-test.mjs <app-folder> --bolt-apps <bolt-apps clone>  (or set BOLT_APPS_DIR)');
	process.exit(2);
}
// Use the toolkit's own YAML subset reader, so a file this runner reads is one Bolt's tools read.
const { parseYaml } = await import(pathToFileURL(path.join(clone, 'toolkit/lib/yamlsubset.mjs')).href);

const plain = (n) => {
	if (!n) return n;
	if (n.t === 's') return n.v;
	if (n.t === 'l') return n.items.map(plain);
	if (n.t === 'm') return Object.fromEntries(n.entries.map((e) => [e.key, plain(e.value)]));
	return n.v;
};

const lines = (s) => s.split(/\r?\n/);
const perLine = (fn) => (s) => lines(s).map(fn).join('\n');
const titleCase = (s) => s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());

const STEPS = {
	lines: (s) => lines(s).map((l) => l.trimEnd()).filter((l) => l.trim() !== '').join('\n'),
	trim: (s) => s.trim(),
	upper: (s) => s.toUpperCase(),
	lower: (s) => s.toLowerCase(),
	title: (s) => titleCase(s),
	sort: (s) => lines(s).sort((a, b) => a.localeCompare(b)).join('\n'),
	reverse: (s) => lines(s).reverse().join('\n'),
	dedupe: (s) => [...new Set(lines(s))].join('\n'),
};
const PARAM_STEPS = {
	replace: (s, o) => s.replace(new RegExp(o.from, o.flags ?? 'g'), o.to),
	filter: (s, o) => {
		const [k, v] = Object.entries(o)[0];
		const test = {
			contains: (l) => l.includes(v),
			not_contains: (l) => !l.includes(v),
			matches: (l) => new RegExp(v).test(l),
			not_matches: (l) => !new RegExp(v).test(l),
		}[k];
		return lines(s).filter(test).join('\n');
	},
	prefix: (s, v) => perLine((l) => v + l)(s),
	suffix: (s, v) => perLine((l) => l + v)(s),
	template: (s, v) => v.split('{value}').join(s),
	head: (s, n) => lines(s).slice(0, n).join('\n'),
	tail: (s, n) => (n === 0 ? '' : lines(s).slice(-n).join('\n')),
	split: (s, v) => s.split(v).join('\n'),
	join: (s, v) => lines(s).join(v),
};

function run(pipe, input) {
	let s = input;
	for (const step of pipe) {
		if (typeof step === 'string') {
			if (!STEPS[step]) return { skipped: `step "${step}" is not modelled by this runner` };
			s = STEPS[step](s);
		} else {
			const [name, opt] = Object.entries(step)[0];
			if (!PARAM_STEPS[name]) return { skipped: `step "${name}" is not modelled by this runner` };
			const val = typeof opt === 'string' && /^\d+$/.test(opt) ? Number(opt) : opt;
			s = PARAM_STEPS[name](s, val);
		}
	}
	return { out: s };
}

const manifest = JSON.parse(fs.readFileSync(path.join(appDir, 'bolt-app.json'), 'utf8'));
const utilDir = path.join(appDir, 'utilities');
const apps = {};
for (const f of fs.existsSync(utilDir) ? fs.readdirSync(utilDir) : []) {
	if (!f.endsWith('.yaml')) continue;
	const doc = plain(parseYaml(fs.readFileSync(path.join(utilDir, f), 'utf8')));
	if (doc.runtime === 'transform') apps[doc.id] = doc;
}

let pass = 0, fail = 0, skip = 0;
for (const t of manifest.tests || []) {
	if (t.kind !== 'transform') continue;
	const app = apps[t.target];
	if (!app) { console.log(`FAIL  ${t.name}\n      no transform app with id "${t.target}" in utilities/`); fail++; continue; }
	const r = run(app.transform.pipe, t.input);
	if (r.skipped) { console.log(`SKIP  ${t.name}  (${r.skipped})`); skip++; continue; }
	const got = r.out.trimEnd(), want = String(t.expect).trimEnd(); // the toolkit compares after trimming trailing whitespace
	if (got === want) { console.log(`PASS  ${t.name}`); pass++; }
	else {
		fail++;
		console.log(`FAIL  ${t.name}`);
		const g = got.split('\n'), w = want.split('\n');
		for (let i = 0; i < Math.max(g.length, w.length); i++) {
			if (g[i] !== w[i]) { console.log(`      line ${i + 1}\n      expect: ${JSON.stringify(w[i])}\n      got:    ${JSON.stringify(g[i])}`); break; }
		}
	}
}
console.log(`\n${pass} passed, ${fail} failed, ${skip} skipped`);
process.exit(fail ? 1 : 0);
