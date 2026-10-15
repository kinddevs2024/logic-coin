import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { X509Certificate } from 'node:crypto';

const [apk, baselineSha, output] = process.argv.slice(2);
if (!apk || !/^[a-f0-9]{40}$/.test(baselineSha ?? '') || !output) throw new Error('APK, baseline commit and output directory required');
execFileSync('git', ['merge-base', '--is-ancestor', baselineSha, 'HEAD']);
// Every native/config/dependency input must be unchanged from the actual APK.
execFileSync('git', ['diff', '--exit-code', baselineSha, '--', 'package.json', 'package-lock.json', '.npmrc', 'frontend/package.json', 'frontend/app.json', 'frontend/app.config.ts', 'frontend/certs', 'frontend/plugins', 'frontend/android', 'frontend/ios']);
const runtime = execFileSync('unzip', ['-p', apk, 'assets/fingerprint'], { encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40,64}$/.test(runtime)) throw new Error('APK has no valid embedded fingerprint runtime');
// expo-root.pem is Expo's general trust certificate, not the app's signing key.
// expo-updates reads its code-signing certificate from AndroidManifest metadata.
const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
if (!sdk) throw new Error('Android SDK is required to inspect the APK update configuration');
const tools = readdirSync(resolve(sdk, 'build-tools')).sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).map(version => resolve(sdk, 'build-tools', version, 'aapt2')).find(existsSync);
if (!tools) throw new Error('aapt2 is unavailable');
const xml = execFileSync(tools, ['dump', 'xmltree', '--file', 'AndroidManifest.xml', apk], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
if (!xml.includes('https://logic-coin.online/updates') || !/expo-channel-name[^\n]*preview/.test(xml)) throw new Error('APK does not target the preview update service');
const signingMetadata = xml.slice(xml.indexOf('expo.modules.updates.CODE_SIGNING_CERTIFICATE'));
const pem = signingMetadata.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/)?.[0];
if (!pem) throw new Error('APK update signing certificate missing');
const embedded = new X509Certificate(pem.split(/\r?\n/).map(line => line.trim()).join('\n'));
const configured = new X509Certificate(readFileSync('frontend/certs/update-certificate.pem'));
if (!embedded.raw.equals(configured.raw)) throw new Error('Update certificate differs from the APK');
const resolved = JSON.parse(execFileSync(process.execPath, [resolve('node_modules/expo-updates/bin/cli.js'), 'runtimeversion:resolve', '--platform', 'android'], { cwd: 'frontend', encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
if (resolved.runtimeVersion !== runtime) {
  console.error(JSON.stringify({ apkRuntime: runtime, resolvedRuntime: resolved.runtimeVersion, workflow: resolved.workflow, sources: resolved.fingerprintSources?.map(source => ({ type: source.type, filePath: source.filePath, hash: source.hash, reasons: source.reasons })) }));
  throw new Error('Resolved runtime does not match the installed APK; do not publish');
}
mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, 'runtime.json'), JSON.stringify({ runtimeVersion: runtime, channel: 'preview', platform: 'android', baselineSha }));
console.log('Native inputs, certificate and exact APK runtime compatibility verified.');
