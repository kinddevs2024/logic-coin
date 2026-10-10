import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyNativeEvidence } from './compatibility-evidence.mjs';
const plugin = { type: 'dir', filePath: '../node_modules/expo-updates/expo-updates-gradle-plugin', reasons: ['expoAutolinkingAndroid'], hash: 'pristine' };
const native = { type: 'dir', filePath: '../node_modules/native-library/android', reasons: ['native'], hash: 'same' };
const current = { runtimeVersion: 'fresh', fingerprintSources: [plugin, native] };
const reference = structuredClone(current);
const built = { hash: 'actual-apk', sources: [{ ...plugin, hash: 'build-generated' }, native] };
test('accepts only independently identical native sources and an attested actual APK fingerprint', () => {
  assert.equal(verifyNativeEvidence('actual-apk', current, reference, built).runtimeVersion, 'actual-apk');
});
test('rejects wrong APK attestation', () => assert.throws(() => verifyNativeEvidence('different-apk', current, reference, built)));
test('rejects a changed dependency or native source', () => {
  const changed = structuredClone(current); changed.fingerprintSources[1].hash = 'changed';
  assert.throws(() => verifyNativeEvidence('actual-apk', changed, reference, built));
});
test('rejects a changed APK native library even when both fresh checkouts match', () => {
  const changed = structuredClone(built); changed.sources[1].hash = 'changed';
  assert.throws(() => verifyNativeEvidence('actual-apk', current, reference, changed));
});
test('rejects missing native sources', () => {
  const changed = structuredClone(built); changed.sources.pop();
  assert.throws(() => verifyNativeEvidence('actual-apk', current, reference, changed));
});
