import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { X509Certificate } from 'node:crypto';

const [apk, baselineSha, output] = process.argv.slice(2);
if (!apk || !/^[a-f0-9]{40}$/.test(baselineSha ?? '') || !output) throw new Error('APK, baseline commit and output directory required');
execFileSync('git', ['merge-base', '--is-ancestor', baselineSha, 'HEAD']);
// Every native/config/dependency input must be unchanged from the actual APK.
execFileSync('git', ['diff', '--exit-code', baselineSha, '--', 'package.json', 'package-lock.json', '.npmrc', 'frontend/package.json', 'frontend/app.json', 'frontend/app.config.ts', 'frontend/certs', 'frontend/plugins', 'frontend/android', 'frontend/ios']);
const runtime = execFileSync('unzip', ['-p', apk, 'assets/fingerprint'], { encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40,64}$/.test(runtime)) throw new Error('APK has no valid embedded fingerprint runtime');
const embedded = new X509Certificate(execFileSync('unzip', ['-p', apk, 'assets/expo-root.pem']));
const configured = new X509Certificate(readFileSync('frontend/certs/update-certificate.pem'));
if (!embedded.raw.equals(configured.raw)) throw new Error('Update certificate differs from the APK');
const resolved = JSON.parse(execFileSync(process.execPath, [resolve('node_modules/expo-updates/bin/cli.js'), 'runtimeversion:resolve', '--platform', 'android'], { cwd: 'frontend', encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
if (resolved.runtimeVersion !== runtime) throw new Error('Resolved runtime does not match the installed APK; do not publish');
mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, 'runtime.json'), JSON.stringify({ runtimeVersion: runtime, channel: 'preview', platform: 'android', baselineSha }));
console.log('Native inputs, certificate and exact APK runtime compatibility verified.');
