import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useId, useReducer, useRef, useState } from "react";
import {
  Animated, AppState, Easing, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions,
  type ImageStyle, type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from "react-native-svg";
import { usePauseClock } from "@/games/pause-clock";
import { gameCoinReward } from "@/games/rewards";
import { useGameSession } from "@/games/session-context";
import { useTranslation } from "@/hooks/use-translation";
import {
  createLightSequence, judgeLightSequenceInput, lightSequenceResponseMs, lightSequenceScore, LIGHT_SEQUENCE_CHALLENGE_ERRORS,
  LIGHT_SEQUENCE_START_LENGTH, type LightSequencePad
} from "./round";

const messages = {
  ru: {
    challenge: "Челлендж", practice: "Обычная игра", back: "Назад",
    round: "Раунд", signals: "Сигналы", errors: "Ошибки", best: "Рекорд", start: "Начать игру", time: "Время", seconds: "с", timeout: "Время вышло",
    watch: "Запомни порядок", input: "Твоя очередь", correct: "Верно!",
    mistake: "Не та кнопка", done: "Челлендж завершён",
    pads: ["Круг", "Треугольник", "Квадрат", "Ромб"],
  },
  uz: {
    challenge: "Sinov", practice: "Oddiy o‘yin", back: "Orqaga",
    round: "Bosqich", signals: "Signallar", errors: "Xatolar", best: "Rekord", start: "O‘yinni boshlash", time: "Vaqt", seconds: "s", timeout: "Vaqt tugadi",
    watch: "Tartibni eslab qoling", input: "Navbat sizda", correct: "To‘g‘ri!",
    mistake: "Noto‘g‘ri tugma", done: "Sinov yakunlandi",
    pads: ["Doira", "Uchburchak", "Kvadrat", "Romb"],
  },
  en: {
    challenge: "Challenge", practice: "Practice", back: "Back",
    round: "Round", signals: "Signals", errors: "Mistakes", best: "Best round", start: "Start game", time: "Time", seconds: "s", timeout: "Time’s up",
    watch: "Memorize the order", input: "Your turn", correct: "Correct!",
    mistake: "Wrong pad", done: "Challenge complete",
    pads: ["Circle", "Triangle", "Square", "Diamond"],
  },
};

const boardArt = require("../../../assets/light-sequence/board.webp");
const illuminatedArt = require("../../../assets/light-sequence/lit-board.webp");
const clockArt = require("../../../assets/light-sequence/console-clock.webp");
const PAD_LIGHT_MS = 460;

function padArea(left: number, top: number, width: number, height: number) {
  const bounds: ViewStyle = {
    left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`,
  };
  // Register the full lit shot against the base photo within this key's window.
  const art: ImageStyle = {
    left: `${-100 * left / width}%`, top: `${-100 * top / height}%`,
    width: `${10000 / width}%`, height: `${10000 / height}%`,
  };
  return { bounds, art };
}

const padAreas = [
  padArea(8.8, 7.4, 32.4, 33.2),
  padArea(58.8, 7.4, 32.4, 33.2),
  padArea(8.8, 57.4, 32.4, 33.2),
  padArea(58.8, 57.4, 32.4, 33.2),
];

type Phase = "intro" | "ready" | "glow" | "gap" | "input" | "correct" | "mistake" | "done";
type Round = {
  phase: Phase;
  pattern: readonly LightSequencePad[];
  completed: number;
  mistakes: number;
  position: number;
  step: number;
  lastPad: number | null;
};
type RoundAction =
  | { type: "show"; pattern: readonly LightSequencePad[]; reset: boolean }
  | { type: "next-signal" }
  | { type: "end-signal" }
  | { type: "pick"; pad: number; challengeMode: boolean }
  | { type: "timeout"; challengeMode: boolean };

const initialRound: Round = {
  phase: "intro", pattern: [], completed: 0, mistakes: 0, position: 0, step: 0, lastPad: null,
};

function advanceRound(round: Round, action: RoundAction): Round {
  switch (action.type) {
    case "show":
      return {
        ...(action.reset ? initialRound : round),
        phase: "ready", pattern: action.pattern, position: 0, step: 0, lastPad: null,
      };
    case "next-signal":
      if (round.phase !== "ready" && round.phase !== "gap") return round;
      return { ...round, phase: round.step < round.pattern.length ? "glow" : "input" };
    case "end-signal":
      if (round.phase !== "glow") return round;
      return { ...round, phase: "gap", step: round.step + 1 };
    case "timeout":
    case "pick": {
      if (round.phase !== "input") return round;
      const verdict = action.type === "timeout" ? "wrong" : judgeLightSequenceInput(round.pattern, round.position, action.pad);
      if (verdict === "wrong") {
        const mistakes = round.mistakes + 1;
        return {
          ...round, mistakes, lastPad: action.type === "timeout" ? null : action.pad,
          phase: action.challengeMode && mistakes === LIGHT_SEQUENCE_CHALLENGE_ERRORS ? "done" : "mistake",
        };
      }
      const complete = verdict === "complete";
      return {
        ...round, position: round.position + 1, lastPad: null,
        phase: complete ? "correct" : "input", completed: round.completed + Number(complete),
      };
    }
  }
}

const phosphor = "#C4FFD2";
const engraving = "#A8B2B5";
const boardRim = "#191D20";
const consoleFont = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });
const brushedMetal = ["#565D61", "#31373B", "#1E2225"] as const;
const recessedGlass = ["#141817", "#1E2421", "#101512"] as const;
const mintKey = ["#C4EAD3", "#87BEA0", "#508266"] as const;
const gaugeSegments = Array.from({ length: 16 }, (_, index) => index);

function squirclePath(width: number, height: number, corner: number, inset = 0) {
  const left = inset;
  const top = inset;
  const right = width - inset;
  const bottom = height - inset;
  const r = Math.min(corner, (right - left) / 2, (bottom - top) / 2);
  const s = r * 0.11;
  return [
    `M ${left + r} ${top} H ${right - r}`,
    `C ${right - s} ${top} ${right} ${top + s} ${right} ${top + r} V ${bottom - r}`,
    `C ${right} ${bottom - s} ${right - s} ${bottom} ${right - r} ${bottom} H ${left + r}`,
    `C ${left + s} ${bottom} ${left} ${bottom - s} ${left} ${bottom - r} V ${top + r}`,
    `C ${left} ${top + s} ${left + s} ${top} ${left + r} ${top} Z`,
  ].join(" ");
}

function Squircle({ testID, corner, fill, stroke, seam, inverse }: {
  testID: string;
  corner: number;
  fill: string | readonly [string, string, string];
  stroke?: string;
  seam?: string;
  inverse?: boolean;
}) {
  const materialId = `console-material-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { width, height } = size;
  const inset = stroke ? 0.5 : 0;
  const shape = width > inset * 2 && height > inset * 2 ? squirclePath(width, height, corner, inset) : "";
  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={({ nativeEvent: { layout } }) => {
        setSize(previous => previous.width === layout.width && previous.height === layout.height
          ? previous : { width: layout.width, height: layout.height });
      }}
    >
      {shape ? (
        <Svg width={width} height={height} accessible={false}>
          {typeof fill !== "string" ? (
            <Defs>
              <SvgGradient id={materialId} x1="0" y1="0" x2="0" y2="100%">
                <Stop offset="0" stopColor={fill[0]} />
                <Stop offset="0.18" stopColor={fill[1]} />
                <Stop offset="1" stopColor={fill[2]} />
              </SvgGradient>
            </Defs>
          ) : null}
          <Path
            d={inverse ? `M 0 0 H ${width} V ${height} H 0 Z ${shape}` : shape}
            fill={typeof fill === "string" ? fill : `url(#${materialId})`}
            fillRule={inverse ? "evenodd" : "nonzero"}
            stroke={stroke}
            strokeWidth={stroke ? 1 : 0}
          />
          {seam && width > 6 && height > 6 ? (
            <Path d={squirclePath(width, height, corner - 2, 2.5)} fill="none" stroke={seam} strokeWidth={1} />
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

export function LightSequenceGame({
  challengeMode, paused, onExit, onComplete, bestRounds = 0,
}: {
  challengeMode: boolean;
  paused: boolean;
  onExit: () => void;
  onComplete: (score: number, durationMs: number, won: boolean) => void;
  bestRounds?: number;
}) {
  const { language } = useTranslation();
  const copy = messages[language];
  const session = useGameSession();
  const { height, width } = useWindowDimensions();
  const compact = height < 740 || width < 355;
  const [round, dispatch] = useReducer(advanceRound, initialRound);
  const [tapLights, setTapLights] = useState<ReadonlySet<number>>(() => new Set());
  const tapTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const [backgrounded, setBackgrounded] = useState(false);
  const suspended = paused || backgrounded;
  const startedAt = useRef(0);
  const reportedResult = useRef<Round | null>(null);
  const remainingMs = useRef<number | null>(null);
  const inputDeadline = useRef(0);
  const [clock, setClock] = useState<{ pattern: Round["pattern"]; mistakes: number; leftMs: number } | null>(null);
  const count = round.pattern.length || LIGHT_SEQUENCE_START_LENGTH;
  const responseMs = lightSequenceResponseMs(count);
  usePauseClock(suspended, [startedAt]);

  useEffect(() => {
    const timers = tapTimers.current;
    return () => {
      timers.forEach(timer => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", next => setBackgrounded(next === "inactive" || next === "background"));
    return () => subscription.remove();
  }, []);

  const begin = () => {
    if (suspended) return;
    session?.onStart();
    startedAt.current = Date.now();
    dispatch({ type: "show", pattern: createLightSequence(), reset: true });
  };

  useEffect(() => {
    if (suspended) return;
    let run: () => void;
    let delay: number;
    switch (round.phase) {
      case "ready":
      case "gap":
        run = () => dispatch({ type: "next-signal" });
        delay = round.phase === "ready" ? 490 : 240;
        break;
      case "glow":
        run = () => dispatch({ type: "end-signal" });
        delay = PAD_LIGHT_MS;
        break;
      case "correct":
        run = () => dispatch({ type: "show", pattern: createLightSequence(round.pattern.length + 1), reset: false });
        delay = 780;
        break;
      case "mistake":
        run = () => {
          if (!challengeMode) startedAt.current = Date.now();
          dispatch({
            type: "show",
            pattern: challengeMode ? round.pattern : createLightSequence(),
            reset: !challengeMode,
          });
        };
        delay = 1060;
        break;
      default:
        return;
    }
    const timer = setTimeout(run, delay);
    return () => clearTimeout(timer);
  }, [challengeMode, round.pattern, round.phase, suspended]);

  useEffect(() => {
    if (round.phase !== "input") {
      remainingMs.current = null;
      return;
    }
    if (suspended) return;

    const budget = remainingMs.current ?? responseMs;
    const deadline = performance.now() + budget;
    inputDeadline.current = deadline;
    const tick = () => {
      const left = Math.max(0, deadline - performance.now());
      setClock({ pattern: round.pattern, mistakes: round.mistakes, leftMs: left });
      if (left === 0) dispatch({ type: "timeout", challengeMode });
    };
    tick();
    const interval = setInterval(tick, 100);
    const timeout = setTimeout(tick, budget);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
      inputDeadline.current = 0;
      remainingMs.current = Math.max(0, deadline - performance.now());
    };
  }, [challengeMode, responseMs, round.mistakes, round.pattern, round.phase, suspended]);

  useEffect(() => {
    if (!(round.phase === "done" || (!challengeMode && round.phase === "mistake")) || reportedResult.current === round) return;
    reportedResult.current = round;
    onComplete(lightSequenceScore(round.completed), Math.max(0, Date.now() - startedAt.current), round.completed > 0);
  }, [challengeMode, onComplete, round]);

  const pick = useCallback((pad: number) => {
    if (suspended || round.phase !== "input") return;
    if (inputDeadline.current > 0 && performance.now() >= inputDeadline.current) {
      dispatch({ type: "timeout", challengeMode });
      return;
    }
    const timers = tapTimers.current;
    clearTimeout(timers.get(pad));
    setTapLights(current => current.has(pad) ? current : new Set(current).add(pad));
    timers.set(pad, setTimeout(() => {
      timers.delete(pad);
      setTapLights(current => {
        const next = new Set(current);
        next.delete(pad);
        return next;
      });
    }, PAD_LIGHT_MS));
    dispatch({ type: "pick", pad, challengeMode });
    void Haptics.selectionAsync().catch(() => undefined);
  }, [challengeMode, round.phase, suspended]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const keyboard = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || !/^[1-4]$/.test(event.key)) return;
      pick(Number(event.key) - 1);
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [pick]);

  const watching = round.phase === "ready" || round.phase === "glow" || round.phase === "gap";
  const mistake = round.phase === "mistake" || round.phase === "done";
  const timedOut = mistake && round.lastPad === null;
  const status = watching ? copy.watch
    : round.phase === "input" ? copy.input
    : round.phase === "correct" ? copy.correct
    : round.phase === "mistake" ? (timedOut ? copy.timeout : copy.mistake)
    : round.phase === "done" ? copy.done : null;

  const currentRound = round.completed + (round.phase === "correct" ? 0 : 1);
  const mayPick = !suspended && round.phase === "input";
  const currentClock = round.phase === "input" && clock?.pattern === round.pattern && clock.mistakes === round.mistakes;
  const clockMs = timedOut ? 0 : currentClock ? clock.leftMs : responseMs;
  const clockColor = timedOut || (mayPick && clockMs <= 2000) ? "#FFB875" : phosphor;
  const earnedCoins = gameCoinReward(lightSequenceScore(round.completed), false, "light-sequence");

  return (
    <LinearGradient colors={["#373E42", "#23282B", "#111517"]} locations={[0, 0.48, 1]} style={styles.root}>
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={[styles.content, compact && styles.compact]} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Pressable accessibilityRole="button" accessibilityLabel={copy.back} onPress={onExit} style={styles.back}>
              <Squircle testID="light-sequence-back-shape" corner={17} fill={brushedMetal} stroke="#7F898C" seam="#262C2E" />
              <Ionicons name="chevron-back" size={21} color="#E4ECEE" />
            </Pressable>
            <View style={styles.headerCenter}>
              <Text style={styles.mode} numberOfLines={1}>{challengeMode ? copy.challenge : copy.practice}</Text>
            </View>
            <View style={styles.headerAction}>{challengeMode ? session?.headerAction : null}</View>
          </View>

          <View style={[styles.deck, compact && styles.compactDeck]}>
            <Squircle testID="light-sequence-panel-shape" corner={compact ? 25 : 32} fill={brushedMetal} stroke="#7F878A" seam="#202427" />
            <View style={styles.metrics}>
              <Metric label={copy.round} value={currentRound} icon="layers-outline" />
              <Metric label={copy.signals} value={count} icon="flash-outline" />
              {challengeMode ? <>
                <Metric label={copy.errors} value={`${round.mistakes}/${LIGHT_SEQUENCE_CHALLENGE_ERRORS}`} icon="alert-circle-outline" />
                <Metric label="Coin" value={earnedCoins} icon="diamond-outline" />
              </> : <Metric label={copy.best} value={Math.max(bestRounds, round.completed)} icon="trophy-outline" />}
            </View>

            <ConsoleClock label={copy.time} unit={copy.seconds} ms={clockMs} totalMs={responseMs} color={clockColor} />

            {status ? (
              <View style={styles.statusLine}>
                <View style={[styles.statusDot, { backgroundColor: mistake ? "#FF997F" : watching ? "#FFC370" : phosphor }]} />
                <Text style={styles.status} accessibilityLiveRegion="polite">{status}</Text>
                {round.phase === "input" ? <Text style={styles.position}>{round.position} / {count}</Text> : null}
              </View>
            ) : null}

            <View style={styles.boardSocket}>
              <Squircle testID="light-sequence-socket-shape" corner={24} fill={boardRim} stroke="#5B6266" seam="#0F1113" />
              <View testID="light-sequence-board" style={styles.board}>
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                  <Image source={boardArt} testID="light-sequence-board-image" resizeMode="stretch" style={styles.boardPhoto} fadeDuration={0} />
                </View>
                {padAreas.map((area, index) => {
                  const lit = !suspended && round.phase === "glow" && round.pattern[round.step] === index;
                  const tapped = !suspended && tapLights.has(index);
                  return (
                    <Pressable
                      key={index}
                      accessibilityRole="button"
                      accessibilityLabel={`${index + 1}. ${copy.pads[index]}`}
                      accessibilityState={{ disabled: !mayPick }}
                      disabled={!mayPick}
                      onPress={() => pick(index)}
                      testID={`light-sequence-pad-${index + 1}`}
                      style={[styles.pad, area.bounds]}
                    >
                      {({ pressed }) => (
                        <PadIllumination art={area.art} active={lit || tapped || (mayPick && pressed)} signal={lit} />
                      )}
                    </Pressable>
                  );
                })}
                <Squircle testID="light-sequence-board-shape" corner={21} fill={boardRim} inverse />
              </View>
            </View>

            {round.phase === "intro" ? (
              <Pressable accessibilityRole="button" accessibilityLabel={copy.start} disabled={suspended} onPress={begin} style={({ pressed }) => [styles.start, pressed && styles.pressed]}>
                <Squircle testID="light-sequence-start-shape" corner={17} fill={mintKey} stroke="#ABD1BA" seam="#425D50" />
                <Text style={styles.startText}>{copy.start}</Text>
                <Ionicons name="arrow-forward" size={17} color="#15271F" />
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function PadIllumination({ art, active, signal }: { art: ImageStyle; active: boolean; signal: boolean }) {
  const [brightness] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const fade = Animated.timing(brightness, {
      toValue: active ? 1 : 0,
      duration: active ? 125 : 155,
      easing: active ? Easing.out(Easing.quad) : Easing.inOut(Easing.sin),
      useNativeDriver: Platform.OS !== "web",
      isInteraction: false,
    });
    fade.start();
    return () => fade.stop();
  }, [active, brightness]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.Image
        source={illuminatedArt}
        resizeMode="stretch"
        fadeDuration={0}
        testID={signal ? "light-sequence-active-pad" : undefined}
        style={[styles.litPhoto, art, { opacity: brightness }]}
      />
    </View>
  );
}

function Metric({ label, value, icon }: { label: string; value: number | string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View accessible accessibilityLabel={`${label} ${value}`} style={styles.metric}>
      <Squircle testID="light-sequence-metric-shape" corner={13} fill={recessedGlass} stroke="#697071" seam="#0B100D" />
      <Ionicons name={icon} size={15} color={engraving} />
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function ConsoleClock({ label, unit, ms, totalMs, color }: { label: string; unit: string; ms: number; totalMs: number; color: string }) {
  const charge = ms / totalMs * gaugeSegments.length;
  return (
    <View style={styles.clock} accessibilityLabel={label}>
      <Squircle testID="light-sequence-clock-shape" corner={16} fill={recessedGlass} stroke="#727A79" seam="#0C1110" />
      <Image testID="light-sequence-clock-art" source={clockArt} style={styles.clockArt} resizeMode="contain" fadeDuration={0} />
      <View style={styles.clockDisplay}>
        <Text testID="light-sequence-clock" style={[styles.clockValue, { color, textShadowColor: color }]}>
          {Math.ceil(ms / 1000)} {unit}
        </Text>
        <View testID="light-sequence-clock-gauge" style={styles.clockTrack}>
          {gaugeSegments.map(index => (
            <View key={index} style={styles.diode}>
              <View style={[styles.diodeLight, { backgroundColor: color, opacity: Math.max(0, Math.min(1, charge - index)) }]} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { alignSelf: "center", width: "100%", maxWidth: 540, paddingHorizontal: 17, paddingTop: 10, paddingBottom: 18, gap: 11 },
  compact: { paddingHorizontal: 12, paddingTop: 5, paddingBottom: 12, gap: 9 },
  header: { flexDirection: "row", alignItems: "center", minHeight: 46 },
  back: { width: 46, height: 46, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  mode: { color: "#DAE0E1", fontFamily: consoleFont, fontSize: 12, fontWeight: "700", letterSpacing: 1.6, textTransform: "uppercase", textShadowColor: "#080A0B", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  headerAction: { alignItems: "flex-end", justifyContent: "center", width: 46, minHeight: 46 },
  deck: { padding: 15, gap: 12 },
  compactDeck: { padding: 10, gap: 8 },
  statusLine: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 24, paddingHorizontal: 4 },
  statusDot: { width: 7, height: 7, borderRadius: 4, borderWidth: 1, borderColor: "#ECFFF183" },
  status: { flex: 1, color: "#ECF5EF", fontFamily: consoleFont, fontSize: 12, fontWeight: "700", letterSpacing: 0.15 },
  position: { color: phosphor, fontFamily: consoleFont, fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums"] },
  boardSocket: { width: "100%", maxWidth: 474, alignSelf: "center", padding: 5 },
  board: { width: "100%", aspectRatio: 1 },
  boardPhoto: { width: "100%", height: "100%" },
  clock: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 9, paddingVertical: 5 },
  clockArt: { width: 53, height: 53 },
  clockDisplay: { flex: 1, minWidth: 0, gap: 4, paddingRight: 3 },
  clockTrack: { flexDirection: "row", gap: 3 },
  diode: { flex: 1, height: 6, borderRadius: 2, overflow: "hidden", backgroundColor: "#35423B" },
  diodeLight: { flex: 1 },
  clockValue: { fontFamily: consoleFont, fontSize: 23, lineHeight: 25, fontWeight: "800", letterSpacing: 2, fontVariant: ["tabular-nums"], textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },
  pad: { position: "absolute", borderRadius: 20, overflow: "hidden" },
  litPhoto: { position: "absolute" },
  metrics: { flexDirection: "row", gap: 6 },
  metric: { minWidth: 0, flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 5, paddingVertical: 9 },
  metricValue: { color: phosphor, fontFamily: consoleFont, fontSize: 16, fontWeight: "800", fontVariant: ["tabular-nums"] },
  start: { minHeight: 47, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  startText: { color: "#102319", fontFamily: consoleFont, textTransform: "uppercase", fontSize: 13, fontWeight: "800", letterSpacing: 1.25 },
  pressed: { opacity: 0.84, transform: [{ translateY: 1 }] },
});
