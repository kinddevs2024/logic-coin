import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { Image, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Avatar } from "./avatar";
import { ChallengeEmptyState } from "./challenge-empty-state";
import { gameCoverFor } from "@/constants/game-covers";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { useAppStore } from "@/store/app-store";
import { formatMoney } from "@/lib/format";
import { getHomeActivity, type ActivityPlayer, type HomeActivityPeriod } from "@/lib/home-activity";
import type { HomeActivityBlocksProps } from "./home-activity-blocks";
import { homeActivityCss } from "./home-activity-styles";

const copy = {
  ru: { today: "Игры на сегодня", week: "Недельный актив", month: "Месячный актив", show: "Показать все", games: "игр", hide: "Свернуть игры", you: "Вы", loading: "Загружаем участников…", empty: "Пока нет участников", error: "Не удалось загрузить активность", retry: "Повторить", guest: "Войдите, чтобы видеть свою активность", outWeek: "Вне недельного актива", outMonth: "Вне месячного актива", close: "Понятно", days: "д", rules: "День засчитывается после завершения всех шести игр. В неделю можно пропустить 2 дня, в месяц — 4. Сегодняшний день считается пропуском только после его окончания. Неделя начинается в понедельник, месяц — 1-го числа. Время окончания совпадает с расписанием челленджа. Процент показывает долю полностью пройденных дней периода. Список показывает участников активности, а не результаты розыгрыша." },
  uz: { today: "Bugungi o‘yinlar", week: "Haftalik faollik", month: "Oylik faollik", show: "Barcha", games: "o‘yinni ko‘rsatish", hide: "O‘yinlarni yig‘ish", you: "Siz", loading: "Ishtirokchilar yuklanmoqda…", empty: "Hozircha ishtirokchilar yo‘q", error: "Faollik yuklanmadi", retry: "Qayta urinish", guest: "Faolligingizni ko‘rish uchun kiring", outWeek: "Haftalik faollikdan tashqarida", outMonth: "Oylik faollikdan tashqarida", close: "Tushunarli", days: "k", rules: "Kun hisoblanishi uchun barcha 6 o‘yinni yakunlang. Haftada 2 kun, oyda 4 kun qoldirish mumkin. Bugun faqat kun tugagach o‘tkazib yuborilgan hisoblanadi. Hafta dushanba, oy 1-sanadan boshlanadi. Tugash vaqti sinov jadvaliga mos. Foiz davrdagi to‘liq yakunlangan kunlarni ko‘rsatadi. Ro‘yxat faollik ishtirokchilarini ko‘rsatadi, qur’a natijalarini emas." },
  en: { today: "Today’s games", week: "Weekly activity", month: "Monthly activity", show: "Show all", games: "games", hide: "Collapse games", you: "You", loading: "Loading participants…", empty: "No participants yet", error: "Could not load activity", retry: "Retry", guest: "Sign in to see your activity", outWeek: "Outside weekly activity", outMonth: "Outside monthly activity", close: "Got it", days: "d", rules: "Complete all six games for a day to count. You may miss 2 days per week and 4 per month. Today only counts as missed after it ends. Weeks start Monday, months on the 1st, following the challenge schedule. Progress is the share of fully completed days in the period. The list shows activity participants, not draw results." },
};

const activityRules = {
  ru: {
    week: ["Завершайте все 6 игр дня — тогда день идёт в недельный актив.", "Можно пропустить 2 дня. После 3-го пропуска вы выходите из актива до следующей недели. Сегодняшний день считается пропущенным только после его окончания.", "Новая неделя начинается в понедельник по расписанию челленджа. Таймер показывает, сколько осталось.", "Процент — это пройденные дни из 7. Движущийся список показывает участников, а не победителей.", "Если вышли из недельного актива, проверьте месячный: в нём допускается 4 пропуска."],
    month: ["Завершайте все 6 игр дня — тогда день идёт в месячный актив.", "Можно пропустить 4 дня. После 5-го пропуска вы выходите до следующего месяца. Сегодняшний день считается пропущенным только после его окончания.", "Новый период начинается 1-го числа по расписанию челленджа. Таймер показывает, сколько осталось.", "Процент — доля пройденных дней месяца. Движущийся список показывает участников, а не победителей."]
  },
  uz: {
    week: ["Kunning barcha 6 o‘yinini yakunlang — kun haftalik faollikka qo‘shiladi.", "2 kunni qoldirish mumkin. 3-kun qoldirilgach, keyingi haftagacha faollikdan chiqasiz. Bugun faqat kun tugagach qoldirilgan hisoblanadi.", "Yangi hafta sinov jadvali bo‘yicha dushanba kuni boshlanadi. Taymer qolgan vaqtni ko‘rsatadi.", "Foiz — 7 kundan yakunlangan kunlar ulushi. Aylanayotgan ro‘yxatda g‘oliblar emas, ishtirokchilar ko‘rsatiladi.", "Haftalik faollikdan chiqsangiz, oylikni tekshiring: unda 4 kunni qoldirish mumkin."],
    month: ["Kunning barcha 6 o‘yinini yakunlang — kun oylik faollikka qo‘shiladi.", "4 kunni qoldirish mumkin. 5-kun qoldirilgach, keyingi oygacha faollikdan chiqasiz. Bugun faqat kun tugagach qoldirilgan hisoblanadi.", "Yangi davr sinov jadvali bo‘yicha oyning 1-kunida boshlanadi. Taymer qolgan vaqtni ko‘rsatadi.", "Foiz — oydagi yakunlangan kunlar ulushi. Aylanayotgan ro‘yxatda g‘oliblar emas, ishtirokchilar ko‘rsatiladi."]
  },
  en: {
    week: ["Finish all 6 daily games for the day to count toward weekly activity.", "You may miss 2 days. A third missed day takes you out until next week. Today only counts as missed after it ends.", "A new week starts Monday on the challenge schedule. The timer shows the time remaining.", "The percentage shows completed days out of 7. The moving list shows participants, not winners.", "If you leave weekly activity, check monthly activity: it allows 4 missed days."],
    month: ["Finish all 6 daily games for the day to count toward monthly activity.", "You may miss 4 days. A fifth missed day takes you out until next month. Today only counts as missed after it ends.", "A new period starts on the 1st following the challenge schedule. The timer shows the time remaining.", "The percentage shows completed days out of the month. The moving list shows participants, not winners."]
  }
};

function Icon({ name, size = 16 }: { name: React.ComponentProps<typeof Ionicons>["name"]; size?: number }) { return <Ionicons name={name} size={size} color="currentColor" />; }
function remaining(end: string | undefined, now: number, days: string) {
  if (!end || !Number.isFinite(Date.parse(end))) return "—";
  const seconds = Math.max(0, Math.ceil((Date.parse(end) - now) / 1000));
  const d = Math.floor(seconds / 86400);
  const time = [Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60].map(n => String(n).padStart(2, "0")).join(":");
  return `${d ? `${d}${days} ` : ""}${time}`;
}

export function HomeActivityBlocks({ today, pendingGameKey, challengesTarget }: HomeActivityBlocksProps) {
  const theme = useAppTheme();
  const { language } = useTranslation(); const c = copy[language];
  const router = useRouter(); const user = useAppStore(s => s.user);
  const selfCoins = useAppStore(s => s.coinBalance); const selfBalance = useAppStore(s => s.balanceUnits);
  const token = useAppStore(s => s.accessToken); const authMode = useAppStore(s => s.authMode);
  const authenticated = authMode === "authenticated" && !!token;
  const query = useQuery({ queryKey: ["home-activity", token, today?.dayKey, today?.completedCount], queryFn: () => getHomeActivity(token!), enabled: authenticated, staleTime: 60_000, refetchInterval: 60_000 });
  const [expanded, setExpanded] = useState(false); const [height, setHeight] = useState(178);
  const list = useRef<HTMLDivElement>(null); const dialog = useRef<HTMLDialogElement>(null);
  const weekHeading = useRef<HTMLDivElement>(null);
  const shownWeeks = useRef(new Set<string>());
  const [rules, setRules] = useState<"week" | "month">("week");
  const [now, setNow] = useState(Date.now); const [visible, setVisible] = useState(true);
  const id = useId();
  useEffect(() => {
    const tick = () => setNow(Date.now());
    let timer: ReturnType<typeof setInterval> | undefined;
    const visibility = () => { clearInterval(timer); setVisible(!document.hidden); if (!document.hidden) { tick(); timer = setInterval(tick, 1000); } };
    visibility(); document.addEventListener("visibilitychange", visibility);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  useEffect(() => { const el = list.current; if (!el) return; const observer = new ResizeObserver(() => setHeight(el.scrollHeight)); observer.observe(el); setHeight(el.scrollHeight); return () => observer.disconnect(); }, [today?.games.length]);
  const weekFrom = query.data?.week.from;
  const weekStorageKey = authenticated && user.id && weekFrom ? `lc-weekly-rules:${user.id}:${weekFrom}` : null;
  function showRules(kind: "week" | "month") {
    if (!dialog.current || dialog.current.open) return;
    setRules(kind);
    dialog.current.showModal();
    if (kind === "week" && weekStorageKey) {
      shownWeeks.current.add(weekStorageKey);
      try { localStorage.setItem(weekStorageKey, "seen"); } catch { /* Session fallback if storage is unavailable. */ }
    }
  }
  useEffect(() => {
    const heading = weekHeading.current;
    if (!heading || !weekStorageKey || !visible) return;
    const seen = () => {
      if (shownWeeks.current.has(weekStorageKey)) return true;
      try { return localStorage.getItem(weekStorageKey) === "seen"; } catch { return false; }
    };
    if (seen()) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      clearTimeout(timer);
      if (!entry?.isIntersecting || entry.intersectionRatio < .75) return;
      timer = setTimeout(() => {
        if (seen() || document.hidden || document.querySelector('dialog[open], [aria-modal="true"]')) return;
        showRules("week");
      }, 400);
    }, { threshold: .75, rootMargin: "-90px 0px -90px 0px" });
    observer.observe(heading);
    return () => { observer.disconnect(); clearTimeout(timer); };
  // The period start is supplied by the server, so account/timezone changes cannot share a reminder.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStorageKey, visible]);
  const serverOffset = query.data ? Date.parse(query.data.serverNow) - query.dataUpdatedAt : 0;
  const clockNow = now + serverOffset;
  const colors = { "--card": String(theme.surface), "--text": String(theme.text), "--muted": String(theme.textMuted), "--line": String(theme.border), "--primary": String(theme.primary), "--primary-ink": String(theme.onPrimary), "--soft": `color-mix(in srgb, ${String(theme.primary)} 10%, transparent)`, "--mint": theme.mode === "dark" ? "#b9ddcc" : "#347359", "--warning": theme.mode === "dark" ? "#f3d18f" : "#9e6812", "--water": String(theme.primary), color: String(theme.text) } as CSSProperties;
  const games = today?.games ?? []; const collapsible = games.length > 2;
  function playerRow(player: ActivityPlayer) {
    return <li className="raffle-player" key={player.id}><Avatar userId={player.id} name={player.name} avatarUrl={player.avatarUrl} size={43} /><div className="raffle-copy"><strong>{player.id === user.id ? `${c.you} · ${player.name}` : player.name}</strong><div className="raffle-stats"><span className="raffle-coins"><Icon name="diamond-outline" size={11} />{player.coins.toLocaleString(language)}</span><span className="raffle-money"><Icon name="wallet-outline" size={11} />{formatMoney(player.balanceUnits)}</span></div></div></li>;
  }
  function periodCard(kind: "week" | "month") {
    const period: HomeActivityPeriod | undefined = query.data?.[kind];
    // The daily challenge response updates immediately after completing the sixth game.
    const freshDone = kind === "week" ? today?.weeklyCompletedDays : today?.monthlyCompletedDays;
    const done = period ? Math.max(period.completedDays, query.data?.dayKey === today?.dayKey ? freshDone ?? 0 : 0) : undefined;
    const percent = period && done !== undefined ? Math.min(100, Math.round(done / period.totalDays * 100)) : null;
    const sample = period?.participants ?? [];
    const players = period?.eligible && user.id && !sample.some(player => player.id === user.id)
      ? [...sample, { id: user.id, name: user.name, avatarUrl: user.avatarUrl ?? null, coins: selfCoins, balanceUnits: selfBalance }] : sample;
    return <section className="card period-card" data-testid={`home-${kind}-card`} aria-labelledby={`${id}-${kind}`}>
      <div className="card-heading" ref={kind === "week" ? weekHeading : undefined}><div className="period-title"><h2 id={`${id}-${kind}`}>{c[kind]}</h2><button className="info-button" aria-label={c[kind]} onClick={() => showRules(kind)}><Icon name="information-circle-outline" /></button></div><div className="heading-clock"><Icon name="time-outline" /><strong>{remaining(period?.endsAt, clockNow, c.days)}</strong></div></div>
      <div className="raffle-stage"><div className="raffle-window">
        {players.length ? <div className={`raffle-track${players.length < 4 ? " short" : ""}`} style={{ animationDuration: `${players.length * 2.6}s` }}><ul className="raffle-group" aria-label={c[kind]}>{players.map(playerRow)}</ul>{players.length >= 4 ? <ul className="raffle-group" aria-hidden="true">{players.map(playerRow)}</ul> : null}</div> : <div className="activity-empty">{!authenticated ? c.guest : query.isError ? <>{c.error}<button onClick={() => void query.refetch()}>{c.retry}</button></> : query.isPending ? c.loading : c.empty}</div>}
      </div></div>
      <div className="self-profile" data-progress={percent ?? 0} style={{ "--fill": `${percent ?? 0}%` } as CSSProperties}>
        <div className="profile-water" aria-hidden="true">{[0, 1].map(n => <svg key={n} className="water-wave" viewBox="0 0 1200 24" preserveAspectRatio="none"><path d="M0 12 Q150 0 300 12 T600 12 T900 12 T1200 12 V24 H0Z" /></svg>)}</div>
        <div className="self-avatar"><Avatar userId={user.id} name={user.name} avatarUrl={user.avatarUrl} size={40} /></div><div className="self-copy">{c.you} · {user.name}<small>{period && !period.eligible ? kind === "week" ? c.outWeek : c.outMonth : ""}</small></div><strong className="self-score" role="progressbar" aria-label={c[kind]} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined}>{percent === null ? "—" : `${percent}%`}</strong>
      </div>
    </section>;
  }
  return <div className={`lc-home-activity${visible ? "" : " is-hidden"}`} style={colors} data-testid="home-activity-blocks"><style>{homeActivityCss}</style>
    <section className={`card games-card${expanded || !collapsible ? " expanded" : ""}`} data-testid="home-games-card">
      <div className="card-heading"><h2>{c.today}</h2><div className="heading-clock"><Icon name="time-outline" /><strong>{remaining(today?.endsAt ?? undefined, clockNow, c.days)}</strong></div></div>
      <div className="games-viewport" style={{ height: expanded || !collapsible ? height : 178 }}><div className="games-list" ref={list} id={`${id}-games`}>
        {games.map((game, i) => { const completed = game.state.status === "completed"; const hidden = collapsible && !expanded && i >= 2; return <View key={game.key} ref={i === 0 ? challengesTarget : undefined} collapsable={false}><div className="game-row" aria-hidden={hidden || undefined}>
          <Image source={gameCoverFor(game.key)} style={{ width: 46, height: 46, borderRadius: 23 }} /><strong className="game-title">{game.title}</strong>{completed ? <span className="game-reward"><Icon name="diamond-outline" size={14} />+{game.state.coinsAwarded}</span> : null}<button className="game-action" tabIndex={hidden ? -1 : 0} disabled={completed || pendingGameKey === game.key} aria-label={game.title} data-completed={completed} onClick={() => router.push({ pathname: "/play/[gameKey]", params: { gameKey: game.key, mode: "challenge" } } as never)}><Icon name={completed ? "checkmark" : "arrow-forward"} size={21} /></button>
        </div></View>; })}
        {!games.length ? <View ref={challengesTarget} collapsable={false}><ChallengeEmptyState compact /></View> : null}
      </div></div>
      {collapsible ? <button className="expand-button" aria-expanded={expanded} aria-controls={`${id}-games`} onClick={() => setExpanded(!expanded)}>{expanded ? c.hide : `${c.show} ${games.length} ${c.games}`}<Icon name={expanded ? "chevron-up" : "chevron-down"} /></button> : null}
    </section>
    {periodCard("week")}{periodCard("month")}
    <dialog ref={dialog} className="activity-dialog" aria-labelledby={`${id}-rules-title`} data-testid="activity-rules-dialog" onClick={e => { if (e.target === dialog.current) dialog.current.close(); }}><div><h2 id={`${id}-rules-title`}>{c[rules]}</h2><ul>{activityRules[language][rules].map(line => <li key={line}>{line}</li>)}</ul><button onClick={() => dialog.current?.close()}>{c.close}</button></div></dialog>
  </div>;
}
