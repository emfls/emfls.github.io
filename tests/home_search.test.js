const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const script = html.slice(html.indexOf('let searchIndex='), html.indexOf('    document.getElementById("search-form")'));

function app(fetch) {
  const classes = new Set();
  const nodes = {
    'site-search': { value: '' },
    'search-results': { innerHTML: '', classList: { add: x => classes.add(x), remove: x => classes.delete(x) } },
  };
  const context = vm.createContext({ fetch, document: { getElementById: id => nodes[id] } });
  vm.runInContext(script, context);
  return { context, nodes, classes };
}
const index = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/content-index-ko.json'), 'utf8'));

test('real multiword queries find existing articles without accepting only one query word', () => {
  const { context } = app();
  for (const query of ['포천 캠핑장', '김포 캠핑장', '제주 캠핑장', '메이플 장비', 'Windows 11 배터리']) {
    assert.ok(index.some(item => context.score(item, query) > 0), query);
  }
  const local = index.find(x => x.url === '/kor/report/camp/pocheon.html');
  const other = index.find(x => x.url === '/kor/report/camp/seongju.html');
  assert.ok(context.score(local, '포천 캠핑장') > context.score(other, '포천 캠핑장'), 'matching region in the title must outrank a passing description mention');
  assert.equal(context.score({ title: '부산 캠핑장' }, '포천 캠핑장'), 0);
  assert.equal(context.score({ title: '포천 여행' }, '포천 캠핑장'), 0);
  assert.equal(context.score({ title: '포천 캠핑장' }, ''), 0);
  assert.ok(context.score({ title: '포천 캠핑장' }, '포천 캠핑장') > context.score({ title: '포천 겨울 캠핑장' }, '포천 캠핑장'));
});

test('overlapping searches share the index load and render only the newest query', async () => {
  let resolve, calls = 0;
  const pending = new Promise(r => { resolve = r; });
  const a = app(() => { calls++; return pending; });
  const first = a.context.runSearch('포천');
  const second = a.context.runSearch('제주');
  assert.equal(calls, 1);
  resolve({ ok: true, json: async () => [{ title: '포천 캠핑장', url: '/pocheon' }, { title: '제주 캠핑장', url: '/jeju' }] });
  await Promise.all([first, second]);
  assert.equal(a.nodes['site-search'].value, '제주');
  assert.match(a.nodes['search-results'].innerHTML, /제주 캠핑장/);
  assert.doesNotMatch(a.nodes['search-results'].innerHTML, /포천 캠핑장/);
});

test('clearing a pending search keeps results closed and does not fetch for an empty submit', async () => {
  let resolve, calls = 0;
  const a = app(() => { calls++; return new Promise(r => { resolve = r; }); });
  const empty = a.context.runSearch('  ');
  assert.equal(calls, 0);
  await empty;
  const first = a.context.runSearch('포천');
  await a.context.runSearch('');
  resolve({ ok: true, json: async () => [{ title: '포천 캠핑장', url: '/pocheon' }] });
  await first;
  assert.equal(a.nodes['search-results'].innerHTML, '');
  assert.equal(a.classes.has('is-open'), false);
});

test('a failed or invalid index can be retried and displayed text remains escaped', async () => {
  let calls = 0;
  const a = app(async () => ({ ok: true, json: async () => ++calls === 1 ? {} : [{ title: '<포천> 캠핑장', url: '/pocheon' }] }));
  await a.context.runSearch('포천');
  assert.match(a.nodes['search-results'].innerHTML, /검색 데이터를 불러오지 못했습니다/);
  await a.context.runSearch('포천');
  assert.equal(calls, 2);
  assert.match(a.nodes['search-results'].innerHTML, /&lt;포천&gt;/);
  assert.doesNotMatch(a.nodes['search-results'].innerHTML, /<포천>/);
});
