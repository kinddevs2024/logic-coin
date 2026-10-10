// A build fingerprint can include transient Gradle-plugin files. This fallback
// requires independently reproduced native source equivalence, and the exact
// fingerprint emitted by the successful build of the inspected APK.
export function verifyNativeEvidence(runtime, current, reference, built) {
  if (built.hash !== runtime || current.runtimeVersion !== reference.runtimeVersion) throw Error('APK build or independently reproduced native sources differ');
  const key = source => JSON.stringify([source.type, source.filePath, source.reasons]);
  const profile = value => new Map(value.map(source => [key(source), source.hash]));
  const currentSources = profile(current.fingerprintSources);
  const referenceSources = profile(reference.fingerprintSources);
  const buildSources = profile(built.sources);
  if (currentSources.size !== referenceSources.size || currentSources.size !== buildSources.size) throw Error('Native source set differs');
  const differences = [];
  for (const [id, hash] of currentSources) {
    if (!referenceSources.has(id) || referenceSources.get(id) !== hash || !buildSources.has(id)) throw Error('Independent native source verification failed');
    if (buildSources.get(id) !== hash) differences.push(id);
  }
  const plugin = JSON.stringify(['dir', '../node_modules/expo-updates/expo-updates-gradle-plugin', ['expoAutolinkingAndroid']]);
  if (differences.length !== 1 || differences[0] !== plugin) throw Error('APK build differs outside the verified Expo Updates build plugin');
  return { method: 'independent-native-source-and-build-attestation', runtimeVersion: runtime, reproducedNativeFingerprint: current.runtimeVersion, differingBuildDirectory: '../node_modules/expo-updates/expo-updates-gradle-plugin' };
}
