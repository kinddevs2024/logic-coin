import * as Application from 'expo-application';
import { Platform } from 'react-native';

export function supportsHangman(platform: string, nativeBuildVersion: string | null) {
  return platform === 'android' && Number(nativeBuildVersion) >= 12;
}

// Read the installed binary, not the OTA manifest's version. An update for
// older APKs must not unlock a feature intended for the next native release.
export function isGameVisible(gameKey: string) {
  return gameKey !== 'hangman' || supportsHangman(Platform.OS, Application.nativeBuildVersion);
}
