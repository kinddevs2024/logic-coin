import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync, sign, randomUUID, createHash } from 'node:crypto';
import { updateServer } from './server.mjs';

test('signed updates are isolated by runtime and channel; tampering is rejected', async () => {
  const root = await mkdtemp(join(tmpdir(), 'logic-ota-test-'));
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const server = updateServer({ root, certificate: publicKey });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/updates`;
  const headers = { 'expo-platform': 'android', 'expo-runtime-version': 'test-runtime', 'expo-channel-name': 'preview', 'expo-protocol-version': '1' };
  try {
    assert.equal((await fetch(url, { headers })).status, 204);
    const id = randomUUID();
    const release = join(root, 'releases', id);
    const channel = join(root, 'channels', 'preview', 'android');
    await mkdir(release, { recursive: true });
    await mkdir(channel, { recursive: true });
    const body = JSON.stringify({ id, runtimeVersion: 'test-runtime', metadata: { channel: 'preview', platform: 'android' } });
    await writeFile(join(release, 'manifest.json'), body);
    await writeFile(join(release, 'signature.txt'), sign('RSA-SHA256', Buffer.from(body), privateKey).toString('base64'));
    await writeFile(join(channel, 'test-runtime.json'), JSON.stringify({ id }));
    const response = await fetch(url, { headers });
    assert.equal(response.status, 200);
    assert.ok(response.headers.get('expo-signature'));
    assert.equal(await response.text(), body);
    assert.equal((await fetch(url, { headers: { ...headers, 'expo-channel-name': 'production' } })).status, 204);
    assert.equal((await fetch(url, { headers: { ...headers, 'expo-runtime-version': 'other' } })).status, 204);
    assert.equal((await fetch(url, { headers: { ...headers, 'expo-runtime-version': '../private' } })).status, 400);
    assert.equal((await fetch(`${url}/assets/not-a-hash`)).status, 404);
    assert.equal((await fetch(url, { method: 'POST', headers })).status, 405);
    const bytes = Buffer.from('test asset');
    const hash = createHash('sha256').update(bytes).digest('hex');
    await mkdir(join(root, 'assets'), { recursive: true });
    await writeFile(join(root, 'assets', hash), bytes);
    await writeFile(join(root, 'assets', `${hash}.mime`), 'image/png');
    const assetResponse = await fetch(`${url}/assets/${hash}`);
    assert.equal(assetResponse.status, 200);
    assert.equal(assetResponse.headers.get('content-type'), 'image/png');
    assert.equal(await assetResponse.text(), bytes.toString());
    await writeFile(join(root, 'assets', hash), 'tampered');
    assert.equal((await fetch(`${url}/assets/${hash}`)).status, 503);
    await writeFile(join(release, 'manifest.json'), body + ' ');
    assert.equal((await fetch(url, { headers })).status, 503);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
