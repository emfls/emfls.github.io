const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../kor/report/seasonal/war-emergency-supplies-3-to-365-days.html'), 'utf8');
const owned = html.match(/^function owned\(id\).*$/m)[0];
const start = html.indexOf('$("#kit-panel").addEventListener("change",');
const end = html.indexOf('$("#reset").addEventListener', start);
assert.ok(start >= 0 && end > start, 'stock change listener exists');

function changeStock(previous, value, nativeValid = true, isStock = true) {
  let onChange;
  const attributes = new Map([['aria-invalid', 'true']]);
  const input = {
    value, dataset: { stock: 'water' }, validity: { valid: nativeValid },
    matches: (selector) => selector === 'input[data-stock]' && isStock,
    removeAttribute: (name) => attributes.delete(name),
  };
  vm.runInNewContext(owned + '\n' + html.slice(start, end), {
    inventory: { water: previous },
    $: (selector) => {
      assert.equal(selector, '#kit-panel');
      return { addEventListener: (type, listener) => { assert.equal(type, 'change'); onChange = listener; } };
    },
  });
  onChange({ target: input });
  return { value: input.value, invalid: attributes.get('aria-invalid') };
}

test('clearing an invalid stock entry restores the saved valid count without a stale error', () => {
  assert.deepEqual(changeStock(3, ''), { value: '3', invalid: undefined });
  assert.deepEqual(changeStock(0, ' '), { value: '0', invalid: undefined });
});

test('restoring a count still outside native bounds does not erase its error', () => {
  assert.deepEqual(changeStock(1000000, '', false), { value: '1000000', invalid: 'true' });
});

test('nonempty invalid values and unrelated controls are left for their existing validation', () => {
  assert.deepEqual(changeStock(3, '-1', false), { value: '-1', invalid: 'true' });
  assert.deepEqual(changeStock(3, '', true, false), { value: '', invalid: 'true' });
});
