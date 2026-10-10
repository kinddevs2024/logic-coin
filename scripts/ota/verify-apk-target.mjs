import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { X509Certificate } from 'node:crypto';
import { verifyNativeEvidence } from './compatibility-evidence.mjs';

const [apk, baselineSha, output, referenceFile] = process.argv.slice(2);
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
let evidence = { method: 'exact-reproduced-fingerprint', runtimeVersion: runtime };
if (resolved.runtimeVersion !== runtime) {
  if (!referenceFile || !/^\d+$/.test(process.env.BASELINE_RUN ?? '')) throw Error('Exact runtime mismatch; independent APK source evidence required');
  const reference = JSON.parse(readFileSync(referenceFile, 'utf8'));
  if (reference.baselineSha !== baselineSha) throw Error('Reference checkout is not the APK source commit');
  const run = JSON.parse(execFileSync('gh', ['api', `repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.BASELINE_RUN}`], { encoding: 'utf8' }));
  if (run.head_sha !== baselineSha || run.conclusion !== 'success' || run.head_branch !== 'codex/game-updates-preview') throw Error('Untrusted APK build attestation');
  const log = execFileSync('gh', ['run', 'view', process.env.BASELINE_RUN, '--log'], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  const built = log.split('\n').filter(line => line.includes('{"sources":')).map(line => JSON.parse(line.slice(line.indexOf('{"sources":')))).find(value => value.hash === runtime);
  if (!built) throw Error('Successful APK build did not attest its embedded fingerprint');
  evidence = verifyNativeEvidence(runtime, resolved, reference, built);
}
mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, 'runtime.json'), JSON.stringify({ runtimeVersion: runtime, channel: 'preview', platform: 'android', baselineSha }));
writeFileSync(resolve(output, 'compatibility-evidence.json'), JSON.stringify(evidence));
console.log('Native inputs, certificate and exact APK runtime compatibility verified.');
