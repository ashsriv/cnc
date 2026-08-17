import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { SimState, View, LayerKey, Sel, UavMode, Waypoint, Rally, WatchRule, Alert } from "../lib/types";
import { initSim, stepSim } from "../lib/sim";
import { hexId } from "../lib/geo";

interface Store {
  sim: SimState;
  view: View; setView: (v: View) => void;
  layers: Record<LayerKey, boolean>; toggleLayer: (k: LayerKey) => void;
  sel: Sel | null; select: (s: Sel | null) => void;
  threat: number; setThreat: (n: number) => void;
  geofenceR: number; setGeofenceR: (n: number) => void;
  uavCmd: (id: string, cmd: UavMode | "DISARM" | "LAUNCH") => void;
  uavSel: string; setUavSel: (id: string) => void;
  updateWp: (uavId: string, idx: number, patch: Partial<Waypoint>) => void;
  addWp: (uavId: string) => void;
  removeWp: (uavId: string, idx: number) => void;
  updateRally: (uavId: string, idx: number, patch: Partial<Rally>) => void;
  addRule: (r: Omit<WatchRule, "id" | "triggered">) => void;
  toggleRule: (id: string) => void;
  log: (line: string) => void;
  raiseAlert: (sev: Alert["sev"], msg: string) => void;
  focus: { lat: number; lon: number; k: number } | null; setFocus: (f: { lat: number; lon: number; k: number } | null) => void;
}

const Ctx = createContext<Store | null>(null);

const DEFAULT_LAYERS: Record<LayerKey, boolean> = {
  flights: true, ships: true, sats: true, cams: true,
  quakes: true, conflicts: true, fires: true,
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [sim, setSim] = useState<SimState>(() => initSim());
  const [view, setView] = useState<View>("ops");
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [sel, setSel] = useState<Sel | null>(null);
  const [threat, setThreat] = useState(1);
  const [uavSel, setUavSel] = useState("UA01");
  const [focus, setFocus] = useState<{ lat: number; lon: number; k: number } | null>(null);
  const simRef = useRef(sim);
  simRef.current = sim;

  useEffect(() => {
    const id = window.setInterval(() => setSim((s) => stepSim(s)), 1000);
    return () => window.clearInterval(id);
  }, []);

  const mutateSim = (fn: (s: SimState) => SimState) => setSim((s) => fn(s));

  const store: Store = {
    sim, view, setView,
    layers,
    toggleLayer: (k) => setLayers((l) => ({ ...l, [k]: !l[k] })),
    sel, select: setSel,
    threat, setThreat,
    geofenceR: sim.geofenceR,
    setGeofenceR: (n) => mutateSim((s) => ({ ...s, geofenceR: n })),
    uavSel, setUavSel,
    focus, setFocus,
    uavCmd: (id, cmd) =>
      mutateSim((s) => ({
        ...s,
        uavs: s.uavs.map((u) => {
          if (u.id !== id) return u;
          const n = { ...u };
          if (cmd === "LAUNCH") { if (n.mode === "ARMED" || n.mode === "STANDBY") { n.mode = "AUTO"; n.wpIndex = 0; } }
          else if (cmd === "DISARM") { n.mode = "STANDBY"; n.wpIndex = 0; n.lat = n.home[0]; n.lon = n.home[1]; n.alt = 0; n.gs = 0; }
          else n.mode = cmd;
          return n;
        }),
        logs: [...s.logs, `[CMD] ${id} ← ${cmd} · operator OP-7`].slice(-70),
      })),
    updateWp: (uavId, idx, patch) =>
      mutateSim((s) => ({
        ...s,
        uavs: s.uavs.map((u) => u.id !== uavId ? u : {
          ...u, wps: u.wps.map((w, i) => (i === idx ? { ...w, ...patch } : w)),
        }),
      })),
    addWp: (uavId) =>
      mutateSim((s) => ({
        ...s,
        uavs: s.uavs.map((u) => {
          if (u.id !== uavId) return u;
          const last = u.wps[u.wps.length - 1] ?? { lat: u.home[0], lon: u.home[1], alt: 10000, spd: 120 };
          return { ...u, wps: [...u.wps, { lat: +(last.lat + 0.35).toFixed(2), lon: +(last.lon + 0.4).toFixed(2), alt: last.alt, spd: last.spd, action: "SURVEY" }] };
        }),
      })),
    removeWp: (uavId, idx) =>
      mutateSim((s) => ({
        ...s,
        uavs: s.uavs.map((u) => {
          if (u.id !== uavId || u.wps.length <= 2) return u;
          return { ...u, wps: u.wps.filter((_, i) => i !== idx), wpIndex: Math.min(u.wpIndex, u.wps.length - 2) };
        }),
      })),
    updateRally: (uavId, idx, patch) =>
      mutateSim((s) => ({
        ...s,
        uavs: s.uavs.map((u) => u.id !== uavId ? u : {
          ...u, rally: u.rally.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
        }),
      })),
    addRule: (r) =>
      mutateSim((s) => ({
        ...s,
        rules: [...s.rules, { ...r, id: `WR${hexId(3).toUpperCase()}`, triggered: false }],
        logs: [...s.logs, `[WATCH] rule armed · ${r.entity} ${r.metric} ${r.op} ${r.threshold}`].slice(-70),
      })),
    toggleRule: (id) =>
      mutateSim((s) => ({ ...s, rules: s.rules.map((r) => (r.id === id ? { ...r, active: !r.active } : r)) })),
    log: (line) => mutateSim((s) => ({ ...s, logs: [...s.logs, line].slice(-70) })),
    raiseAlert: (sev, msg) =>
      mutateSim((s) => ({
        ...s,
        alerts: [{ id: `AL${s.t}${hexId(2)}`, t: s.t, sev, msg }, ...s.alerts].slice(0, 40),
      })),
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("store missing");
  return s;
}
