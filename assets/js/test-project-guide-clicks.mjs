import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url);
const source = readFileSync(new URL('projects-parser.js', import.meta.url), 'utf8');
const map = JSON.parse(readFileSync(new URL('content/url-map.json', root), 'utf8'));
const projects = JSON.parse(readFileSync(new URL('projects/projects.json', root), 'utf8'));
const calls = [];
let click;
const sandbox = {
  window: { guidesParser: { open: (...args) => calls.push(args) } },
  document: { addEventListener() {} },
};
vm.runInNewContext(source + '\nglobalThis.Parser = ProjectsParser;', sandbox);
const parser = Object.create(sandbox.Parser.prototype);
parser.container = { dataset: {}, addEventListener: (_, fn) => { click = fn; } };
parser.bindGuideLinks();
let tested = 0;
for (const group of Object.values(projects)) {
  for (const project of Array.isArray(group) ? group : group.items || []) {
    for (const link of project.links || []) {
      if (!link.guide) continue;
      for (const lang of ['en', 'tr']) {
        const slug = map.guides[link.guide][lang];
        const code = lang.toUpperCase();
        const href = `/guides/${slug}/${code}/`;
        let prevented = false;
        click({
          target: { closest: () => ({ dataset: { guide: link.guide }, getAttribute: () => href }) },
          preventDefault: () => { prevented = true; },
        });
        const [id, options] = calls.at(-1);
        assert.equal(id, link.guide, `Must load stable content ID for ${href}`);
        assert.equal(options.lang, code);
        assert.ok(prevented);
        assert.ok(existsSync(new URL(`content/guides/${id}/${code}.md`, root)));
        assert.ok(existsSync(new URL(`${href.slice(1)}index.html`, root)));
        tested++;
      }
    }
  }
}
assert.ok(tested > 0);
console.log(`PASS ${tested} project-guide clicks: EN/TR stable content IDs and public destinations`);
