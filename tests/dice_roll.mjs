import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(process.argv[2], 'utf8');
const resultTag = html.match(/<[^>]+\bid="result"[^>]*>/)?.[0];
assert.ok(resultTag, 'Roll output element #result must exist');
assert.match(resultTag, /\bclass="result-label"/);
assert.match(resultTag, /\brole="status"/);
assert.match(resultTag, /\baria-live="polite"/);
const handler = html.match(/<button\b[^>]*class="roll-btn"[^>]*onclick="([^"]+)"/)?.[1];
assert.ok(handler, 'Use the real Roll button handler');
const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).find(code => code.includes('function rollDice()'));
assert.ok(script);
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
for (let face = 1; face <= 6; face++) {
  const elements = Object.fromEntries(ids.map(id => [id, { style: {}, innerHTML: '' }]));
  const random = Object.create(Math);
  // Both rolls use identical draws, including the first-face and last-face boundaries.
  random.random = () => face === 6 ? 1 - Number.EPSILON : (face - 1) / 6;
  const context = vm.createContext({ Math: random, document: { getElementById: id => elements[id] ?? null } });
  vm.runInContext(script, context, { timeout: 1000 });
  for (let roll = 0; roll < 2; roll++) {
    assert.doesNotThrow(() => vm.runInContext(handler, context, { timeout: 1000 }));
    assert.equal(elements.result.innerHTML, `Result: <b>${face}</b>`);
    assert.match(elements.dice.style.transform, /^rotateX\(-?\d+deg\) rotateY\(-?\d+deg\)$/);
  }
}
console.log('PASS: accessible result, first 1, last 6, all six faces, identical-draw repeats, Roll handler without exceptions');
