import { readFileSync } from 'node:fs';
import { createHash, verify } from 'node:crypto';
const runtime = process.argv[2];
if (!/^[a-f0-9]{40,64}$/.test(runtime ?? '')) throw Error('Exact runtime required');
const base = 'https://logic-coin.online/updates';
const headers = { 'expo-platform': 'android', 'expo-runtime-version': runtime, 'expo-channel-name': 'preview', 'expo-protocol-version': '1' };
const response = await fetch(base, { headers, signal: AbortSignal.timeout(20000) });
if (response.status !== 200) throw Error('Manifest request failed: ' + response.status);
const body = Buffer.from(await response.arrayBuffer());
const signature = response.headers.get('expo-signature')?.match(/sig="([^"]+)"/)?.[1];
const cert = readFileSync('/srv/apps/logic-coin/shared/ota/keys/certificate.pem');
if (!signature || !verify('RSA-SHA256', body, cert, Buffer.from(signature, 'base64'))) throw Error('Invalid public signature');
const manifest = JSON.parse(body);
if (manifest.runtimeVersion !== runtime || manifest.metadata.channel !== 'preview' || manifest.metadata.platform !== 'android') throw Error('Wrong compatibility target');
const assets = [manifest.launchAsset, ...manifest.assets];
for (let start = 0; start < assets.length; start += 6) {
  await Promise.all(assets.slice(start, start + 6).map(async asset => {
    if (!asset.url.startsWith(base + '/assets/')) throw Error('Unexpected asset host');
    const result = await fetch(asset.url, { signal: AbortSignal.timeout(30000) });
    if (!result.ok || createHash('sha256').update(Buffer.from(await result.arrayBuffer())).digest('base64url') !== asset.hash) throw Error('Asset verification failed');
  }));
}
const unknown = await fetch(base, { headers: { ...headers, 'expo-runtime-version': 'unknown-compatibility-check' }, signal: AbortSignal.timeout(20000) });
if (unknown.status !== 204) throw Error('Unknown runtime not isolated');
console.log(JSON.stringify({ id: manifest.id, runtime, channel: 'preview', verifiedAssets: assets.length, signature: 'valid', unknownRuntime: 204 }));
