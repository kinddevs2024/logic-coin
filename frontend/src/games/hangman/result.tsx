import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useAppStore } from '../../store/app-store';
import { AppodealBannerSlot } from '../../components/appodeal-banner';
import { Hand, ink, NotebookLayer, NotebookPaper, notebookPanel } from './notebook';

export const endCopy = {
  ru: { finish: 'Челлендж завершён!', practice: 'Игра завершена!', base: 'За три слова', fortune: 'Фортуна', total: 'Всего получено', saving: 'Сохраняем результат…', saved: 'Результат сохранён', retry: 'Повторить за рекламу', gifts: 'Подарки и повтор', next: 'Следующая игра', challenges: 'К челленджам', games: 'Все игры', wheel: 'Колесо фортуны', spin: 'Крутить колесо', claim: 'Реклама → забрать приз', later: 'К результату', extra: 'Бонус сверх награды за игру', unavailable: 'Реклама сейчас недоступна', noSync: 'Награда не синхронизирована. Попробуйте позже.' },
  en: { finish: 'Challenge complete!', practice: 'Game complete!', base: 'Three words', fortune: 'Fortune', total: 'Total earned', saving: 'Saving result…', saved: 'Result saved', retry: 'Watch an ad to retry', gifts: 'Gifts and replay', next: 'Next game', challenges: 'Back to challenges', games: 'All games', wheel: 'Fortune wheel', spin: 'Spin the wheel', claim: 'Watch ad → claim prize', later: 'Back to result', extra: 'Bonus on top of your game reward', unavailable: 'Ads are unavailable right now', noSync: 'Reward could not be synced. Try again later.' },
  uz: { finish: 'Sinov tugadi!', practice: 'O‘yin tugadi!', base: 'Uchta so‘z uchun', fortune: 'Omad', total: 'Jami olindi', saving: 'Natija saqlanmoqda…', saved: 'Natija saqlandi', retry: 'Reklama ko‘rib qayta o‘ynash', gifts: 'Sovg‘alar va takror', next: 'Keyingi o‘yin', challenges: 'Sinovlarga qaytish', games: 'Barcha o‘yinlar', wheel: 'Omad g‘ildiragi', spin: 'G‘ildirakni aylantirish', claim: 'Reklama → sovrinni olish', later: 'Natijaga qaytish', extra: 'O‘yin mukofotidan tashqari bonus', unavailable: 'Hozir reklama mavjud emas', noSync: 'Mukofot sinxronlanmadi. Keyinroq urinib ko‘ring.' },
};
export function NotebookAction({ label, icon, onPress, disabled = false }: { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ minHeight: 68, borderWidth: 3, borderColor: '#111', borderRadius: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 13, paddingHorizontal: 12, marginTop: 15, opacity: disabled ? 0.45 : pressed ? 0.65 : 1 })}><Ionicons name={icon} size={33} color="#FF9D1E" /><Hand style={{ fontSize: 28, textAlign: 'center', flexShrink: 1 }}>{label}</Hand></Pressable>;
}
type Result = { coins: number; fortuneCoins?: number; saving: boolean; message: string; firstReplayAvailable: boolean };
export function HangmanResult({ value, challengeMode, hasNextGame, adBusy, fortuneAvailable, onFortune, onReplay, onRetry, onGifts, onNext, onExit }: { value: Result; challengeMode: boolean; hasNextGame: boolean; adBusy: boolean; fortuneAvailable: boolean; onFortune: () => void; onReplay: () => void; onRetry: () => void; onGifts: () => void; onNext: () => void; onExit: () => void }) {
  const language = useAppStore(state => state.language) ?? 'ru';
  const c = endCopy[language];
  const fortune = value.fortuneCoins ?? 0;
  const base = Math.max(0, value.coins - fortune);
  const disabled = value.saving || adBusy;
  const status = value.saving ? c.saving : /не начислена|Синхронизацию/.test(value.message) ? c.noSync : /недоступ/.test(value.message) ? c.unavailable : c.saved;
  return <NotebookLayer onClose={onExit}><NotebookPaper style={[notebookPanel, { top: 150, padding: 30 }]}>
    <Hand style={{ fontSize: 45, textAlign: 'center', color: '#111' }}>{challengeMode ? c.finish : c.practice}</Hand>
    <Hand style={{ fontSize: 77, textAlign: 'center', marginTop: 8 }}>{value.saving ? '…' : value.coins}</Hand>
    <Hand style={{ fontSize: 25, textAlign: 'center', marginBottom: 15 }}>{c.total}</Hand>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Hand style={{ fontSize: 28 }}>{c.base}</Hand><Hand style={{ fontSize: 28 }}>{value.saving ? '…' : base} / 1000</Hand></View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Hand style={{ fontSize: 28 }}>{c.fortune}</Hand><Hand style={{ fontSize: 28 }}>+{fortune}</Hand></View>
    <View accessibilityLiveRegion="polite" style={{ minHeight: 50, marginTop: 15, alignItems: 'center', justifyContent: 'center' }}>{value.saving ? <ActivityIndicator color={ink} accessibilityLabel={c.saving} /> : <Hand style={{ fontSize: 23, textAlign: 'center' }}>{status}</Hand>}</View>
    {fortuneAvailable && <NotebookAction label={c.wheel} icon="gift-outline" onPress={onFortune} disabled={disabled} />}
    {challengeMode ? <>
      {value.firstReplayAvailable && <NotebookAction label={c.retry} icon="play-circle-outline" onPress={onReplay} disabled={disabled} />}
      <NotebookAction label={c.gifts} icon="gift-outline" onPress={onGifts} disabled={disabled} />
      <AppodealBannerSlot placement="challenge-result" />
      <NotebookAction label={hasNextGame ? c.next : c.challenges} icon="arrow-forward" onPress={onNext} disabled={disabled} />
    </> : <><NotebookAction label={c.retry} icon="refresh" onPress={onRetry} disabled={disabled} /><NotebookAction label={c.games} icon="home" onPress={onExit} disabled={disabled} /></>}
  </NotebookPaper></NotebookLayer>;
}
