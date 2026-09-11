import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ComponentType } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import MergeScreen from "@/app/games/2048";
import { GiftInventoryModal } from "@/components/gift-inventory-modal";
import { AppodealBannerSlot } from "@/components/appodeal-banner";
import { GAME_BY_KEY } from "@/constants/games";
import { gamesAById, type ArcadeGameAId, type ArcadeGameResult } from "@/games/arcade/a";
import { gamesBById, renderGameB, type ArcadeGameProps as ArcadeGameBProps, type ArcadeGameResult as ArcadeGameBResult, type GameBId } from "@/games/arcade/b";
import { cosmeticFor } from "@/games/cosmetics";
import { gameProgressFor, type GameId, type GameProgress, useGameProgressStore } from "@/games/progress-store";
import { gameCoinReward } from "@/games/rewards";
import { useChallenges } from "@/hooks/use-challenges";
import { adsApi, challengesApi } from "@/lib/api";
import { showVerifiedRewardedAd } from "@/lib/rewarded-ad-flow";
import { rewardedAds } from "@/lib/rewarded-ad";
import { useAppStore } from "@/store/app-store";
import type { GiftItem, GiftUseEffect } from "@/types";

type PlayMode = "practice" | "challenge";
type ResultView = {
  sessionId: string;
  score: number;
  coins: number;
  previous: number;
  best: number;
  won: boolean;
  saving: boolean;
  message: string;
  doubleScope: "game" | "day" | null;
  doubled: boolean;
  checkpointReward: boolean;
  firstReplayAvailable: boolean;
};
type HostedGameResult = { score: number; won: boolean; durationMs: number; label: string };

const GAME_A_ALIASES: Partial<Record<string, ArcadeGameAId>> = {
  "one-second": "one-second",
  "color-focus": "color-stroop",
  tsvet: "color-stroop",
  "color-stroop": "color-stroop",
  "reflex-hit": "strike",
  udar: "strike",
  strike: "strike",
  "space-find-number": "find-number",
  "find-number": "find-number",
  "brain-training": "brain-training",
  "find-letter": "find-letter",
  "volt-match": "volt-match",
};

const GAME_B_ALIASES: Partial<Record<string, GameBId>> = {
  "geography-quiz": "geo-master",
  "geo-master": "geo-master",
  fact: "pulse",
  "volt-numbers": "volt-numbers",
  "math-quiz": "math-quiz",
  "math-duel": "math-duel",
  shadow: "shadow-match",
  "shadow-match": "shadow-match",
};

const PROGRESS_KEY_ALIASES: Partial<Record<string, GameId>> = {
  "color-focus": "tsvet",
  "color-stroop": "tsvet",
  tsvet: "tsvet",
  "reflex-hit": "udar",
  strike: "udar",
  udar: "udar",
  "find-number": "space-find-number",
  "space-find-number": "space-find-number",
  "geo-master": "geography-quiz",
  "geography-quiz": "geography-quiz",
  "shadow-match": "shadow",
  shadow: "shadow",
};

const CLASSIC_GAMES: Partial<Record<GameId, ComponentType>> = {
  "2048": MergeScreen,
};

function firstParam(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }

function ArcadeBRenderer({ gameId, gameProps }: { gameId: GameBId; gameProps: ArcadeGameBProps }) {
  return renderGameB(gameId, gameProps);
}

export default function DynamicGameRoute() {
  const params = useLocalSearchParams<{ gameKey?: string | string[]; mode?: string | string[] }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gameKey = firstParam(params.gameKey) ?? "";
  const mode: PlayMode = firstParam(params.mode) === "challenge" ? "challenge" : "practice";
  const arcadeAId = GAME_A_ALIASES[gameKey];
  const arcadeA = arcadeAId ? gamesAById[arcadeAId] : undefined;
  const ArcadeAComponent = arcadeA?.component;
  const arcadeBId = GAME_B_ALIASES[gameKey];
  const arcadeB = arcadeBId ? gamesBById[arcadeBId] : undefined;
  const classic = CLASSIC_GAMES[gameKey as GameId];
  const supportsTimeExtension = Boolean(ArcadeAComponent || arcadeBId);
  const progressId = PROGRESS_KEY_ALIASES[gameKey] ?? (gameKey as GameId);
  const progress = useGameProgressStore((state) => gameKey ? gameProgressFor(state.games, progressId) : null);
  const hydrated = useGameProgressStore((state) => state.hydrated);
  const recordScore = useGameProgressStore((state) => state.recordScore);
  const challenges = useChallenges();
  const startChallenge = challenges.start;
  const accessToken = useAppStore((state) => state.accessToken);
  const authenticated = useAppStore((state) => state.authMode === "authenticated" && Boolean(state.accessToken));
  const setCoinBalance = useAppStore((state) => state.setCoinBalance);
  const [result, setResult] = useState<ResultView | null>(null);
  const [giftOpen, setGiftOpen] = useState(false);
  const [extraTimeSeconds, setExtraTimeSeconds] = useState(0);
  const [sessionRevision, setSessionRevision] = useState(0);
  const [giftNotice, setGiftNotice] = useState("");
  const [doubling, setDoubling] = useState(false);
  const [adBusy, setAdBusy] = useState(false);
  const completionGuard = useRef(false);
  const challengeStartGuard = useRef("");
  const sessionStartedAt = useRef(0);
  const classicBaseline = useRef<{ key: string; progress: Readonly<GameProgress> } | null>(null);
  const sessionId = `${gameKey}:${sessionRevision}`;
  const activeResult = result?.sessionId === sessionId ? result : null;
  const gameTitle = GAME_BY_KEY[gameKey]?.title ?? arcadeA?.title ?? arcadeB?.title ?? "Игра";
  const accent = GAME_BY_KEY[gameKey]?.color ?? arcadeA?.accent ?? arcadeB?.accent ?? "#7C5CFF";
  const selectedSkin = cosmeticFor(progressId, progress?.selectedCosmetic ?? "classic");
  const challengeGames = challenges.today?.games ?? [];
  const currentChallengeGame = challengeGames.find((entry) => entry.key === gameKey);
  const currentChallengeIndex = challengeGames.findIndex((entry) => entry.key === gameKey);
  const nextChallengeGame = currentChallengeIndex >= 0
    ? [
        ...challengeGames.slice(currentChallengeIndex + 1),
        ...challengeGames.slice(0, currentChallengeIndex),
      ].find((entry) => entry.state.status !== "completed") ?? null
    : challengeGames.find((entry) => entry.key !== gameKey && entry.state.status !== "completed") ?? null;

  useEffect(() => {
    completionGuard.current = false;
    sessionStartedAt.current = Date.now();
  }, [gameKey, sessionRevision]);

  useEffect(() => {
    if (mode !== "challenge" || !authenticated || !gameKey) return;
    if (challengeStartGuard.current === gameKey) return;
    challengeStartGuard.current = gameKey;
    void startChallenge(gameKey).catch(() => undefined);
  }, [authenticated, gameKey, mode, startChallenge]);

  const processResult = useCallback(async (
    gameResult: HostedGameResult,
    options: { persist: boolean; before?: Readonly<GameProgress> } = { persist: true },
  ) => {
    if (completionGuard.current) return;
    completionGuard.current = true;
    const before = options.before ?? gameProgressFor(useGameProgressStore.getState().games, progressId);
    if (options.persist) recordScore(progressId, gameResult.score, gameResult.label, gameResult.won);
    const previewCoins = gameCoinReward(gameResult.score);
    const challengeEntry = challenges.today?.games.find((entry) => entry.key === gameKey);
    const isNewChallenge = challengeEntry?.state.status !== "completed";
    const completedAfterThisGame =
      (challenges.today?.completedCount ?? 0) + (isNewChallenge ? 1 : 0);
    const completesDay =
      (challenges.today?.totalCount ?? 0) > 0 &&
      completedAfterThisGame === challenges.today?.totalCount &&
      !challenges.today?.doubling?.dayDoubled;
    const completesFirstSlot =
      gameKey === challenges.today?.doubling?.firstGameKey &&
      !challenges.today?.doubling?.gameDoubled;
    const doubleScope: ResultView["doubleScope"] = mode === "challenge" && isNewChallenge
      ? completesDay ? "day" : completesFirstSlot ? "game" : null
      : null;

    const syncsPractice = mode === "practice" && authenticated && Boolean(accessToken);
    setResult({ sessionId, score: gameResult.score, coins: mode === "practice" ? previewCoins : 0, previous: before.previousScore, best: Math.max(before.bestScore, gameResult.score), won: gameResult.won, saving: mode === "challenge" || syncsPractice, message: mode === "challenge" ? "Сохраняем результат" : syncsPractice ? "Начисляем награду" : "Прогресс сохранён", doubleScope, doubled: false, checkpointReward: mode === "challenge" && isNewChallenge && completedAfterThisGame === 3, firstReplayAvailable: mode === "challenge" && isNewChallenge && currentChallengeIndex === 0 });

    setExtraTimeSeconds(0);
    if (mode === "practice") {
      if (!authenticated || !accessToken) return;
      try {
        const completed = await challengesApi.completePractice(gameKey, { score: gameResult.score, durationMs: gameResult.durationMs }, accessToken);
        if (completed.coins) setCoinBalance(completed.coins.balance);
        setResult((current) => current?.sessionId === sessionId ? { ...current, coins: completed.attempt.coinsAwarded, saving: false, message: "Награда начислена" } : current);
      } catch {
        setResult((current) => current?.sessionId === sessionId ? { ...current, saving: false, message: "Результат сохранён на устройстве. Награда аккаунта не начислена." } : current);
      }
      return;
    }
    try {
      const completed = await challenges.complete({ gameKey, score: gameResult.score, durationMs: gameResult.durationMs });
      setResult((current) => current?.sessionId === sessionId ? { ...current, coins: completed.attempt.coinsAwarded, saving: false, message: "Челлендж завершён" } : current);
    } catch {
      completionGuard.current = false;
      setResult((current) => current?.sessionId === sessionId ? { ...current, saving: false, message: "Результат сохранён локально. Синхронизацию можно повторить." } : current);
    }
  }, [accessToken, authenticated, challenges, currentChallengeIndex, gameKey, mode, progressId, recordScore, sessionId, setCoinBalance]);

  const onArcadeComplete = useCallback((gameResult: ArcadeGameResult) => {
    void processResult({ score: gameResult.score, won: gameResult.won, durationMs: gameResult.durationMs, label: String(gameResult.stats.label ?? gameResult.gameId) }, { persist: true });
  }, [processResult]);

  const onArcadeBComplete = useCallback((gameResult: ArcadeGameBResult) => {
    void processResult({ score: gameResult.score, won: gameResult.won, durationMs: gameResult.durationMs, label: gameResult.gameId }, { persist: true });
  }, [processResult]);

  useEffect(() => {
    if (!classic || !hydrated || !progress) return;
    if (!classicBaseline.current || classicBaseline.current.key !== `${gameKey}:${sessionRevision}`) {
      classicBaseline.current = { key: `${gameKey}:${sessionRevision}`, progress };
      return;
    }
    const baseline = classicBaseline.current.progress;
    if (progress.plays > baseline.plays && !completionGuard.current) {
      classicBaseline.current = { key: `${gameKey}:${sessionRevision}`, progress };
      const won = progress.wins > baseline.wins;
      void processResult({ score: progress.previousScore, won, durationMs: Date.now() - sessionStartedAt.current, label: progress.lastResult || gameKey }, { persist: false, before: baseline });
      return;
    }
    classicBaseline.current = { key: `${gameKey}:${sessionRevision}`, progress };
  }, [classic, gameKey, hydrated, processResult, progress, sessionRevision]);

  const retry = () => {
    completionGuard.current = false;
    setResult(null);
    setGiftNotice("");
    setSessionRevision((value) => value + 1);
  };

  const continueChallenge = async () => {
    setResult(null);
    if (currentChallengeIndex === 1 || currentChallengeIndex === 3) {
      await rewardedAds.showInterstitial("challenge-checkpoint").catch(() => false);
    }
    if (nextChallengeGame) {
      router.replace({ pathname: "/play/[gameKey]", params: { gameKey: nextChallengeGame.key, mode: "challenge" } } as never);
      return;
    }
    router.replace("/challenges" as never);
  };

  const applyGift = (gift: GiftItem, effect: GiftUseEffect) => {
    setGiftOpen(false);
    if (effect.kind === "time_extension") {
      setExtraTimeSeconds((value) => value + effect.additionalTimeSeconds);
      setGiftNotice(`+${effect.additionalTimeSeconds} секунд добавлено`);
      return;
    }
    if (effect.kind === "coin") {
      setCoinBalance(useAppStore.getState().coinBalance + effect.coinsCredited);
      setGiftNotice(`+${effect.coinsCredited} coin на балансе`);
      return;
    }
    completionGuard.current = false;
    setExtraTimeSeconds(0);
    setResult(null);
    setGiftNotice(`Повтор ×${effect.replayCount} активирован`);
    setSessionRevision((value) => value + 1);
  };

  const doubleReward = async () => {
    if (!activeResult?.doubleScope || activeResult.doubled || activeResult.saving || doubling) return;
    setDoubling(true);
    try {
      const doubled = await challenges.double(activeResult.doubleScope);
      setResult((current) => current ? { ...current, coins: Math.min(1_000, current.coins + doubled.credited), doubled: true, doubleScope: null, message: `Награда увеличена на ${doubled.credited} coin` } : current);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch {
      setResult((current) => current ? { ...current, message: "Удвоение сейчас недоступно" } : current);
    } finally {
      setDoubling(false);
    }
  };

  const claimCheckpointReward = async () => {
    if (!activeResult?.checkpointReward || adBusy) return;
    setAdBusy(true);
    try {
      const reward = await showVerifiedRewardedAd({
        placement: "challenge-third-game",
        accessToken,
        claimCoins: true,
      });
      if (!reward.receipt.completed || !reward.verified) throw new Error("rewarded_ad_incomplete");
      if (reward.coinBalance !== undefined) setCoinBalance(reward.coinBalance);
      setResult((current) => current ? {
        ...current,
        checkpointReward: false,
        message: reward.credited > 0 ? `+${reward.credited} coin за видео` : "Реклама просмотрена",
      } : current);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch {
      setResult((current) => current ? { ...current, message: "Реклама сейчас недоступна" } : current);
    } finally {
      setAdBusy(false);
    }
  };

  const replayWithAd = async () => {
    if (!activeResult?.firstReplayAvailable || adBusy) return;
    setAdBusy(true);
    try {
      const reward = await showVerifiedRewardedAd({
        placement: "challenge-first-replay",
        accessToken,
      });
      if (!reward.receipt.completed || !reward.verified) throw new Error("rewarded_ad_incomplete");
      if (authenticated && accessToken) {
        if (!reward.sessionId) throw new Error("rewarded_ad_not_verified");
        await adsApi.replay(reward.sessionId, gameKey, accessToken);
      }
      retry();
    } catch {
      setResult((current) => current ? { ...current, message: "Повтор за рекламу сейчас недоступен" } : current);
    } finally {
      setAdBusy(false);
    }
  };

  const retryPracticeWithAd = async () => {
    if (adBusy) return;
    setAdBusy(true);
    try {
      const reward = await showVerifiedRewardedAd({ placement: "practice-replay", accessToken });
      if (!reward.receipt.completed) throw new Error("rewarded_ad_incomplete");
      retry();
    } catch {
      setResult((current) => current ? { ...current, message: "Реклама сейчас недоступна" } : current);
    } finally {
      setAdBusy(false);
    }
  };

  let renderedGame = null;
  if (ArcadeAComponent) {
    renderedGame = <ArcadeAComponent key={sessionId} initialBestScore={progress?.bestScore ?? 0} extraTimeSeconds={extraTimeSeconds} challengeMode={mode === "challenge"} attemptLimit={currentChallengeGame?.attemptLimit} sessionKey={sessionId} paused={giftOpen} skin={selectedSkin} onExit={() => router.back()} onComplete={onArcadeComplete} />;
  } else if (arcadeBId) {
    renderedGame = (
      <View key={sessionId} style={styles.embeddedGame}>
        <ArcadeBRenderer gameId={arcadeBId} gameProps={{ initialBest: progress?.bestScore ?? 0, initialCoins: progress?.coins ?? 0, extraTimeSeconds, paused: giftOpen, skin: selectedSkin, onExit: () => router.back(), onFinish: onArcadeBComplete }} />
      </View>
    );
  } else if (classic) {
    const Classic = classic;
    renderedGame = <Classic key={sessionId} />;
  }

  const challengeStartSettled = mode !== "challenge" || !authenticated || challenges.startedGameKey === gameKey || challenges.startFailedGameKey === gameKey;
  const giftsAvailable = mode === "challenge" && (
    !authenticated || challenges.startedGameKey === gameKey
  );

  if (!challengeStartSettled) {
    return <LinearGradient colors={["#14192E", "#070A14"]} style={styles.fallback}><ActivityIndicator size="large" color={accent} /><Text style={styles.fallbackTitle}>Запускаем челлендж</Text><Text style={styles.fallbackText}>Подготавливаем игровую сессию</Text></LinearGradient>;
  }

  if (!renderedGame) {
    return <LinearGradient colors={["#14192E", "#070A14"]} style={styles.fallback}><Ionicons name="game-controller-outline" size={48} color="#8E7CFF" /><Text style={styles.fallbackTitle}>Игра не подключена</Text><Text style={styles.fallbackText}>{gameKey || "Неизвестный ключ"}</Text><Pressable onPress={() => router.back()} style={styles.fallbackButton}><Text style={styles.fallbackButtonText}>Назад</Text></Pressable></LinearGradient>;
  }

  return (
    <View style={styles.host}>
      {renderedGame}
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <View style={[styles.hostActions, { top: Math.max(insets.top + 8, 14) }]}>
          {mode === "challenge" ? <View style={styles.modePill}><View style={styles.liveDot} /><Text style={styles.modeText}>ЧЕЛЛЕНДЖ</Text></View> : null}
          {giftsAvailable ? <Pressable accessibilityRole="button" accessibilityLabel="Открыть подарки" onPress={() => setGiftOpen(true)} style={({ pressed }) => [styles.giftButton, pressed && styles.pressed]}><Ionicons name="gift" color="#FFFFFF" size={20} /></Pressable> : null}
        </View>
        {giftNotice ? <Animated.View entering={FadeInDown.springify()} style={[styles.notice, { top: Math.max(insets.top + 60, 68) }]}><Text style={styles.noticeText}>{giftNotice}</Text></Animated.View> : null}
      </View>
      <GameResultModal
        title={gameTitle}
        accent={accent}
        value={activeResult ? { ...activeResult, score: Math.min(1000, Math.max(0, activeResult.coins)), previous: Math.min(1000, Math.max(0, gameCoinReward(activeResult.previous))), best: Math.min(1000, Math.max(0, gameCoinReward(activeResult.best))) } : null}
        doubling={doubling}
        adBusy={adBusy}
        challengeMode={mode === "challenge"}
        nextLabel={nextChallengeGame ? "Следующая игра" : "К челленджам"}
        onDouble={() => void doubleReward()}
        onCheckpoint={() => void claimCheckpointReward()}
        onReplayAd={() => void replayWithAd()}
        onRetry={() => void retryPracticeWithAd()}
        onGifts={() => setGiftOpen(true)}
        onNext={() => void continueChallenge()}
        onExit={() => router.replace(mode === "challenge" ? "/challenges" as never : "/games" as never)}
      />
      <GiftInventoryModal visible={giftOpen && mode === "challenge"} sessionReady={giftsAvailable && !activeResult} completed={Boolean(activeResult && !activeResult.saving)} supportsTimeExtension={supportsTimeExtension} gameKey={gameKey} onClose={() => setGiftOpen(false)} onUse={applyGift} />
    </View>
  );
}

function GameResultModal({ title, accent, value, doubling, adBusy, challengeMode, nextLabel, onDouble, onCheckpoint, onReplayAd, onRetry, onGifts, onNext, onExit }: { title: string; accent: string; value: ResultView | null; doubling: boolean; adBusy: boolean; challengeMode: boolean; nextLabel: string; onDouble: () => void; onCheckpoint: () => void; onReplayAd: () => void; onRetry: () => void; onGifts: () => void; onNext: () => void; onExit: () => void }) {
  return (
    <Modal visible={Boolean(value)} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.resultBackdrop}>
        {value ? <Animated.View entering={FadeIn.duration(180)} style={styles.resultOuter}><BlurView tint="dark" intensity={74} style={styles.resultCard}><LinearGradient colors={[`${accent}32`, "rgba(255,255,255,0.02)"]} style={StyleSheet.absoluteFill} /><View style={[styles.resultBadge, { backgroundColor: accent }]}><Ionicons name={value.won ? "trophy" : "sparkles"} size={28} color="#0A0B12" /></View><Text style={styles.resultGame}>{title}</Text><Text style={styles.resultTitle}>{value.won ? "ОТЛИЧНАЯ ИГРА" : "РЕЗУЛЬТАТ ГОТОВ"}</Text><Text style={[styles.resultScore, { color: accent }]}>{value.score}</Text><Text style={styles.resultScoreLabel}>COIN</Text><View style={styles.resultStats}><ResultStat label="Предыдущий coin" value={value.previous} /><ResultStat label="Лучший coin" value={value.best} /><ResultStat label="Получено" value={`+${value.coins}`} suffix="coin" accent={accent} /></View><View style={styles.saveState}>{value.saving ? <ActivityIndicator size="small" color={accent} /> : <Ionicons name="checkmark-circle" size={17} color="#54D7A4" />}<Text style={styles.saveText}>{value.message}</Text></View>{value.doubleScope ? <Pressable disabled={doubling || value.saving} onPress={onDouble} style={({ pressed }) => [styles.doubleButton, { backgroundColor: accent }, pressed && styles.pressed, (value.saving || doubling) && styles.disabled]}>{doubling ? <ActivityIndicator color="#0A0B12" /> : <><Ionicons name="play-circle" color="#0A0B12" size={21} /><Text style={styles.doubleText}>{value.doubleScope === "day" ? "УДВОИТЬ НАГРАДУ ДНЯ" : "ПОЛУЧИТЬ ×2"}</Text></>}</Pressable> : null}{value.checkpointReward ? <Pressable disabled={adBusy || value.saving} onPress={onCheckpoint} style={({ pressed }) => [styles.doubleButton, { backgroundColor: accent }, pressed && styles.pressed, (adBusy || value.saving) && styles.disabled]}>{adBusy ? <ActivityIndicator color="#0A0B12" /> : <><Ionicons name="play-circle" color="#0A0B12" size={21} /><Text style={styles.doubleText}>ВИДЕО · +75 COIN</Text></>}</Pressable> : null}{challengeMode ? <>{value.firstReplayAvailable ? <Pressable disabled={adBusy || value.saving} onPress={onReplayAd} style={({ pressed }) => [styles.giftResultButton, pressed && styles.pressed, (adBusy || value.saving) && styles.disabled]}><Ionicons name="play-circle-outline" color="#FFFFFF" size={19} /><Text style={styles.secondaryText}>Повторить за рекламу</Text></Pressable> : null}<Pressable disabled={value.saving} onPress={onGifts} style={({ pressed }) => [styles.giftResultButton, pressed && styles.pressed, value.saving && styles.disabled]}><Ionicons name="gift-outline" color="#FFFFFF" size={19} /><Text style={styles.secondaryText}>Подарки и повтор</Text></Pressable><AppodealBannerSlot placement="challenge-result" /><Pressable disabled={value.saving} onPress={onNext} style={({ pressed }) => [styles.nextButton, { backgroundColor: accent }, pressed && styles.pressed, value.saving && styles.disabled]}><Text style={styles.nextText}>{nextLabel.toUpperCase()}</Text><Ionicons name="arrow-forward" color="#0A0B12" size={20} /></Pressable></> : <View style={styles.resultButtons}><Pressable disabled={adBusy} onPress={onRetry} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed, adBusy && styles.disabled]}>{adBusy ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name="play-circle-outline" color="#FFFFFF" size={18} /><Text style={styles.secondaryText}>Ещё раз за рекламу</Text></>}</Pressable><Pressable onPress={onExit} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}><Ionicons name="grid-outline" color="#FFFFFF" size={18} /><Text style={styles.secondaryText}>Все игры</Text></Pressable></View>}</BlurView></Animated.View> : null}
      </View>
    </Modal>
  );
}

function ResultStat({ label, value, suffix, accent }: { label: string; value: string | number; suffix?: string; accent?: string }) {
  return <View style={styles.resultStat}><Text style={styles.resultStatLabel}>{label}</Text><View style={styles.resultStatValueRow}><Text numberOfLines={1} style={[styles.resultStatValue, accent ? { color: accent } : null]}>{value}</Text>{suffix ? <Text style={[styles.resultSuffix, accent ? { color: accent } : null]}>{suffix}</Text> : null}</View></View>;
}

const styles = StyleSheet.create({
  host: { flex: 1, backgroundColor: "#05070F" },
  embeddedGame: { flex: 1 },
  hostActions: { position: "absolute", right: 14, left: 72, zIndex: 40, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 8 },
  modePill: { height: 38, paddingHorizontal: 12, borderRadius: 19, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "rgba(9,12,24,0.76)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#FF526A", shadowColor: "#FF526A", shadowOpacity: 0.8, shadowRadius: 7 },
  modeText: { color: "#FFFFFF", fontSize: 8, fontWeight: "900", letterSpacing: 1.4 },
  giftButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(9,12,24,0.82)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", shadowColor: "#000000", shadowOpacity: 0.28, shadowRadius: 12 },
  pressed: { transform: [{ scale: 0.95 }], opacity: 0.86 },
  disabled: { opacity: 0.55 },
  notice: { position: "absolute", alignSelf: "center", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, backgroundColor: "rgba(15,19,38,0.92)", borderWidth: 1, borderColor: "rgba(124,92,255,0.32)" },
  noticeText: { color: "#DDD8FF", fontSize: 11, fontWeight: "800" },
  fallback: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  fallbackTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "900" },
  fallbackText: { color: "rgba(255,255,255,0.42)", fontSize: 13 },
  fallbackButton: { marginTop: 12, minWidth: 180, padding: 15, borderRadius: 16, alignItems: "center", backgroundColor: "#8E7CFF" },
  fallbackButtonText: { color: "#080A12", fontSize: 13, fontWeight: "900" },
  resultBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 18, backgroundColor: "rgba(1,3,10,0.72)" },
  resultOuter: { width: "100%", maxWidth: 430 },
  resultCard: { overflow: "hidden", alignItems: "center", borderRadius: 32, padding: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", backgroundColor: "rgba(10,13,27,0.94)" },
  resultBadge: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 13, transform: [{ rotate: "-4deg" }] },
  resultGame: { color: "rgba(255,255,255,0.42)", fontSize: 10, fontWeight: "900", letterSpacing: 2.2, textTransform: "uppercase" },
  resultTitle: { color: "#FFFFFF", fontSize: 27, fontWeight: "900", letterSpacing: -0.6, textAlign: "center", marginTop: 4 },
  resultScore: { fontSize: 72, lineHeight: 78, fontWeight: "900", fontVariant: ["tabular-nums"], marginTop: 4 },
  resultScoreLabel: { color: "rgba(255,255,255,0.30)", fontSize: 8, fontWeight: "900", letterSpacing: 3, marginTop: -9 },
  resultStats: { width: "100%", flexDirection: "row", gap: 7, marginTop: 20 },
  resultStat: { flex: 1, minWidth: 0, alignItems: "center", paddingHorizontal: 5, paddingVertical: 11, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.055)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  resultStatLabel: { color: "rgba(255,255,255,0.34)", fontSize: 8, fontWeight: "900", textTransform: "uppercase" },
  resultStatValueRow: { flexDirection: "row", alignItems: "baseline", gap: 3, marginTop: 4 },
  resultStatValue: { color: "#FFFFFF", fontSize: 20, fontWeight: "900", fontVariant: ["tabular-nums"] },
  resultSuffix: { color: "#FFFFFF", fontSize: 8, fontWeight: "900" },
  saveState: { minHeight: 32, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 11 },
  saveText: { flexShrink: 1, color: "rgba(255,255,255,0.48)", fontSize: 10, fontWeight: "700", textAlign: "center" },
  doubleButton: { width: "100%", minHeight: 54, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 5 },
  doubleText: { color: "#0A0B12", fontSize: 12, fontWeight: "900", letterSpacing: 1.2 },
  nextButton: { width: "100%", minHeight: 54, borderRadius: 18, marginTop: 9, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  nextText: { color: "#0A0B12", fontSize: 12, fontWeight: "900", letterSpacing: 1.1 },
  resultButtons: { width: "100%", flexDirection: "row", gap: 8, marginTop: 9 },
  giftResultButton: { width: "100%", minHeight: 50, borderRadius: 17, marginTop: 7, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: "rgba(255,255,255,0.075)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
  secondaryButton: { flex: 1, minHeight: 50, borderRadius: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: "rgba(255,255,255,0.075)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
  secondaryText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
});
