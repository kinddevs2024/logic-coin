import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsFocused } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import { Platform } from "react-native";

import { demoTodayGames } from "@/constants/games";
import { gameCoinReward } from "@/games/rewards";
import { useTranslation } from "@/hooks/use-translation";
import { bootstrapApi, challengesApi } from "@/lib/api";
import { liveCommand, subscribeToChallengeUpdates } from "@/lib/challenge-live-updates";
import { localDayKey } from "@/lib/date";
import { showVerifiedRewardedAd } from "@/lib/rewarded-ad-flow";
import { useAppStore } from "@/store/app-store";
import type { TodayChallenges } from "@/types";

function buildGuestToday(
  language: "ru" | "en" | "uz",
  results: Record<string, { score: number; coinsAwarded: number; doubled: boolean }>,
  gameDoubled: boolean,
  dayDoubled: boolean,
  coinBalance: number,
): TodayChallenges {
  const games = demoTodayGames(language).map((game) => {
    const result = results[game.key];
    return {
      ...game,
      state: {
        status: result ? ("completed" as const) : ("not_started" as const),
        score: result?.score ?? null,
        coinsAwarded: result?.coinsAwarded ?? 0,
        doubled: result?.doubled ?? false,
        completedAt: result ? new Date().toISOString() : null,
      },
    };
  });
  const completedCount = games.filter((entry) => entry.state.status === "completed").length;
  const totalCoinsToday = games.reduce((sum, entry) => sum + entry.state.coinsAwarded, 0);
  return {
    status: "published",
    available: true,
    dayKey: localDayKey(),
    nextChallengeAt: null,
    totalCount: games.length,
    completedCount,
    totalCoinsToday,
    games,
    coins: { balance: coinBalance, lifetimeEarned: coinBalance, referralEarned: 0 },
    doubling: {
      firstGameKey: games[0]?.key ?? null,
      gameDoubled,
      dayDoubled,
      dayEligible: games.length > 0 && completedCount === games.length,
    },
    prizes: null,
  };
}

export function useChallenges() {
  const focused = useIsFocused();
  const { language } = useTranslation();
  const hydrated = useAppStore((state) => state.hydrated);
  const authMode = useAppStore((state) => state.authMode);
  const accessToken = useAppStore((state) => state.accessToken);
  const coinBalance = useAppStore((state) => state.coinBalance);
  const results = useAppStore((state) => state.guestChallengeResults);
  const gameDoubled = useAppStore((state) => state.guestGameDoubleUsed);
  const dayDoubled = useAppStore((state) => state.guestDayDoubleUsed);
  const resetGuestChallengeDay = useAppStore((state) => state.resetGuestChallengeDay);
  const recordGuestChallenge = useAppStore((state) => state.recordGuestChallenge);
  const applyGuestChallengeDouble = useAppStore((state) => state.applyGuestChallengeDouble);
  const setCoinBalance = useAppStore((state) => state.setCoinBalance);
  const setTodayChallengeProgress = useAppStore((state) => state.setTodayChallengeProgress);
  const queryClient = useQueryClient();
  const authenticated = authMode === "authenticated" && Boolean(accessToken);
  const lastSyncedToday = useRef<{ completed: number; total: number; balance?: number } | null>(null);

  useEffect(() => {
    // Direct /play links mount before web storage hydration. Writing defaults
    // here would overwrite the saved account and other challenge progress.
    if (!hydrated) return;
    resetGuestChallengeDay(localDayKey());
  }, [hydrated, resetGuestChallengeDay]);

  const query = useQuery({
    queryKey: ["challenges", "today", accessToken],
    queryFn: async ({ signal }) => {
      const queryKey = ["challenges", "today", accessToken] as const;
      if (!queryClient.getQueryData<TodayChallenges>(queryKey)) {
        const bootstrap = await queryClient.ensureQueryData({
          queryKey: ["bootstrap", accessToken],
          queryFn: () => bootstrapApi.get(accessToken!),
          staleTime: Infinity,
        });
        if (bootstrap.todayChallenges) return bootstrap.todayChallenges;
      }
      return liveCommand<TodayChallenges>(accessToken!, "today");
    },
    enabled: authenticated,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });

  useEffect(() => {
    if (!authenticated || !accessToken) return;
    return subscribeToChallengeUpdates(accessToken, (state) => {
      if (state.today) queryClient.setQueryData(["challenges", "today", accessToken], state.today);
    });
  }, [accessToken, authenticated, queryClient]);

  const guestToday = useMemo(
    () => buildGuestToday(language, results, gameDoubled, dayDoubled, coinBalance),
    [coinBalance, dayDoubled, gameDoubled, language, results],
  );
  const today = authenticated ? query.data : guestToday;

  useEffect(() => {
    if (!hydrated || !today) return;
    const next = {
      completed: today.completedCount,
      total: today.totalCount,
      balance: authenticated ? today.coins.balance : undefined,
    };
    const previous = lastSyncedToday.current;
    // React Query can supply an equivalent `today` object after a mutation. Do
    // not dispatch the same Zustand updates again: on web that created a render
    // loop while a challenge game was mounting (React error #185).
    if (!previous || previous.completed !== next.completed || previous.total !== next.total) {
      setTodayChallengeProgress(next.completed, next.total);
    }
    if (authenticated && (!previous || previous.balance !== next.balance)) {
      setCoinBalance(next.balance ?? 0);
    }
    lastSyncedToday.current = next;
  }, [authenticated, hydrated, setCoinBalance, setTodayChallengeProgress, today]);

  const startMutation = useMutation({
    mutationFn: async (gameKey: string) => {
      if (authenticated && accessToken) return challengesApi.start(gameKey, accessToken);
      return {
        attemptId: `guest-${localDayKey()}-${gameKey}`,
        dayKey: localDayKey(),
        gameKey,
        status: "started",
        resumed: true,
      };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["challenges", "today", accessToken] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (input: { gameKey: string; score: number; durationMs?: number }) => {
      if (authenticated && accessToken) {
        return challengesApi.complete(
          input.gameKey,
          { score: input.score, durationMs: input.durationMs },
          accessToken,
        );
      }
      const coinsAwarded = gameCoinReward(input.score, false, input.gameKey);
      recordGuestChallenge(input.gameKey, input.score, coinsAwarded);
      return { attempt: { id: `guest-${input.gameKey}`, gameKey: input.gameKey, score: input.score, coinsAwarded, completedAt: new Date().toISOString() } };
    },
    onSuccess: (result) => {
      if (result.coins) setCoinBalance(result.coins.balance);
      void queryClient.invalidateQueries({ queryKey: ["challenges", "today", accessToken] });
    },
  });

  const doubleMutation = useMutation({
    mutationFn: async (scope: "game" | "day") => {
      const ad = await showVerifiedRewardedAd({
        placement: scope === "game" ? "challenge-first-game" : "challenge-day-complete",
        accessToken,
      });
      if (!ad.receipt.completed || !ad.verified) throw new Error("rewarded_ad_incomplete");
      if (authenticated && accessToken) {
        if (!ad.sessionId) throw new Error("rewarded_ad_not_verified");
        return challengesApi.double(scope, accessToken, {
          provider: "yandex",
          receiptId: ad.sessionId,
        });
      }
      const credited = applyGuestChallengeDouble(scope, guestToday.doubling?.firstGameKey ?? undefined);
      if (!credited) throw new Error("nothing_to_double");
      return { scope, credited, coins: undefined };
    },
    onSuccess: (result) => {
      if (result.coins) setCoinBalance(result.coins.balance);
      void queryClient.invalidateQueries({ queryKey: ["challenges", "today", accessToken] });
    },
  });

  return {
    hydrated,
    today,
    isLoading: authenticated && query.isLoading,
    isRefreshing: query.isFetching,
    refresh: query.refetch,
    start: startMutation.mutateAsync,
    startingGameKey: startMutation.isPending ? startMutation.variables : undefined,
    startedGameKey: startMutation.isSuccess ? startMutation.variables : undefined,
    startFailedGameKey: startMutation.isError ? startMutation.variables : undefined,
    startError: startMutation.error,
    complete: completeMutation.mutateAsync,
    double: doubleMutation.mutateAsync,
    doubling: doubleMutation.isPending,
    pendingGameKey: completeMutation.isPending ? completeMutation.variables?.gameKey : undefined,
    error: query.error ?? startMutation.error ?? completeMutation.error ?? doubleMutation.error,
  };
}
