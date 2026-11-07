import { HangmanGame } from '@/games/hangman/game';
import { Redirect } from 'expo-router';
export default function PreviewGames() {
  return process.env.EXPO_PUBLIC_LOCAL_GAMES_PREVIEW === '1'
    ? <HangmanGame preview />
    : <Redirect href="/play/hangman?mode=practice" />;
}
