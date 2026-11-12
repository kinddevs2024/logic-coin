import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";
import { AppState, Modal, Platform } from "react-native";
import { usePathname } from "expo-router";
import { useAppStore } from "@/store/app-store";
import { liveCommand, subscribeToChallengeUpdates } from "@/lib/challenge-live-updates";
import { raffleApi, type RaffleState } from "@/lib/raffle";
import { RaffleStage } from "./raffle-stage";
type ContextValue = { state: RaffleState | null; now: number; connected: boolean; eligibleDays: number };
const Context = createContext<ContextValue>({ state: null, now: 0, connected: false, eligibleDays: 0 });
const PauseContext = createContext(false);
export const useRafflePause = () => useContext(PauseContext);
export const useRaffle = () => useContext(Context);
export function RaffleProvider({ children }: PropsWithChildren) {
  const token = useAppStore(s => s.accessToken);
  const role = useAppStore(s => s.user.role);
  const pathname = usePathname();
  const [state, setState] = useState<RaffleState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [lastUpdate, setLastUpdate] = useState(0);
  const [eligibleDays, setEligibleDays] = useState(0);
  const offset = useRef(0);
  useEffect(() => {
    if (!token) return;
    let active = true, inFlight = false;
    const visible = () => AppState.currentState === "active" && (Platform.OS !== "web" || document.visibilityState === "visible");
    const receive = (value: RaffleState) => { if (!active) return; offset.current = Date.parse(value.serverNow) - Date.now(); setState(value); setLastUpdate(Date.parse(value.serverNow)); };
    const unsubscribe = subscribeToChallengeUpdates(token, message => { if (visible() && message.raffle) receive(message.raffle); });
    const heartbeat = async (online = visible()) => {
      if (inFlight) return; inFlight = true;
      try { const result = await liveCommand<{ eligibleDays: number }>(token, "rafflePresence", { online }); if (active) setEligibleDays(result.eligibleDays); }
      catch { /* No speculative participation while the authenticated channel is unavailable. */ }
      finally { inFlight = false; }
    };
    const refresh = () => { if (visible()) void liveCommand<RaffleState>(token, "raffleState").then(receive).catch(() => raffleApi.state(token).then(receive).catch(() => {})); };
    void heartbeat(); refresh();
    const presenceTimer = setInterval(() => void heartbeat(), 10000);
    const fallbackTimer = setInterval(refresh, 20000);
    const subscription = AppState.addEventListener("change", value => { void heartbeat(value === "active"); if (value === "active") refresh(); });
    const visibility = () => { void heartbeat(); if (visible()) refresh(); };
    if (Platform.OS === "web") document.addEventListener("visibilitychange", visibility);
    return () => { active = false; unsubscribe(); clearInterval(presenceTimer); clearInterval(fallbackTimer); subscription.remove(); if (Platform.OS === "web") document.removeEventListener("visibilitychange", visibility); void raffleApi.presence(token, false).catch(() => {}); };
  }, [token]);
  const intervalMs = token && state?.event ? 200 : 1000;
  useEffect(() => { const timer = setInterval(() => setNow(Date.now() + offset.current), intervalMs); return () => clearInterval(timer); }, [intervalMs]);
  const connected = now - lastUpdate < 90000;
  const event = token ? state?.event : null;
  const locked = Boolean(token && !["admin", "owner", "manager"].includes(role ?? "user") && !pathname.startsWith("/admin") && pathname !== "/raffle" && connected && event?.locked);
  const paused = Boolean(token && !["admin", "owner", "manager"].includes(role ?? "user") && connected && event?.locked);
  return <PauseContext.Provider value={paused}><Context.Provider value={{ state: token ? state : null, now, connected, eligibleDays }}>
    {children}
    <Modal visible={locked} animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      {event && locked ? <RaffleStage event={event} now={now} eligibleDays={eligibleDays} /> : null}
    </Modal>
  </Context.Provider></PauseContext.Provider>;
}
