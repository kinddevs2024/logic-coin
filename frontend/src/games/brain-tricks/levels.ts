import type { PuzzleDefinition, PuzzleObjectDefinition } from "./types";

const TITLES = [
  "Солнечный робот", "Звёзды за облаком", "Фрукт поближе", "Самый большой круг", "Необычная лампа",
  "Ключ под подушкой", "Разряженный помощник", "Радужный порядок", "Потерянная цифра", "Тайный выключатель",
  "Почини игрушку", "Открой мастерскую", "Вырастить росток", "Запусти поезд", "Разбуди маяк",
  "Собери телескоп", "Накорми дракона", "Верни музыку", "Освободи светлячка", "Согрей пингвина",
  "Слово становится мостом", "Поверни созвездие", "Число для ракеты", "Три верных сигнала", "Уменьши планету",
  "Спрячь дождь", "Переверни компас", "Собери пароль", "Найди лишнюю тень", "Слово-ключ",
  "Секрет картины", "Механический сад", "Космическая посылка", "Ночной музей", "Побег из лаборатории",
  "Оркестр без дирижёра", "Замёрзший портал", "Свет в подземелье", "Последняя звезда", "Экзамен для гения",
] as const;

const INSTRUCTIONS = [
  "Разбуди робота.", "Покажи три звезды.", "Помоги существу получить фрукт.", "Найди самый большой круг.", "Включи весь свет.",
  "Найди ключ.", "Заряди помощника.", "Нажми цвета в правильном порядке.", "Заверши пример.", "Открой тайную дверь.",
  "Почини игрушку и включи её.", "Открой мастерскую.", "Помоги ростку вырасти.", "Запусти маленький поезд.", "Зажги маяк.",
  "Собери телескоп.", "Накорми дракона.", "Верни музыку в комнату.", "Освободи светлячка.", "Согрей пингвина.",
  "Создай мост из того, что уже есть.", "Собери созвездие.", "Дай ракете недостающую цифру.", "Отправь три сигнала.", "Освободи спутник.",
  "Останови дождь.", "Укажи настоящий север.", "Собери пароль из подсказок.", "Найди лишнюю тень.", "Открой замок словом.",
  "Найди выход за картиной.", "Оживи механический сад.", "Доставь космическую посылку.", "Верни экспонат на место.", "Помоги роботу выбраться.",
  "Заставь оркестр сыграть вместе.", "Запусти замёрзший портал.", "Освети путь под землёй.", "Верни последнюю звезду на небо.", "Докажи, что думаешь иначе.",
] as const;

const COLORS = ["#FCA5A5", "#FDE68A", "#86EFAC", "#93C5FD", "#C4B5FD", "#FDBA74"];
function object(id: string, symbol: string, x: number, y: number, options: Partial<PuzzleObjectDefinition> = {}): PuzzleObjectDefinition {
  return { id, symbol, position: { x, y }, size: 14, color: COLORS[id.length % COLORS.length]!, layer: "OBJECT", visible: true, ...options };
}

function dragReveal(id: number): PuzzleDefinition {
  return {
    id, stage: Math.ceil(id / 10), title: TITLES[id - 1]!, instruction: INSTRUCTIONS[id - 1]!, background: COLORS[id % COLORS.length]!,
    objects: [
      object("cover", id % 2 ? "☁️" : "🛏️", 50, 46, { draggable: true, size: 22, layer: "FOREGROUND" }),
      object("reveal", id % 2 ? "⭐⭐⭐" : "🔑", 50, 48, { visible: false, state: "hidden", size: 18, layer: "SCENE_BACK" }),
      object("side", "🪴", 18, 72, { isZone: true, color: "rgba(255,255,255,0.3)" }),
    ],
    rules: [{ id: "uncover", event: "drop", actorId: "cover", targetId: "side", effects: [{ type: "show", objectId: "reveal" }, { type: "setState", objectId: "reveal", state: "found" }, { type: "move", objectId: "cover", position: { x: 20, y: 72 } }], once: true }],
    successConditions: [{ type: "stateEquals", objectId: "reveal", state: "found" }],
    hints: ["Что-то может быть закрыто другим предметом.", "Попробуй освободить центр сцены.", "Перетащи верхний предмет в сторону."],
  };
}

function chain(id: number, length = 2): PuzzleDefinition {
  const objects = [
    object("part", id % 2 ? "🔋" : "🔑", 22, 68, { draggable: true, size: 13 }),
    object("machine", id % 2 ? "🤖" : "🚪", 70, 55, { isZone: true, tappable: true, state: "off", size: 24, layer: "CHARACTER" }),
    object("reward", id % 2 ? "✨" : "🌈", 70, 28, { visible: false, layer: "FX" }),
  ];
  if (length > 2) objects.push(object("switch", "🔘", 48, 78, { tappable: true, state: "off" }));
  const rules: PuzzleDefinition["rules"] = [
    { id: "install", event: "drop", actorId: "part", targetId: "machine", effects: [{ type: "setState", objectId: "machine", state: "ready" }, { type: "hide", objectId: "part" }], once: true },
    ...(length > 2 ? [{ id: "switch", event: "tap" as const, actorId: "switch", prerequisites: [{ objectId: "machine", state: "ready" }], effects: [{ type: "setState" as const, objectId: "switch", state: "on" }], once: true }] : []),
    { id: "activate", event: "tap", actorId: "machine", prerequisites: [{ objectId: "machine", state: "ready" }, ...(length > 2 ? [{ objectId: "switch", state: "on" }] : [])], effects: [{ type: "setState", objectId: "machine", state: "solved" }, { type: "show", objectId: "reward" }], once: true },
  ];
  return {
    id, stage: Math.ceil(id / 10), title: `Механизм ${id}`, instruction: length > 2 ? "Установи деталь, включи кнопку и запусти механизм." : "Установи деталь и запусти механизм.", background: COLORS[(id + 1) % COLORS.length]!, objects, rules,
    successConditions: [{ type: "stateEquals", objectId: "machine", state: "solved" }],
    hints: ["Сначала подготовь главный предмет.", "Деталь слева куда-то подходит.", length > 2 ? "Установи деталь, включи кнопку, затем механизм." : "Установи деталь, затем нажми механизм."],
  };
}

function meta(id: number): PuzzleDefinition {
  return {
    id, stage: Math.ceil(id / 10), title: `Живой символ ${id}`, instruction: "Используй символ сверху как настоящий предмет.", background: COLORS[(id + 4) % COLORS.length]!,
    objects: [
      object("word", id % 2 ? "МОСТ" : "7", 50, 20, { label: id % 2 ? "слово из задания" : "цифра из задания", draggable: true, size: 14, layer: "UI" }),
      object("goal", id % 2 ? "🌉" : "🚀", 50, 65, { isZone: true, state: "empty", size: 25 }),
      object("done", "✨", 50, 45, { visible: false, layer: "FX" }),
    ],
    rules: [{ id: "use-text", event: "drop", actorId: "word", targetId: "goal", effects: [{ type: "setState", objectId: "goal", state: "solved" }, { type: "hide", objectId: "word" }, { type: "show", objectId: "done" }], once: true }],
    successConditions: [{ type: "ruleTriggered", ruleId: "use-text" }],
    hints: ["Иногда задание — часть сцены.", "Посмотри на верхний объект как на настоящий предмет.", "Перетащи слово или число к цели."],
  };
}

function advanced(id: number): PuzzleDefinition {
  return chain(id, 3);
}

function stageOne(id: number): PuzzleDefinition {
  const base = { id, stage: 1, title: TITLES[id - 1]!, instruction: INSTRUCTIONS[id - 1]!, background: COLORS[(id + 2) % COLORS.length]! };
  if (id === 1) return {
    ...base,
    title: "Biggest shape",
    instruction: "Which one is the biggest?",
    background: "#FFF8E7",
    objects: [
      object("elephant", "", 18, 54, { icon: "elephant", tappable: true, size: 23 }),
      object("lion", "", 38, 51, { icon: "cat", tappable: true, state: "waiting", size: 17 }),
      object("mouse", "", 55, 58, { icon: "mouse", tappable: true, size: 10 }),
      object("zebra", "", 73, 52, { icon: "horse-variant", tappable: true, size: 17 }),
      object("sloth", "", 88, 57, { icon: "teddy-bear", tappable: true, size: 13 }),
    ],
    rules: [{ id: "largest", event: "tap", actorId: "lion", effects: [{ type: "setState", objectId: "lion", state: "solved" }], once: true }],
    successConditions: [{ type: "stateEquals", objectId: "lion", state: "solved" }],
    successText: "LION HAS THE BIGGEST SHAPE.",
    hints: ["Look at the picture size.", "Not the real animal size.", "Tap the lion."],
  };
  if (id === 2) return {
    ...base,
    title: "Flower",
    instruction: "How to blossom this flower?",
    background: "#FFF8E7",
    objects: [
      object("sun", "", 50, 31, { icon: "weather-sunny", size: 22, color: "#F7C948", layer: "SCENE_BACK" }),
      object("cloud-a", "", 39, 31, { icon: "weather-cloudy", draggable: true, size: 24, layer: "FOREGROUND" }),
      object("cloud-b", "", 51, 35, { icon: "weather-cloudy", draggable: true, size: 25, layer: "FOREGROUND" }),
      object("cloud-c", "", 62, 31, { icon: "weather-cloudy", draggable: true, size: 24, layer: "FOREGROUND" }),
      object("flower", "", 50, 69, { icon: "flower", size: 22, color: "#A3E635", layer: "CHARACTER" }),
      object("left-zone", "", 12, 30, { isZone: true, size: 15, visible: true }),
      object("top-zone", "", 50, 12, { isZone: true, size: 15, visible: true }),
      object("right-zone", "", 88, 30, { isZone: true, size: 15, visible: true }),
    ],
    rules: [
      { id: "move-a", event: "drop", actorId: "cloud-a", targetId: "left-zone", effects: [{ type: "move", objectId: "cloud-a", position: { x: 12, y: 30 } }], once: true },
      { id: "move-b", event: "drop", actorId: "cloud-b", targetId: "top-zone", effects: [{ type: "move", objectId: "cloud-b", position: { x: 50, y: 12 } }], once: true },
      { id: "move-c", event: "drop", actorId: "cloud-c", targetId: "right-zone", effects: [{ type: "move", objectId: "cloud-c", position: { x: 88, y: 30 } }], once: true },
    ],
    successConditions: [{ type: "ruleTriggered", ruleId: "move-a" }, { type: "ruleTriggered", ruleId: "move-b" }, { type: "ruleTriggered", ruleId: "move-c" }],
    successText: "WHAT A LOVELY FLOWER!",
    hints: ["The flower needs sunlight.", "Move the clouds away.", "Drag all three clouds to the edges."],
  };
  if (id === 3) return {
    ...base,
    title: "Elephant and fridge",
    instruction: "Put the elephant into the fridge.",
    background: "#FFF8E7",
    objects: [
      object("elephant", "", 29, 61, { icon: "elephant", draggable: true, size: 24 }),
      object("fridge", "", 71, 54, { icon: "fridge-outline", tappable: true, isZone: true, state: "closed", size: 30, color: "#2DD4BF" }),
    ],
    rules: [
      { id: "open-fridge", event: "tap", actorId: "fridge", effects: [{ type: "setState", objectId: "fridge", state: "open" }], once: true },
      { id: "store-elephant", event: "drop", actorId: "elephant", targetId: "fridge", prerequisites: [{ objectId: "fridge", state: "open" }], effects: [{ type: "hide", objectId: "elephant" }, { type: "setState", objectId: "fridge", state: "solved" }], once: true },
    ],
    successConditions: [{ type: "stateEquals", objectId: "fridge", state: "solved" }],
    successText: "COOL! IT FITS.",
    hints: ["The fridge is closed.", "Open it first.", "Tap the fridge, then drag the elephant inside."],
  };
  if (id === 4) return {
    ...base,
    title: "Closest",
    instruction: "Which one is closest to us?",
    background: "#FFF8E7",
    objects: [
      object("moon", "", 50, 36, { icon: "moon-waning-crescent", tappable: true, state: "waiting", size: 17 }),
      object("cloud", "", 50, 54, { icon: "weather-cloudy", tappable: true, size: 18 }),
      object("sun", "", 50, 72, { icon: "weather-sunny", tappable: true, size: 18 }),
    ],
    rules: [{ id: "closest", event: "tap", actorId: "moon", effects: [{ type: "setState", objectId: "moon", state: "solved" }], once: true }],
    successConditions: [{ type: "stateEquals", objectId: "moon", state: "solved" }],
    successText: "THE MOON IS CLOSEST TO THE QUESTION.",
    hints: ["Look at the question.", "Distance is on the page.", "Tap the top object."],
  };
  if (id === 5) return {
    ...base,
    title: "Pizza",
    instruction: "How many pizza slices do we have?",
    background: "#FFF8E7",
    objects: Array.from({ length: 8 }, (_, index) => object(`slice-${index}`, "", 24 + (index % 4) * 18, 40 + Math.floor(index / 4) * 21, { icon: "pizza", size: 13, color: "#F59E0B" })),
    rules: [],
    successConditions: [],
    successText: "ALWAYS LOOK FOR MORE.",
    hints: ["Some slices overlap.", "Move your eyes around the page.", "There are eight slices."],
  };
  if (id === 6) return dragReveal(id);
  if (id === 7) return chain(id, 2);
  if (id === 8) return { ...base, objects: [object("red", "🔴", 28, 56, { tappable: true, state: "off" }), object("blue", "🔵", 50, 56, { tappable: true, state: "off" }), object("yellow", "🟡", 72, 56, { tappable: true, state: "off" })], rules: [{ id: "first", event: "tap", actorId: "blue", effects: [{ type: "setState", objectId: "blue", state: "on" }], once: true }, { id: "second", event: "tap", actorId: "yellow", prerequisites: [{ objectId: "blue", state: "on" }], effects: [{ type: "setState", objectId: "yellow", state: "on" }], once: true }, { id: "third", event: "tap", actorId: "red", prerequisites: [{ objectId: "yellow", state: "on" }], effects: [{ type: "setState", objectId: "red", state: "on" }], once: true }], successConditions: [{ type: "stateEquals", objectId: "red", state: "on" }], hints: ["Порядок спрятан в холоде, тепле и огне.", "Начни с синего, закончи красным.", "Синий → жёлтый → красный."] };
  if (id === 9) return meta(id);
  return { ...base, objects: [object("painting", "🖼️", 48, 43, { tappable: true, size: 24 }), object("switch", "🔘", 48, 45, { visible: false, tappable: true, state: "off", layer: "SCENE_BACK" }), object("door", "🚪", 76, 62, { state: "closed", size: 23 })], rules: [{ id: "move-painting", event: "tap", actorId: "painting", effects: [{ type: "hide", objectId: "painting" }, { type: "show", objectId: "switch" }], once: true }, { id: "press-switch", event: "tap", actorId: "switch", effects: [{ type: "setState", objectId: "door", state: "open" }], once: true }], successConditions: [{ type: "stateEquals", objectId: "door", state: "open" }], hints: ["Выключатель может быть спрятан.", "Осмотри то, что висит на стене.", "Нажми картину, затем выключатель."] };
}

export const BRAIN_TRICKS_LEVELS: PuzzleDefinition[] = Array.from({ length: 40 }, (_unused, offset) => {
  const id = offset + 1;
  if (id <= 10) return stageOne(id);
  if (id <= 20) return chain(id, id % 2 ? 2 : 3);
  if (id <= 30) return id % 3 === 0 ? chain(id, 3) : meta(id);
  return id % 4 === 0 ? meta(id) : advanced(id);
});

export function getBrainTricksLevel(id: number) {
  return BRAIN_TRICKS_LEVELS[Math.max(0, Math.min(BRAIN_TRICKS_LEVELS.length - 1, id - 1))]!;
}
