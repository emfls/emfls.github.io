const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const path = require('node:path');
const html = fs.readFileSync(process.env.QR_READER_PAGE || path.join(__dirname, '../util/qrcode/index.html'), 'utf8');
const start = html.indexOf('// QR Reading (Camera & Image)');
assert.ok(start > 0);
const source = html.slice(start, html.indexOf('</script>', start));
const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};

function app(behavior = {}) {
    const elements = Object.fromEntries(['reader', 'startCamBtn', 'stopCamBtn', 'scanResult', 'imgUpload']
        .map(id => [id, { style: {}, disabled: false, textContent: '', innerHTML: '', value: '', files: [] }]));
    let result = '';
    Object.defineProperties(elements.scanResult, {
        textContent: { get: () => result.replace(/<[^>]*>/g, ''), set: value => { result = value; } },
        innerHTML: { get: () => result, set: value => { result = value; } }
    });
    const events = [];
    let cameraCallback;
    class Scanner {
        static getCameras() { throw new Error('File reading must not enumerate cameras'); }
        start(_, __, success) { cameraCallback = success; events.push('start'); return behavior.start ? behavior.start() : Promise.resolve(); }
        stop() { events.push('stop'); return behavior.stop ? behavior.stop() : Promise.resolve(); }
        scanFile(file, show) {
            events.push(`file:${file.name}`);
            assert.equal(show, true);
            return behavior.decode ? behavior.decode(file) : Promise.resolve(file.code);
        }
    }
    const listeners = {};
    vm.runInNewContext(source, { document: { getElementById: id => elements[id] },
        Html5Qrcode: behavior.missing ? undefined : Scanner,
        window: { addEventListener: (name, fn) => { listeners[name] = fn; } } });
    return { elements, events, listeners,
        cameraCode: code => cameraCallback(code),
        upload: file => { const input = elements.imgUpload; input.files = file ? [file] : []; input.value = file ? file.name : ''; return input.onchange({ target: input }); },
        result: () => elements.scanResult.textContent };
}
const first = { name: 'one.png', code: 'https://example.com/one' };
const second = { name: 'two.png', code: 'https://example.com/two' };

test('a file decodes exactly without accessing cameras', async () => {
    const a = app(); await a.upload(first);
    assert.equal(a.result(), 'Result: https://example.com/one');
    assert.deepEqual(a.events, ['file:one.png']);
    assert.equal(a.elements.imgUpload.disabled, false);
});
test('QR-free or corrupt image can be followed by a valid retry', async () => {
    const a = app({ decode: file => file.code ? Promise.resolve(file.code) : Promise.reject(new Error('invalid image')) });
    for (const name of ['blank.png', 'corrupt.png']) {
        await a.upload({ name }); assert.match(a.result(), /No QR code found/);
        await a.upload(first); assert.equal(a.result(), 'Result: https://example.com/one');
    }
    assert.equal(a.elements.imgUpload.value, '');
});
test('cancelled selection makes no request', async () => {
    const a = app(); await a.upload(null); assert.deepEqual(a.events, []);
});
test('missing library produces a recoverable visible error', async () => {
    const a = app({ missing: true }); await a.upload(first);
    assert.match(a.result(), /could not load/); assert.equal(a.elements.imgUpload.disabled, false);
});
test('a queued second change cannot overlap or replace an accepted upload', async () => {
    const wait = deferred(); const a = app({ decode: file => file === first ? wait.promise : Promise.resolve(file.code) });
    const pending = a.upload(first); await Promise.resolve();
    await a.upload(second); assert.deepEqual(a.events, ['file:one.png']);
    wait.resolve(first.code); await pending;
    assert.equal(a.result(), 'Result: https://example.com/one');
    await a.upload(second); assert.equal(a.result(), 'Result: https://example.com/two');
});
test('file input stays locked until a pending camera start settles', async () => {
    const start = deferred(); const a = app({ start: () => start.promise });
    const pending = a.elements.startCamBtn.onclick(); await Promise.resolve();
    assert.equal(a.elements.imgUpload.disabled, true);
    await a.upload(first); assert.deepEqual(a.events, ['start']);
    start.resolve(); await pending;
    await a.upload(first); assert.deepEqual(a.events, ['start', 'stop', 'file:one.png']);
});
test('late camera results cannot overwrite an image result', async () => {
    const a = app(); await a.elements.startCamBtn.onclick();
    await a.upload(first); a.cameraCode('late camera result');
    assert.equal(a.result(), 'Result: https://example.com/one');
    assert.deepEqual(a.events, ['start', 'stop', 'file:one.png']);
});
for (const reason of ['NotAllowedError', 'NotFoundError']) test(`${reason} leaves file reading usable`, async () => {
    const a = app({ start: () => Promise.reject(new Error(reason)) });
    await a.elements.startCamBtn.onclick();
    assert.equal(a.elements.startCamBtn.style.display, '');
    assert.equal(a.elements.imgUpload.disabled, false);
    await a.upload(first); assert.equal(a.result(), 'Result: https://example.com/one');
});
test('a failed camera stop does not start a competing file scan', async () => {
    const a = app({ stop: () => Promise.reject(new Error('stop failed')) });
    await a.elements.startCamBtn.onclick(); await a.upload(first);
    assert.deepEqual(a.events, ['start', 'stop']); assert.match(a.result(), /stop.*camera|camera.*stop/i);
    assert.equal(a.elements.imgUpload.disabled, false);
});
test('camera result stops the stream once and ignores repeats', async () => {
    const a = app(); await a.elements.startCamBtn.onclick();
    await a.cameraCode('camera value'); await a.cameraCode('late value');
    assert.equal(a.result(), 'Result: camera value');
    assert.deepEqual(a.events, ['start', 'stop']);
});
test('leaving the page invalidates an unfinished file result', async () => {
    const wait = deferred(); const a = app({ decode: () => wait.promise });
    const pending = a.upload(first); await Promise.resolve();
    a.listeners.beforeunload(); wait.resolve(first.code); await pending;
    assert.doesNotMatch(a.result(), /https:\/\/example.com\/one/);
});
