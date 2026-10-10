import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const output = process.argv[2];
if (!output) throw Error('Reference output required');
const resolved = JSON.parse(execFileSync(process.execPath, [resolve('node_modules/expo-updates/bin/cli.js'), 'runtimeversion:resolve', '--platform', 'android'], { cwd: 'frontend', encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
writeFileSync(output, JSON.stringify({ baselineSha: sha, runtimeVersion: resolved.runtimeVersion, fingerprintSources: resolved.fingerprintSources.map(({ type, filePath, hash, reasons }) => ({ type, filePath, hash, reasons })) }));
console.log('Independent baseline native fingerprint captured without secret contents.');
