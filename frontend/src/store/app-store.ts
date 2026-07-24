import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import type {
  AuthMode,
  BootstrapPayload,
  Language,
  PiggyKind,
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
  selectedPiggy: PiggyKind;
  theme: ThemeMode;
  notificationsEnabled: boolean;
  notificationTime: string;
  taskCounts: Record<string, number>;
  latestReward: number | null;
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
  setBalance: (units: number) => void;
  clearLatestReward: () => void;
  setGoal: (units: number) => void;
  selectPiggy: (piggy: PiggyKind) => void;
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
      selectedPiggy: "pig",
      theme: "light",
      notificationsEnabled: true,
      notificationTime: "19:00",
      taskCounts: {},
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
          selectedPiggy: payload.user.preferences.piggyBankVariant,
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
        }),
      addReward: (taskId, units) =>
        set((state) => ({
          balanceUnits: state.balanceUnits + units,
          latestReward: units,
          taskCounts: {
            ...state.taskCounts,
            [taskId]: (state.taskCounts[taskId] ?? 0) + 1,
          },
        })),
      setBalance: (balanceUnits) => set({ balanceUnits }),
      clearLatestReward: () => set({ latestReward: null }),
      setGoal: (goalUnits) => set({ goalUnits: Math.max(100, goalUnits) }),
      selectPiggy: (selectedPiggy) => set({ selectedPiggy }),
      setTheme: (theme) => set({ theme }),
      setNotifications: (notificationsEnabled) => set({ notificationsEnabled }),
      setNotificationTime: (notificationTime) => set({ notificationTime }),
      updateUser: (input) =>
        set((state) => ({ user: { ...state.user, ...input } })),
    }),
    {
      name: "logic-coin-state-v1",
      storage: createJSONStorage(() => secureStorage),
      partialize: ({
        hydrated: _hydrated,
        latestReward: _latestReward,
        ...state
      }) => state,
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
