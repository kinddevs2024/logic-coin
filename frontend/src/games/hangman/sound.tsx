import { useCompatibleAudioPlayer } from './audio-player';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

export function useHangmanSound(paused: boolean) {
  const correct = useCompatibleAudioPlayer(require('../../../assets/hangman/correct.wav'));
  const wrong = useCompatibleAudioPlayer(require('../../../assets/hangman/wrong.wav'));
  const win = useCompatibleAudioPlayer(require('../../../assets/hangman/win.wav'));
  const [volume, setVolume] = useState(0.6);
  useEffect(() => { let active = true; void AsyncStorage.getItem('hangman-volume-v1').then(raw => { if (active && raw !== null) setVolume(Math.max(0, Math.min(1, Number(raw) || 0))); }).catch(() => {}); return () => { active = false; }; }, []);
  useEffect(() => { for (const player of [correct, wrong, win]) { player.volume = volume; if (paused) player.pause(); } }, [correct, wrong, win, volume, paused]);
  const updateVolume = (value: number) => { const next = Math.max(0, Math.min(1, value)); setVolume(next); void AsyncStorage.setItem('hangman-volume-v1', String(next)).catch(() => {}); };
  const play = (kind: 'correct' | 'wrong' | 'win') => {
    if (paused || volume === 0) return;
    const player = kind === 'correct' ? correct : kind === 'wrong' ? wrong : win;
    void player.seekTo(0).then(() => player.play()).catch(() => {});
  };
  return { volume, updateVolume, play };
}
export function SoundControl({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15, marginTop: 135, marginLeft: -15 }}><Ionicons name={value === 0 ? 'volume-mute' : 'volume-high'} size={65} color="#208DFF" /><View accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }} accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={event => onChange(value + (event.nativeEvent.actionName === 'increment' ? 0.1 : -0.1))} onStartShouldSetResponder={() => true} onResponderGrant={event => onChange(event.nativeEvent.locationX / 305)} onResponderMove={event => onChange(event.nativeEvent.locationX / 305)} style={{ width: 305, height: 60, justifyContent: 'center' }}><View pointerEvents="none" style={{ height: 10, borderRadius: 10, backgroundColor: '#777', width: 305 }} /><View pointerEvents="none" style={{ position: 'absolute', left: 0, width: value * 305, height: 10, borderRadius: 10, backgroundColor: '#E847A0' }} /><View pointerEvents="none" style={{ position: 'absolute', left: Math.max(0, value * 305 - 18), width: 36, height: 48, borderRadius: 30, backgroundColor: '#281E1B', transform: [{ rotate: '-15deg' }] }} /></View></View>;
}
