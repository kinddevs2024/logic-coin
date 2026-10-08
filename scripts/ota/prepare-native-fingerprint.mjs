import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
// masked-view's Android Gradle plugin removes this legacy package attribute
// during APK configuration. Reproduce that exact mutation before fingerprinting.
const path = resolve('node_modules/@react-native-masked-view/masked-view/android/src/main/AndroidManifest.xml');
const original = readFileSync(path, 'utf8');
writeFileSync(path, original.replaceAll('package="org.reactnative.maskedview"', ''));
