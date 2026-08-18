import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { SimState, View, LayerKey, Sel, UavMode, Waypoint, Rally, WatchRule, Alert, SourceKey, SourceState, Ship, Flight, FeedTelemetry } from "../lib/types";
import { initSim, stepSim } from "../lib/sim";
import { hexId } from "../lib/geo";
import { initState, fetchQuakes, fetchFires, fetchNews, fetchFlights, fetchAdlFlights, fetchSatRecs, propagateSats, type SatRec } from "../lib/live";
import { loadVault, saveVault } from "../services/vault";

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
  sources: Record<SourceKey, SourceState>;
  setSource: (k: SourceKey, v: SourceState) => void;
  feedTelemetry: Record<string, FeedTelemetry>;
  aisKey: string; saveAisKey: (k: string) => void;
  aisRegions: string[]; toggleAisRegion: (r: string) => void;
  settingsOpen: boolean; setSettingsOpen: (v: boolean) => void;
}

const Ctx = createContext<Store | null>(null);

const DEFAULT_LAYERS: Record<LayerKey, boolean> = {
  flights: true, ships: true, sats: true, cams: true,
  quakes: true, conflicts: true, fires: true,
};

export const AIS_REGIONS: Record<string, { label: string; box: string }> = {
  MED: { label: "MEDITERRANEAN", box: "[[30,-6],[46,36]]" },
  ARABIAN_SEA: { label: "ARABIAN SEA", box: "[[5,55],[25,75]]" },
  BAY_OF_BENGAL: { label: "BAY OF BENGAL", box: "[[5,78],[22,97]]" },
  SCS: { label: "SOUTH CHINA SEA", box: "[[2,100],[22,120]]" },
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [sim, setSim] = useState<SimState>(() => {
    const base = initSim();
    const v = loadVault();
    if (v) {
      if (Array.isArray(v.rules) && v.rules.length) base.rules = v.rules.slice(0, 40);
      if (Array.isArray(v.alerts) && v.alerts.length) base.alerts = v.alerts.slice(0, 40);
      if (typeof v.geofenceR === "number" && v.geofenceR >= 100) base.geofenceR = v.geofenceR;
      base.logs = [...base.logs, `[VAULT] session restored · ${v.rules?.length ?? 0} rules · ${v.alerts?.length ?? 0} alerts · geofence ${base.geofenceR}km`];
    }
    return base;
  });
  const [view, setView] = useState<View>("ops");
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [sel, setSel] = useState<Sel | null>(null);
  const [threat, setThreat] = useState(() => loadVault()?.threat ?? 1);
  const [uavSel, setUavSel] = useState("UA01");
  const [focus, setFocus] = useState<{ lat: number; lon: number; k: number } | null>(null);
  const [sources, setSources] = useState<Record<SourceKey, SourceState>>(initState);
  const simRef = useRef(sim);
  simRef.current = sim;
  const srcRef = useRef(sources);
  srcRef.current = sources;
  const recsRef = useRef<SatRec[] | null>(null);

  /* ---------------- feed supervisor (backend telemetry tier) ---------------- */
  const [feedTelemetry, setFeedTelemetry] = useState<Record<string, FeedTelemetry>>({});
  const reportFeed = (k: SourceKey, msgs: number, lat: number, ok: boolean) =>
    setFeedTelemetry((p) => ({
      ...p,
      [k]: {
        msgs: (p[k]?.msgs ?? 0) + (ok ? msgs : 0),
        lat: ok ? Math.round(lat) : p[k]?.lat ?? 0,
        ok,
      },
    }));

  /** union live flights from multiple feeds, dedup by hex, prune stale, backfill if thin */
  const mergeFlights = (fresh: Flight[], prev: Flight[]) => {
    const now = Date.now();
    const map = new Map<string, Flight>();
    for (const f of prev) if (f.live && (!f.seen || now - f.seen < 75000)) map.set(f.id.toLowerCase(), f);
    for (const f of fresh) map.set(f.id.toLowerCase(), f);
    if (map.size === 0) return prev;
    const live = Array.from(map.values()).slice(0, 280);
    if (live.length < 30) {
      const synth = prev.filter((f) => !f.live).slice(0, 30 - live.length);
      return [...live, ...synth];
    }
    return live;
  };

  const mutateSim = (fn: (s: SimState) => SimState) => setSim((s) => fn(s));
  const logLine = (line: string) => mutateSim((s) => ({ ...s, logs: [...s.logs, line].slice(-70) }));

  const setSource = (k: SourceKey, v: SourceState) => {
    if (srcRef.current[k] === v) return;
    setSources((prev) => ({ ...prev, [k]: v }));
    if (v === "LIVE") logLine(`[LINK] ${k} uplink established · real-time ingest active`);
    else if (v === "SIM") logLine(`[LINK] ${k} unreachable · synthetic fallback engaged`);
  };

  /* ---------------- core 1 Hz simulation + live SGP4 propagation ---------------- */
  useEffect(() => {
    const id = window.setInterval(() => {
      setSim((s) => stepSim(s));
      if (recsRef.current?.length) {
        const live = propagateSats(recsRef.current, new Date());
        if (live.length) setSim((s) => ({ ...s, sats: live }));
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  /* ---------------- live pipelines ---------------- */
  useEffect(() => {
    let stop = false;

    // USGS seismic — every 2 min
    const usgs = async () => {
      try {
        const t0 = performance.now();
        const list = await fetchQuakes();
        if (stop) return;
        reportFeed("USGS", list.length, performance.now() - t0, true);
        setSim((s) => ({
          ...s,
          quakes: [
            ...list.map((q) => ({ ...q, age: s.t - Math.floor((q as any).elapsedMs / 2000) })),
            ...s.quakes.filter((q) => !q.live),
          ].slice(0, 15),
        }));
        setSource("USGS", "LIVE");
      } catch { if (!stop) { reportFeed("USGS", 0, 0, false); setSource("USGS", "SIM"); } }
    };

    // NASA EONET wildfires — every 3 min
    const eonet = async () => {
      try {
        const t0 = performance.now();
        const list = await fetchFires();
        if (stop) return;
        reportFeed("EONET", list.length, performance.now() - t0, true);
        setSim((s) => ({ ...s, fires: [...list, ...s.fires.filter((f) => !f.live)].slice(0, 14) }));
        setSource("EONET", "LIVE");
      } catch { if (!stop) { reportFeed("EONET", 0, 0, false); setSource("EONET", "SIM"); } }
    };

    // GDELT news wire — every 100 s
    const gdelt = async () => {
      try {
        const t0 = performance.now();
        const list = await fetchNews(simRef.current.t);
        if (stop) return;
        reportFeed("GDELT", list.length, performance.now() - t0, true);
        setSim((s) => ({ ...s, news: [...list, ...s.news.filter((n) => !n.live)].slice(0, 60) }));
        setSource("GDELT", "LIVE");
      } catch { if (!stop) { reportFeed("GDELT", 0, 0, false); setSource("GDELT", "SIM"); } }
    };

    // airplanes.live re-api — PRIMARY ADS-B feed (India + EU boxes), every 15 s
    const adl = async () => {
      try {
        const t0 = performance.now();
        const list = await fetchAdlFlights();
        if (stop) return;
        reportFeed("ADL", list.length, performance.now() - t0, true);
        setSim((s) => ({ ...s, flights: mergeFlights(list, s.flights) }));
        setSource("ADL", "LIVE");
      } catch { if (!stop) { reportFeed("ADL", 0, 0, false); setSource("ADL", "SIM"); } }
    };

    // OpenSky ADS-B — redundant corroboration feed, every 60 s
    const opensky = async () => {
      try {
        const t0 = performance.now();
        const list = await fetchFlights();
        if (stop) return;
        reportFeed("OPENSKY", list.length, performance.now() - t0, true);
        setSim((s) => ({ ...s, flights: mergeFlights(list, s.flights) }));
        setSource("OPENSKY", "LIVE");
      } catch { if (!stop) { reportFeed("OPENSKY", 0, 0, false); setSource("OPENSKY", "SIM"); } }
    };

    // CelesTrak TLEs — once
    const tle = async () => {
      try {
        const recs = await fetchSatRecs();
        if (stop) return;
        recsRef.current = recs;
        setSource("CELESTRAK", "LIVE");
      } catch { if (!stop) setSource("CELESTRAK", "SIM"); }
    };

    usgs(); eonet(); gdelt(); tle();
    setTimeout(adl, 1200);
    setTimeout(opensky, 30000);
    const ids = [
      window.setInterval(usgs, 120000),
      window.setInterval(eonet, 180000),
      window.setInterval(gdelt, 100000),
      window.setInterval(adl, 15000),
      window.setInterval(opensky, 60000),
    ];
    return () => { stop = true; ids.forEach(clearInterval); };
  }, []);

  /* ---------------- persistence vault — rules / alerts / config survive reloads ---------------- */
  useEffect(() => {
    const id = window.setTimeout(() => {
      saveVault({ rules: sim.rules, alerts: sim.alerts, geofenceR: sim.geofenceR, threat });
    }, 350);
    return () => window.clearTimeout(id);
  }, [sim.rules, sim.alerts, sim.geofenceR, threat]);

  /* ---------------- AISStream WebSocket (operator-supplied key) ---------------- */
  const [aisKey, setAisKey] = useState(() => localStorage.getItem("aegis_ais_key") ?? "");
  const [aisRegions, setAisRegions] = useState<string[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem("aegis_ais_regions") ?? "null");
      return Array.isArray(v) && v.length ? v : ["MED", "ARABIAN_SEA"];
    } catch { return ["MED", "ARABIAN_SEA"]; }
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const liveShips = useRef(new Map<string, Ship>());
  const dirtyRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);

  const saveAisKey = (k: string) => {
    const v = k.trim();
    setAisKey(v);
    if (v) localStorage.setItem("aegis_ais_key", v);
    else { localStorage.removeItem("aegis_ais_key"); liveShips.current.clear(); dirtyRef.current = true; }
    logLine(v ? "[AIS] operator key stored (browser-local) — reconnecting uplink" : "[AIS] key cleared — reverting to synthetic AIS");
  };
  const toggleAisRegion = (r: string) => setAisRegions((rs) => {
    const n = rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r];
    localStorage.setItem("aegis_ais_regions", JSON.stringify(n));
    return n;
  });

  useEffect(() => {
    if (!aisKey || aisRegions.length === 0) { setSource("AISSTREAM", "STANDBY"); return; }
    let closed = false; let retries = 0;
    const boxes = aisRegions.map((r) => AIS_REGIONS[r].box).join(",");
    const url = `wss://stream.aisstream.io/v0/ws?apikey=${encodeURIComponent(aisKey)}&bbox=${encodeURIComponent(`[${boxes}]`)}&filterMessageTypes=${encodeURIComponent('["PositionReport","ClassBCSPositionReport"]')}`;
    const connect = () => {
      if (closed) return;
      setSource("AISSTREAM", "CONNECTING");
      let ws: WebSocket;
      try { ws = new WebSocket(url); } catch { setSource("AISSTREAM", "ERROR"); return; }
      wsRef.current = ws;
      ws.onopen = () => { if (!closed) { retries = 0; setSource("AISSTREAM", "LIVE"); logLine("[AIS] AISSTREAM uplink established — position reports streaming"); } };
      ws.onmessage = (ev) => {
        try {
          const m = JSON.parse(ev.data);
          const pr = m?.Message?.PositionReport ?? m?.Message?.ClassBCSPositionReport;
          const md = m?.MetaData;
          if (!pr || !md || md.Latitude == null || md.Longitude == null) return;
          const name = String(md.ShipName ?? "").replace(/[^\x20-\x7E]/g, "").trim() || `MMSI ${md.MMSI}`;
          const sog = typeof pr.Sog === "number" ? pr.Sog / 10 : 0;
          const cog = typeof pr.Cog === "number" && pr.Cog <= 3600 ? pr.Cog / 10 : 0;
          const hdg = typeof pr.TrueHeading === "number" && pr.TrueHeading <= 359 ? pr.TrueHeading : cog;
          const id = `ais-${md.MMSI}`;
          liveShips.current.delete(id);
          liveShips.current.set(id, { id, name, cls: "AIS LIVE", lat: +md.Latitude, lon: +md.Longitude, spd: sog, hdg, flag: "—", live: true, mmsi: +md.MMSI });
          if (liveShips.current.size > 240) {
            const first = liveShips.current.keys().next().value;
            if (first) liveShips.current.delete(first);
          }
          dirtyRef.current = true;
        } catch { /* ignore malformed frames */ }
      };
      ws.onclose = () => {
        if (closed) return;
        retries++;
        if (retries <= 2) setTimeout(connect, 4000);
        else { setSource("AISSTREAM", "ERROR"); logLine("[AIS] AISSTREAM link lost — synthetic fallback engaged"); }
      };
      ws.onerror = () => ws.close();
    };
    connect();
    return () => { closed = true; wsRef.current?.close(); };
  }, [aisKey, aisRegions]);

  // flush live AIS positions into the sim on a slow cadence
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      setSim((s) => ({ ...s, ships: [...s.ships.filter((x) => !x.live), ...Array.from(liveShips.current.values())] }));
    }, 1500);
    return () => window.clearInterval(id);
  }, []);

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
    sources, setSource,
    feedTelemetry,
    aisKey, saveAisKey, aisRegions, toggleAisRegion, settingsOpen, setSettingsOpen,
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
          const last = u.wps[u.wps.length - 1] ?? { lat: u.home[0], lon: u.home[1], alt: 10000, spd: 120, action: "SURVEY" };
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
    log: logLine,
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
