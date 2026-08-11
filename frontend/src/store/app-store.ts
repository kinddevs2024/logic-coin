import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import type {
  AuthMode,
  BootstrapPayload,
  Language,
  User,
} from "@/types";
import type { ThemeMode } from "@/constants/theme";

type AppState = {
  hydrated: boolean;
  language: Language | null;
  onboardingDone: boolean;
  authMode: AuthMode;
  accessToken: string | null;
  refreshToken: string | null;
  pendingRegistrationToken: string | null;
  user: User;
  balanceUnits: number;
  goalUnits: number;
  streak: number;
  activeDays: number;
  theme: ThemeMode;
  notificationsEnabled: boolean;
  notificationTime: string;
  taskCounts: Record<string, number>;
  rewardEventId: number;
  latestReward: { amount: number; id: number } | null;
  setHydrated: (hydrated: boolean) => void;
  setLanguage: (language: Language) => void;
  finishOnboarding: () => void;
  setPendingRegistrationToken: (token: string | null) => void;
  continueAsGuest: () => void;
  authenticate: (input: {
    user: User;
    accessToken: string;
    refreshToken?: string;
    balanceUnits?: number;
  }) => void;
  syncBootstrap: (payload: BootstrapPayload) => void;
  logout: () => void;
  addReward: (taskId: string, units: number) => void;
  addGameReward: (gameId: string, units: number) => void;
  setBalance: (units: number) => void;
  clearLatestReward: () => void;
  setGoal: (units: number) => void;
  setTheme: (theme: ThemeMode) => void;
  setNotifications: (enabled: boolean) => void;
  setNotificationTime: (time: string) => void;
  updateUser: (input: Partial<User>) => void;
};

const secureStorage: StateStorage = {
  getItem: async (name) => {
    if (Platform.OS === "web") {
      return AsyncStorage.getItem(name);
    }
    return SecureStore.getItemAsync(name);
  },
  setItem: async (name, value) => {
    if (Platform.OS === "web") {
      await AsyncStorage.setItem(name, value);
      return;
    }
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name) => {
    if (Platform.OS === "web") {
      await AsyncStorage.removeItem(name);
      return;
    }
    await SecureStore.deleteItemAsync(name);
  },
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      hydrated: false,
      language: null,
      onboardingDone: false,
      authMode: null,
      accessToken: null,
      refreshToken: null,
      pendingRegistrationToken: null,
      user: { name: "Alex" },
      balanceUnits: 640,
      goalUnits: 1000,
      streak: 8,
      activeDays: 34,
      theme: "light",
      notificationsEnabled: true,
      notificationTime: "19:00",
      taskCounts: {},
      rewardEventId: 0,
      latestReward: null,
      setHydrated: (hydrated) => set({ hydrated }),
      setLanguage: (language) => set({ language }),
      finishOnboarding: () => set({ onboardingDone: true }),
      setPendingRegistrationToken: (pendingRegistrationToken) =>
        set({ pendingRegistrationToken }),
      continueAsGuest: () =>
        set({
          authMode: "guest",
          user: { name: "Alex", referralCode: "LOGIC-7Q2M" },
        }),
      authenticate: ({ user, accessToken, refreshToken, balanceUnits }) =>
        set((state) => ({
          authMode: "authenticated",
          user,
          accessToken,
          refreshToken: refreshToken ?? null,
          pendingRegistrationToken: null,
          balanceUnits: balanceUnits ?? state.balanceUnits,
        })),
      syncBootstrap: (payload) =>
        set({
          user: payload.user,
          balanceUnits: payload.user.wallet.availableUnits,
          goalUnits: Math.max(
            100,
            Math.ceil(
              payload.user.preferences.savingsGoalCents /
                Math.max(1, payload.economy.unitValueCents),
            ),
          ),
          streak: payload.activity.streak.activeDays,
          activeDays: payload.activity.totalActiveDays,
          theme: payload.user.preferences.theme,
          language: payload.user.preferences.language,
          notificationsEnabled:
            payload.user.preferences.notificationsEnabled &&
            payload.user.preferences.dailyReminderEnabled,
        }),
      logout: () =>
        set({
          authMode: null,
          accessToken: null,
          refreshToken: null,
          pendingRegistrationToken: null,
          user: { name: "Alex" },
          balanceUnits: 640,
          goalUnits: 1000,
          streak: 8,
          activeDays: 34,
          taskCounts: {},
          rewardEventId: 0,
        }),
      addReward: (taskId, units) =>
        set((state) => {
          const rewardEventId = state.rewardEventId + 1;
          return {
            balanceUnits: state.balanceUnits + units,
            rewardEventId,
            latestReward: { amount: units, id: rewardEventId },
            taskCounts: {
              ...state.taskCounts,
              [taskId]: (state.taskCounts[taskId] ?? 0) + 1,
            },
          };
        }),
      addGameReward: (gameId, units) =>
        set((state) => {
          const safeUnits = Math.max(0, Math.round(units));
          if (!safeUnits) return state;
          const rewardEventId = state.rewardEventId + 1;
          return {
            balanceUnits: state.balanceUnits + safeUnits,
            rewardEventId,
            latestReward: { amount: safeUnits, id: rewardEventId },
            taskCounts: {
              ...state.taskCounts,
              [`game:${gameId}`]: (state.taskCounts[`game:${gameId}`] ?? 0) + 1,
            },
          };
        }),
      setBalance: (balanceUnits) => set({ balanceUnits }),
      clearLatestReward: () => set({ latestReward: null }),
      setGoal: (goalUnits) => set({ goalUnits: Math.max(100, goalUnits) }),
      setTheme: (theme) => set({ theme }),
      setNotifications: (notificationsEnabled) => set({ notificationsEnabled }),
      setNotificationTime: (notificationTime) => set({ notificationTime }),
      updateUser: (input) =>
        set((state) => ({ user: { ...state.user, ...input } })),
    }),
    {
      name: "logic-coin-state-v1",
      version: 2,
      migrate: (persistedState) => {
        if (!persistedState || typeof persistedState !== "object") {
          return persistedState as AppState;
        }
        const next = { ...(persistedState as Record<string, unknown>) };
        delete next.selectedPiggy;
        delete next.selectPiggy;
        return next as AppState;
      },
      storage: createJSONStorage(() => secureStorage),
      skipHydration: Platform.OS === "web",
      partialize: ({
        hydrated: _hydrated,
        rewardEventId: _rewardEventId,
        latestReward: _latestReward,
        ...state
      }) => state,
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
