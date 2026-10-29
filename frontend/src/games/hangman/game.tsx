import { Circle, FontContext, Hand, ink, NotebookPaper } from './notebook';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/app-store';
import { giftsApi } from '@/lib/api';
import { useGameSession } from '@/games/session-context';
import { TutorialMask } from './tutorial-mask';
import { SoundControl, useHangmanSound } from './sound';
import { copy, keyboards, words } from './content';
import { challengeCoins, guessLetter, letters, newRound, nextHint, roundStatus, wordCoins, type Round } from './logic';

const gallows = require('../../../assets/hangman/gallows-reference.png');
const figure = require('../../../assets/hangman/figure.png');
const victory = require('../../../assets/hangman/victory.png');
type Saved = { rounds: Round[]; batch: number; tutorialDone: boolean };
function FigurePart({ rect }: { rect: [number, number, number, number] }) {
  const [left, top, width, height] = rect;
  return <View pointerEvents="none" style={{ position: 'absolute', left: left + 60, top: top + 200, width, height, overflow: 'hidden' }}><Image source={figure} style={{ position: 'absolute', left: -left, top: -top, width: 400, height: 400 }} /></View>;
}
const parts: [number, number, number, number][] = [[155, 45, 90, 86], [192, 125, 16, 131], [125, 145, 67, 87], [208, 145, 65, 87], [150, 255, 49, 103], [199, 255, 55, 103]];

export function HangmanGame({ preview = false, challengeMode = false, hostPaused = false, onExit, onComplete }: { preview?: boolean; challengeMode?: boolean; hostPaused?: boolean; onExit?: () => void; onComplete?: (score: number, durationMs: number, won: boolean) => void }) {
  const language = useAppStore(state => state.language) ?? 'ru';
  const userId = useAppStore(state => state.user.id);
  const token = useAppStore(state => state.accessToken);
  const c = copy[language];
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useGameSession();
  const tutorialKey = `hangman-tutorial-v1:${userId || 'guest'}:${language}`;
  const key = `hangman-preview-v1:${userId || 'guest'}:${language}`;
  const starterKey = `hangman-starter-v1:${userId || 'guest'}`;
  const [starterHints, setStarterHints] = useState(0);
  const [challengeOffset] = useState(() => challengeMode ? Math.floor(Date.now() / 86400000) % words[language].length : 0);
  const activeDurationMs = useRef(0);
  const [fontsLoaded, fontError] = useFonts({ Notebook: require('../../../assets/hangman/Neucha.ttf'), NotebookLatin: require('../../../assets/hangman/ShadowsIntoLightTwo-Regular.ttf') });
  const [size, setSize] = useState({ width: 393, height: 830 });
  const [saved, setSaved] = useState<Saved | null>(null);
  const [tutorial, setTutorial] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const sound = useHangmanSound(paused || hostPaused);
  const [hintConfirm, setHintConfirm] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const savedRef = useRef(saved);
  const completionReported = useRef(false);
  useEffect(() => { savedRef.current = saved; }, [saved]);
  useEffect(() => {
    if (!onComplete || !saved || saved.rounds.length !== 3 || completionReported.current) return;
    if (roundStatus(saved.rounds[2]!) === 'playing') return;
    completionReported.current = true;
    onComplete(challengeCoins(saved.rounds), activeDurationMs.current, saved.rounds.some(round => roundStatus(round) === 'won'));
  }, [saved, onComplete]);
  useEffect(() => {
    if (paused || hostPaused || tutorial !== null) return;
    const timer = setInterval(() => { const current = savedRef.current; if (current && roundStatus(current.rounds[current.rounds.length - 1]!) === 'playing') activeDurationMs.current += 1000; }, 1000);
    return () => clearInterval(timer);
  }, [paused, hostPaused, tutorial]);
  const gifts = useQuery({ queryKey: ['gifts', token], queryFn: () => giftsApi.list(token!), enabled: Boolean(token), retry: 1, staleTime: 10_000 });
  const availableHints = (gifts.data ?? []).filter(gift => gift.kind === 'hint' && gift.status === 'available');
  const hintCount = preview ? starterHints : availableHints.length;
  useEffect(() => {
    let current = true;
    if (preview) {
      void AsyncStorage.getItem(starterKey).then(async raw => {
        const count = raw === null ? 3 : Math.max(0, Math.min(3, Number(raw) || 0));
        if (raw === null) await AsyncStorage.setItem(starterKey, '3');
        if (current) setStarterHints(count);
      }).catch(() => { if (current) setMessage(c.error); });
    } else if (challengeMode && token) {
      void giftsApi.starterHints(token).then(() => queryClient.invalidateQueries({ queryKey: ['gifts', token] })).catch(() => { if (current) setMessage(c.error); });
    }
    return () => { current = false; };
  }, [preview, challengeMode, token, starterKey, queryClient, c.error]);
  useEffect(() => {
    let current = true;
    void Promise.all([AsyncStorage.getItem(key), AsyncStorage.getItem(tutorialKey)]).then(([raw, tutorialSeen]) => {
      if (!current) return;
      let value: Saved | null = null;
      try { value = preview && raw ? JSON.parse(raw) as Saved : null; } catch { /* Start clean after damaged storage. */ }
      if (!value || !Array.isArray(value.rounds) || !value.rounds.length || value.rounds.length > 3 || !Number.isSafeInteger(value.batch) || value.rounds.some(round => !round.word?.word || !Array.isArray(round.guessed) || !Array.isArray(round.hinted) || !Number.isSafeInteger(round.mistakes))) value = { rounds: [newRound(words[language][challengeOffset]!)], batch: 0, tutorialDone: false };
      value.tutorialDone = value.tutorialDone || tutorialSeen === '1';
      setSaved(value); setTutorial(value.tutorialDone ? null : 0);
    }).catch(() => { if (current) { setSaved({ rounds: [newRound(words[language][challengeOffset]!)], batch: 0, tutorialDone: false }); setTutorial(0); } });
    return () => { current = false; };
  }, [key, tutorialKey, language, preview, challengeOffset]);
  const writeQueue = useRef(Promise.resolve());
  const commit = (value: Saved) => {
    savedRef.current = value; setSaved(value);
    if (preview) writeQueue.current = writeQueue.current.catch(() => {}).then(() => AsyncStorage.setItem(key, JSON.stringify(value)));
  };
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') { setPaused(true); setHintConfirm(false); } });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!hintConfirm) return;
    const timer = setTimeout(() => setHintConfirm(false), 5000);
    return () => clearTimeout(timer);
  }, [hintConfirm]);
  if (!saved || (!fontsLoaded && !fontError)) return <SafeAreaView style={s.safe}><ActivityIndicator accessibilityLabel={c.loading} color={ink} /></SafeAreaView>;
  const index = saved.rounds.length - 1;
  const round = saved.rounds[index]!;
  const status = roundStatus(round);
  const finished = index === 2 && status !== 'playing';
  const earned = challengeCoins(saved.rounds);
  const scale = Math.min(size.width / 565, size.height / 1190);
  const guess = (letter: string) => {
    const current = savedRef.current;
    if (!current || paused || hostPaused || busy || tutorial !== null) return;
    session?.onStart();
    const rounds = [...current.rounds]; rounds[index] = guessLetter(rounds[index]!, letter);
    if (rounds[index] !== current.rounds[index]) sound.play(roundStatus(rounds[index]!) === 'won' ? 'win' : letters(rounds[index]!.word.word).includes(letter) ? 'correct' : 'wrong');
    commit({ ...current, rounds }); setMessage(''); setHintConfirm(false);
  };
  const hint = async () => {
    if (lock.current || paused || hostPaused || tutorial !== null || status !== 'playing') return;
    if (!hintCount) { setMessage(gifts.isError && !preview ? c.error : c.noHints); if (gifts.isError) void gifts.refetch(); return; }
    if (!hintConfirm) { setHintConfirm(true); return; }
    const letter = nextHint(round);
    if (!letter || (!preview && !token)) return;
    lock.current = true; setBusy(true); setHintConfirm(false);
    session?.onStart();
    try {
      if (preview) {
        await AsyncStorage.setItem(starterKey, String(starterHints - 1));
        setStarterHints(value => value - 1);
      } else {
        const response = await giftsApi.use(availableHints[0]!.id, token!, 'hangman');
        if (response.effect.kind !== 'hint') throw new Error('Unexpected gift effect');
        queryClient.setQueryData(['gifts', token], (items: typeof gifts.data) => items?.map(item => item.id === response.gift.id ? response.gift : item));
      }
      const current = savedRef.current!; const rounds = [...current.rounds];
      rounds[index] = guessLetter(rounds[index]!, letter, true); commit({ ...current, rounds });
      setMessage('');
    } catch { setMessage(c.error); void gifts.refetch(); }
    finally { lock.current = false; setBusy(false); }
  };
  const next = () => {
    if (busy) return;
    const current = savedRef.current!;
    if (roundStatus(current.rounds[current.rounds.length - 1]!) === 'playing') return;
    if (finished && onComplete) { if (!completionReported.current) { completionReported.current = true; onComplete(earned, activeDurationMs.current, current.rounds.some(round => roundStatus(round) === 'won')); } return; }
    if (finished) { const batch = current.batch + 1; commit({ ...current, batch, rounds: [newRound(words[language][batch * 3 % words[language].length]!)] }); }
    else commit({ ...current, rounds: [...current.rounds, newRound(words[language][(challengeOffset + current.batch * 3 + current.rounds.length) % words[language].length]!)] });
    setMessage(''); setHintConfirm(false);
  };
  const restart = () => { if (!busy && !challengeMode) { commit({ ...saved, rounds: [newRound(words[language][saved.batch * 3 % words[language].length]!)] }); setPaused(false); setMessage(''); } };
  const home = () => { if (!busy) { if (onExit) onExit(); else if (router.canGoBack()) router.back(); else router.replace('/(tabs)/games' as never); } };
  const tutorialNext = () => { if (tutorial === c.tutorial.length - 1) { commit({ ...saved, tutorialDone: true }); void AsyncStorage.setItem(tutorialKey, '1'); setTutorial(null); } else setTutorial((tutorial ?? 0) + 1); };
  return <FontContext.Provider value={language === 'ru' ? 'Notebook' : 'NotebookLatin'}><SafeAreaView style={s.safe}><View style={s.viewport} onLayout={event => setSize(event.nativeEvent.layout)}>
    <View style={{ width: 565, height: 1190, position: 'absolute', left: (size.width - 565) / 2, top: (size.height - 1190) / 2, transform: [{ scale }] }}>
    <NotebookPaper style={StyleSheet.absoluteFill} />

      <View style={s.header}><View style={s.balance}><Ionicons name="ellipse" size={46} color="#F5BB18" /><Hand style={{ fontSize: 49 }}>{earned}</Hand><Hand style={{ fontSize: 26 }}>{c.coins}</Hand></View><Circle icon="pause" color="#24C970" label={c.pause} onPress={() => setPaused(true)} /></View>
      <Hand style={s.level}>{c.level} {index + 1} / 3</Hand>
      <Image source={gallows} resizeMode="stretch" style={s.gallows} />
      {status === 'won' ? <Image source={victory} style={s.victory} /> : <>
        {round.mistakes >= 1 && <Ionicons pointerEvents="none" name="remove-outline" size={60} color="#111" style={{ position: 'absolute', left: 230, top: 198, transform: [{ rotate: '90deg' }] }} />}
        {parts.slice(0, Math.max(0, round.mistakes - 1)).map((rect, i) => <FigurePart key={i} rect={rect} />)}
      </>}
      <View style={s.hint}><Hand style={{ fontSize: 32 }}>{busy ? '…' : `× ${hintCount}`}</Hand><Circle icon="bulb" color="#F5BC19" label={`${c.hint}: ${hintCount}`} onPress={() => void hint()} disabled={busy || status !== 'playing' || (!preview && gifts.isFetching)} /><Hand style={{ fontSize: 19, textAlign: 'center', width: 130 }}>{hintConfirm ? c.confirm : c.gifts}</Hand></View>
      <View style={[s.clue, { height: round.word.clue.length > 23 ? 84 : 60 }]}><Hand style={{ fontSize: round.word.clue.length > 23 ? 29 : 36, textAlign: 'center' }}>{round.word.clue}</Hand></View>
      <View style={s.word}>{Array.from(round.word.word).map((char, i) => {
        const isLetter = letters(char).length > 0; const visible = !isLetter || round.guessed.includes(char) || status === 'lost';
        return <View key={i} style={{ width: Math.min(50, 450 / round.word.word.length), alignItems: 'center' }}><Hand style={{ fontSize: Math.min(48, 450 / round.word.word.length), color: status === 'lost' && !round.guessed.includes(char) ? '#EF4660' : ink }}>{visible ? char : ' '}</Hand>{isLetter && !visible && <View style={s.underline} />}</View>;
      })}</View>
      {message ? <Hand style={s.message}>{message}</Hand> : null}
      <View style={s.keyboard}>{keyboards[language].map((row, r) => <View key={r} style={s.keyRow}>{Array.from(row).map(letter => {
        const used = round.guessed.includes(letter); const correct = letters(round.word.word).includes(letter);
        return <Pressable key={letter} accessibilityRole="button" accessibilityLabel={letter} accessibilityState={{ disabled: used || status !== 'playing' }} disabled={used || status !== 'playing' || busy || paused || hostPaused || tutorial !== null} onPress={() => guess(letter)} style={[s.key, { width: 550 / Math.max(10, row.length) }]}><Hand style={{ fontSize: language === 'ru' ? 43 : 51 }}>{letter}</Hand>{used && <Ionicons pointerEvents="none" name={correct ? 'ellipse-outline' : 'close'} size={correct ? 49 : 65} color={correct ? '#31CF88' : '#F64466'} style={s.mark} />}</Pressable>;
      })}</View>)}</View>
      {preview && <Hand style={s.preview}>{c.preview}</Hand>}
      {status !== 'playing' && !(finished && onComplete) && <View style={s.result}><NotebookPaper style={s.resultPaper}><Hand style={{ fontSize: 47, color: '#111', textAlign: 'center' }}>{finished ? c.finish : status === 'won' ? c.win : c.lose}</Hand><Hand style={{ fontSize: 30, textAlign: 'center' }}>{finished ? `${earned} / 1000 ${c.coins}` : `+${wordCoins(round, index)} ${c.coins}`}</Hand>{finished && <Hand style={{ fontSize: 24, textAlign: 'center' }}>{saved.rounds.map((item, i) => wordCoins(item, i)).join(' + ')}{earned > saved.rounds.reduce((sum, item, i) => sum + wordCoins(item, i), 0) ? ` → ${earned}` : ` = ${earned}`} </Hand>}<View style={{ flexDirection: 'row', justifyContent: 'center', gap: 45, marginTop: 22 }}>{finished && <Circle icon="home" color="#FF9D1E" label={c.home} onPress={home} />}<Circle icon={finished ? 'refresh' : 'arrow-forward'} color="#FF9D1E" label={finished ? c.restart : c.next} onPress={next} /></View></NotebookPaper></View>}
      {paused && <View style={s.backdrop}><NotebookPaper style={s.pausePaper}><View style={{ position: 'absolute', right: 6, top: 6 }}><Circle icon="close" color="#F54763" label={c.resume} onPress={() => setPaused(false)} /></View><Hand style={{ fontSize: 52, textAlign: 'center' }}>{c.pause}</Hand><SoundControl value={sound.volume} onChange={sound.updateVolume} label={c.sound} /><View style={{ flexDirection: 'row', justifyContent: 'center', gap: 55, marginTop: 135 }}><Circle icon="home" color="#FF9D1E" label={c.home} onPress={home} disabled={busy} /><Circle icon="refresh" color="#FF9D1E" label={c.restart} onPress={restart} disabled={busy || challengeMode} /></View><Pressable accessibilityRole="button" onPress={() => { commit({ ...saved, tutorialDone: false }); setTutorial(0); setPaused(false); }} style={{ marginTop: 50 }}><Hand style={{ textAlign: 'center', fontSize: 27 }}>{c.help}</Hand></Pressable></NotebookPaper></View>}
      {tutorial !== null && <Pressable accessibilityRole="button" accessibilityLabel={c.tap} onPress={tutorialNext} style={s.tutorial}><TutorialMask step={tutorial} /><Hand style={[s.tutorialText, { top: tutorial === 1 ? 815 : tutorial === 0 ? 805 : tutorial === 4 ? 145 : 645 }]}>{c.tutorial[tutorial]}</Hand><Hand style={s.continue}>{c.tap}</Hand></Pressable>}
    </View>
  </View></SafeAreaView></FontContext.Provider>;
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F7F3', justifyContent: 'center' }, viewport: { flex: 1, overflow: 'hidden' }, hand: { fontFamily: 'Notebook', color: ink },
  header: { position: 'absolute', top: 10, left: 22, right: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, balance: { flexDirection: 'row', alignItems: 'center', gap: 12 }, circle: { borderRadius: 100, borderWidth: 4, borderColor: '#101010', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAF580', transform: [{ rotate: '-3deg' }] },
  level: { position: 'absolute', top: 126, width: '100%', textAlign: 'center', fontSize: 44 }, gallows: { position: 'absolute', top: 123, left: -15, width: 450, height: 485 }, victory: { position: 'absolute', left: 55, top: 195, width: 400, height: 400 }, hint: { position: 'absolute', right: 18, top: 410, alignItems: 'center', gap: 6 },
  clue: { position: 'absolute', top: 624, left: 135, width: 300, height: 60, borderWidth: 4, borderColor: '#111', borderRadius: 3, justifyContent: 'center', padding: 4, transform: [{ rotate: '-1deg' }] }, word: { position: 'absolute', top: 718, left: 30, right: 30, height: 57, flexDirection: 'row', justifyContent: 'center', gap: 5 }, underline: { position: 'absolute', bottom: 0, width: '90%', height: 3, backgroundColor: '#141414', borderRadius: 2 },
  keyboard: { position: 'absolute', top: 934, width: 565, gap: 1 }, keyRow: { flexDirection: 'row', justifyContent: 'center' }, key: { height: 67, alignItems: 'center', justifyContent: 'center' }, mark: { position: 'absolute', top: 1, alignSelf: 'center' }, message: { position: 'absolute', top: 815, left: 35, right: 35, textAlign: 'center', fontSize: 26 }, preview: { position: 'absolute', bottom: 8, width: '100%', textAlign: 'center', fontSize: 17, color: '#61778A' },
  result: { position: 'absolute', left: 42, right: 42, top: 822, minHeight: 335, borderWidth: 3, borderColor: '#111', backgroundColor: '#FAFAF8', transform: [{ rotate: '-1deg' }] }, resultPaper: { padding: 20, minHeight: 330 }, backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#0005', justifyContent: 'center', paddingHorizontal: 32 }, pausePaper: { borderWidth: 4, borderColor: '#111', minHeight: 650, padding: 45, transform: [{ rotate: '-1deg' }] },
  tutorial: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'transparent' }, spotlight: { position: 'absolute', borderWidth: 2, borderColor: '#E6EAFB', backgroundColor: '#FFFFFF12' }, tutorialText: { position: 'absolute', left: 30, right: 30, color: '#FFF', textAlign: 'center', fontSize: 29 }, continue: { position: 'absolute', bottom: 35, width: '100%', textAlign: 'center', color: '#FFF', fontSize: 30 },
});
