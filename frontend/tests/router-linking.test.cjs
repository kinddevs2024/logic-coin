const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { patchLinking } = require('../../scripts/patch-expo-router-linking.cjs');
const file = require.resolve('expo-router/build/fork/useLinking.native.js');
function setup(initialURL) {
  const effects = [], notifications = [];
  const exports = {};
  const react = { useRef: current => ({ current }), useEffect: effect => effects.push(effect), useCallback: callback => callback };
  const modules = {
    react, 'expo-linking': {}, 'react-native': { Platform: { OS: 'android' }, Linking: {} },
    './extractPathFromURL': { extractExpoPathFromURL: (_prefixes, url) => url },
    '../react-navigation/native': { useNavigationIndependentTree: () => false, getStateFromPath: path => ({ path }), getActionFromState: () => undefined },
  };
  vm.runInNewContext(patchLinking(fs.readFileSync(file, 'utf8')), { exports, require: name => { if (!(name in modules)) throw Error('Unexpected module'); return modules[name]; }, process: { env: { NODE_ENV: 'production' } }, console, Promise, setTimeout });
  const hook = exports.useLinking({ current: null }, { prefixes: [], getInitialURL: () => initialURL, subscribe: () => () => {} }, value => notifications.push(value));
  return { hook, notifications, mount: () => { const cleanups = effects.map(effect => effect()); return () => cleanups.forEach(cleanup => cleanup?.()); } };
}
test('initial asynchronous link does not update before mount, but preserves its route', async () => {
  const runtime = setup(Promise.resolve('/telegram-return'));
  const state = await runtime.hook.getInitialState();
  assert.equal(state.path, '/telegram-return');
  assert.deepEqual(runtime.notifications, []);
  const cleanup = runtime.mount();
  assert.deepEqual(runtime.notifications, ['/telegram-return']); cleanup();
});
test('initial synchronous link is also deferred until commit', async () => {
  const runtime = setup('/challenges');
  const state = await runtime.hook.getInitialState();
  assert.equal(state.path, '/challenges'); assert.deepEqual(runtime.notifications, []);
  runtime.mount()(); assert.deepEqual(runtime.notifications, ['/challenges']);
});
test('late URL resolution cannot update a removed navigation component', async () => {
  let resolve;
  const runtime = setup(new Promise(done => { resolve = done; }));
  const initial = runtime.hook.getInitialState();
  runtime.mount()(); resolve('/profile');
  assert.equal((await initial).path, '/profile'); assert.deepEqual(runtime.notifications, []);
});
test('patch is idempotent and rejects an unexpected dependency layout', () => {
  const source = fs.readFileSync(file, 'utf8'); assert.equal(patchLinking(patchLinking(source)), patchLinking(source));
  assert.throws(() => patchLinking('unexpected source'));
});
