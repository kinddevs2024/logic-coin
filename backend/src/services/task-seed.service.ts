import { Task } from "../models/Task.js";

const defaultTasks = [
  {
    key: "demo_short_ad",
    provider: "demo",
    type: "ad",
    icon: "play-circle",
    title: {
      en: "Quick reward",
      ru: "Быстрая награда",
      uz: "Tezkor mukofot"
    },
    description: {
      en: "Demo rewarded action. The future ad provider plugs in here.",
      ru: "Демо-награда. Позже здесь подключится рекламный провайдер.",
      uz: "Demo mukofot. Keyinroq bu yerga reklama provayderi ulanadi."
    },
    rewardUnits: 3,
    cooldownSeconds: 30,
    dailyLimit: 10,
    enabled: true,
    sortOrder: 10
  },
  {
    key: "demo_three_ads",
    provider: "demo",
    type: "ad",
    icon: "layers",
    title: {
      en: "Three-action series",
      ru: "Серия из трёх действий",
      uz: "Uchta harakat seriyasi"
    },
    description: {
      en: "Complete a demo series and receive a larger reward.",
      ru: "Выполните демо-серию и получите повышенную награду.",
      uz: "Demo seriyani bajaring va kattaroq mukofot oling."
    },
    rewardUnits: 8,
    cooldownSeconds: 180,
    dailyLimit: 4,
    enabled: true,
    sortOrder: 20
  },
  {
    key: "demo_long_ad",
    provider: "demo",
    type: "ad",
    icon: "ticket",
    title: {
      en: "Premium reward",
      ru: "Повышенная награда",
      uz: "Katta mukofot"
    },
    description: {
      en: "Demo equivalent of a longer rewarded placement.",
      ru: "Демо-аналог будущей длинной rewarded-рекламы.",
      uz: "Kelajakdagi uzunroq rewarded reklamaning demo varianti."
    },
    rewardUnits: 15,
    cooldownSeconds: 600,
    dailyLimit: 2,
    enabled: true,
    sortOrder: 30
  },
  {
    key: "daily_activity",
    provider: "demo",
    type: "daily",
    icon: "calendar-check",
    title: {
      en: "Daily activity",
      ru: "Ежедневная активность",
      uz: "Kundalik faollik"
    },
    description: {
      en: "Return today and add one more active day.",
      ru: "Вернитесь сегодня и добавьте ещё один активный день.",
      uz: "Bugun qayting va yana bir faol kun qo‘shing."
    },
    rewardUnits: 5,
    cooldownSeconds: 0,
    dailyLimit: 1,
    enabled: true,
    sortOrder: 40
  }
] as const;

export async function seedDefaultTasks(): Promise<void> {
  await Task.bulkWrite(
    defaultTasks.map((task) => ({
      updateOne: {
        filter: { key: task.key },
        update: { $setOnInsert: task },
        upsert: true
      }
    })),
    { ordered: false }
  );
}
