import { Layers, Crosshair, Plane, Ship, Satellite, Video, Activity, Flame, AlertTriangle } from "lucide-react";
import WorldMap from "../components/WorldMap";
import { useStore } from "../state/store";
import { Panel, Tag, Kv, Bar, Dot } from "../components/ui";
import type { LayerKey, Sel } from "../lib/types";
import { fmtCoord, agoLabel, fmtInt } from "../lib/geo";

const LAYERS: { k: LayerKey; label: string; tone: string; icon: any }[] = [
  { k: "flights", label: "ADS-B FLIGHTS", tone: "#4fd8eb", icon: Plane },
  { k: "ships", label: "AIS MARITIME", tone: "#45d0b8", icon: Ship },
  { k: "sats", label: "SAT TRACKS", tone: "#9d8cff", icon: Satellite },
  { k: "cams", label: "CCTV GRID", tone: "#ffb454", icon: Video },
  { k: "quakes", label: "SEISMIC", tone: "#ff5d5d", icon: Activity },
  { k: "conflicts", label: "CONFLICT ZONES", tone: "#ff5d5d", icon: Crosshair },
  { k: "fires", label: "WILDFIRE FRP", tone: "#ff8a3d", icon: Flame },
];

const WATCH_PRESET: Record<string, { entity: string; metric: string; op: string; threshold: number }> = {
  flights: { entity: "ADS-B", metric: "DEVIATION (NM)", op: "≥", threshold: 40 },
  ships: { entity: "AIS", metric: "DARK PERIOD (H)", op: "≥", threshold: 12 },
  sats: { entity: "SATELLITE", metric: "TASKING Δ (%)", op: "≥", threshold: 150 },
  cams: { entity: "CCTV", metric: "VIEWERS Δ (%)", op: "≥", threshold: 300 },
  quakes: { entity: "SEISMIC", metric: "MAGNITUDE", op: "≥", threshold: 5.5 },
  conflicts: { entity: "CONFLICT", metric: "INTENSITY", op: "≥", threshold: 80 },
  fires: { entity: "FIRMS", metric: "FRP (MW)", op: "≥", threshold: 1200 },
  uav: { entity: "UAS", metric: "BATTERY (%)", op: "≤", threshold: 25 },
};

export default function OpsView() {
  const { sim, layers, toggleLayer, sel, select, setView, setFocus, addRule, raiseAlert } = useStore();

  const counts: Record<LayerKey, number> = {
    flights: sim.flights.length, ships: sim.ships.length, sats: sim.sats.length,
    cams: sim.cams.filter((c) => c.online).length, quakes: sim.quakes.length,
    conflicts: sim.conflicts.length, fires: sim.fires.length,
  };

  const focusOn = (kind: Sel["kind"], id: string, lat: number, lon: number) => {
    select({ kind, id });
    setFocus({ lat, lon, k: 3.4 });
  };

  const selDetail = (() => {
    if (!sel) return null;
    if (sel.kind === "flights") { const f = sim.flights.find((x) => x.id === sel.id); if (!f) return null; return { title: f.cs, tone: "cy" as const, rows: [
      ["TYPE", f.type], ["ROUTE", `${f.from} → ${f.to}`], ["ALT", `${fmtInt(f.alt)} FT`], ["GS", `${Math.round(f.spd)} KT`],
      ["HDG", `${Math.round(f.hdg).toString().padStart(3, "0")}°`], ["POSITION", fmtCoord(f.lat, f.lon)], ["PROFILE", f.mil ? "MILITARY / STATE" : "CIVIL IFR"],
    ] as [string, string][] }; }
    if (sel.kind === "ships") { const sh = sim.ships.find((x) => x.id === sel.id); if (!sh) return null; return { title: sh.name, tone: "tl" as const, rows: [
      ["CLASS", sh.cls], ["FLAG", sh.flag], ["SOG", `${sh.spd.toFixed(1)} KN`], ["HDG", `${Math.round(sh.hdg)}°`],
      ["POSITION", fmtCoord(sh.lat, sh.lon)], ["STATUS", sh.name.includes("DARK") ? "AIS DARK — SANCTIONS SUSPECT" : "UNDERWAY"],
    ] as [string, string][] }; }
    if (sel.kind === "sats") { const sa = sim.sats.find((x) => x.id === sel.id); if (!sa) return null; return { title: sa.name, tone: "vio" as const, rows: [
      ["PAYLOAD", sa.kind], ["ALT", `${fmtInt(sa.altKm)} KM`], ["INCL", `${sa.inc.toFixed(1)}°`], ["SSP", fmtCoord(sa.lat, sa.lon)],
      ["NEXT PASS", `+${(sa.altKm % 17) + 4}M ${(sa.altKm % 50) + 10}S`],
    ] as [string, string][] }; }
    if (sel.kind === "cams") { const c = sim.cams.find((x) => x.id === sel.id); if (!c) return null; return { title: c.name, tone: "am" as const, rows: [
      ["REGION", c.region], ["STATUS", c.online ? `LIVE · ${c.fps} FPS` : "SIGNAL LOST"], ["VIEWERS", c.online ? fmtInt(c.viewers) : "—"],
      ["POSITION", fmtCoord(c.lat, c.lon)], ["UPLINK", c.online ? "RTSP OVER TLS" : "RECONNECTING"],
    ] as [string, string][] }; }
    if (sel.kind === "quakes") { const q = sim.quakes.find((x) => x.id === sel.id); if (!q) return null; return { title: `M${q.mag} — ${q.place}`, tone: "rd" as const, rows: [
      ["MAGNITUDE", `M${q.mag}`], ["DEPTH", `${q.depth} KM`], ["EPICENTER", fmtCoord(q.lat, q.lon)],
      ["EVENT AGE", agoLabel(q.age, sim.t)], ["TSUNAMI", q.mag >= 7 && q.depth < 70 ? "ADVISORY ACTIVE" : "NOT EXPECTED"],
    ] as [string, string][] }; }
    if (sel.kind === "conflicts") { const c = sim.conflicts.find((x) => x.id === sel.id); if (!c) return null; return { title: c.name, tone: "rd" as const, rows: [
      ["INTENSITY", `${c.intensity}/100 ${c.trend > 0 ? "▲ ESCALATING" : "▼ DE-ESCALATING"}`], ["FOOTPRINT", `~${c.rKm} KM RADIUS`],
      ["CENTER", fmtCoord(c.lat, c.lon)], ["SOURCES", "ACLED · TG · EO"],
    ] as [string, string][] }; }
    if (sel.kind === "fires") { const f = sim.fires.find((x) => x.id === sel.id); if (!f) return null; return { title: f.name, tone: "or" as const, rows: [
      ["RADIATIVE POWER", `${fmtInt(f.mw)} MW`], ["ACTIVE AREA", `${fmtInt(f.areaKm)} KM²`], ["CENTER", fmtCoord(f.lat, f.lon)], ["SOURCE", "NASA FIRMS / VIIRS"],
    ] as [string, string][] }; }
    if (sel.kind === "uav") { const u = sim.uavs.find((x) => x.id === sel.id); if (!u) return null; return { title: u.cs, tone: "gn" as const, rows: [
      ["MODE", u.mode], ["BATTERY", `${u.batt.toFixed(0)}%`], ["ALT", `${fmtInt(u.alt)} FT`], ["GS", `${Math.round(u.gs)} KT`],
      ["LINK", `${u.link.toFixed(0)}%`], ["WP", `${Math.min(u.wpIndex + 1, u.wps.length)}/${u.wps.length}`], ["POSITION", fmtCoord(u.lat, u.lon)],
    ] as [string, string][] }; }
    return null;
  })();

  return (
    <div className="flex-1 flex min-h-0 relative">
      {/* MAP */}
      <div className="flex-1 relative min-w-0 m-2 mr-0">
        <WorldMap />

        {/* layer stack */}
        <div className="absolute top-3 left-3 w-[196px]">
          <Panel title={<span className="flex items-center gap-1.5"><Layers size={11} /> INTELLIGENCE LAYERS</span>} pad={false}>
            <div className="py-1">
              {LAYERS.map(({ k, label, tone, icon: Icon }) => (
                <button key={k} onClick={() => toggleLayer(k)}
                  className={`w-full flex items-center gap-2 px-3 py-[5px] text-left transition-colors ${layers[k] ? "hover:bg-panel2" : "opacity-35 hover:opacity-60"}`}>
                  <span className="w-2 h-2 border" style={{ borderColor: tone, background: layers[k] ? tone : "transparent", boxShadow: layers[k] ? `0 0 7px ${tone}88` : "none" }} />
                  <Icon size={12} style={{ color: tone }} />
                  <span className="font-display text-[10px] font-semibold tracking-[0.12em] text-snow flex-1">{label}</span>
                  <span className="font-mono text-[10px] tabular" style={{ color: tone }}>{counts[k]}</span>
                </button>
              ))}
            </div>
          </Panel>

          <div className="mt-2 flex gap-1.5">
            {[
              { l: "FUSION", v: "ACTIVE", tone: "text-gn" },
              { l: "LATENCY", v: `${18 + (sim.t % 9)}ms`, tone: "text-cy" },
              { l: "EO COVER", v: "72%", tone: "text-am" },
            ].map((x) => (
              <div key={x.l} className="flex-1 bg-ink/80 border border-line px-2 py-1.5">
                <div className="font-mono text-[8px] text-dim tracking-[0.15em]">{x.l}</div>
                <div className={`font-mono text-[10.5px] tabular ${x.tone}`}>{x.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <aside className="w-[318px] shrink-0 m-2 flex flex-col gap-2 min-h-0 overflow-y-auto">
        {/* active alerts */}
        <Panel title={<span className="flex items-center gap-1.5 text-rd"><AlertTriangle size={11} /> ACTIVE ALERTS</span>}
          right={<Tag tone="rd">{sim.alerts.filter((a) => a.sev === "CRIT").length} CRIT</Tag>} pad={false}>
          <div className="max-h-[124px] overflow-y-auto">
            {sim.alerts.slice(0, 5).map((a) => (
              <div key={a.id} className="flex gap-2 px-3 py-1.5 border-b border-line/50 last:border-0 anim-fadeup">
                <Dot tone={a.sev === "CRIT" ? "bg-rd" : a.sev === "WARN" ? "bg-am" : "bg-cy"} blink={a.sev === "CRIT"} />
                <div className="min-w-0">
                  <div className="text-[10.5px] text-snow leading-snug truncate">{a.msg}</div>
                  <div className="font-mono text-[8.5px] text-dim tabular">{agoLabel(a.t, sim.t)} · {a.sev}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* selected target */}
        <Panel title="TARGET DOSSIER" right={sel ? <button onClick={() => select(null)} className="font-mono text-[9px] text-dim hover:text-rd">CLEAR ×</button> : undefined}>
          {!selDetail ? (
            <div className="py-4 text-center">
              <Crosshair size={20} className="mx-auto text-dim" />
              <p className="font-mono text-[10px] text-dim mt-2 leading-relaxed">NO TRACK SELECTED<br />click any marker on the map</p>
            </div>
          ) : (
            <div className="anim-fadeup">
              <div className={`font-display font-bold text-[14px] tracking-wide mb-2 ${{ cy: "text-cy", tl: "text-tl", vio: "text-vio", am: "text-am", rd: "text-rd", or: "text-or", gn: "text-gn" }[selDetail.tone]}`}>{selDetail.title}</div>
              {selDetail.rows.map(([k, v]) => <Kv key={k} k={k} v={v} />)}
              <div className="flex gap-2 mt-3">
                <button onClick={() => {
                  const p = WATCH_PRESET[sel!.kind];
                  addRule({ ...p, active: true });
                  raiseAlert("INFO", `Watch rule armed · ${p.entity} ${p.metric} ${p.op} ${p.threshold} (from dossier ${selDetail!.title})`);
                  setView("watch");
                }} className="flex-1 border border-line2 py-1.5 font-display text-[9.5px] font-semibold tracking-[0.15em] text-fog hover:text-cy hover:border-cy/50 transition-colors">+ WATCH</button>
                <button onClick={() => setView("feed")} className="flex-1 border border-line2 py-1.5 font-display text-[9.5px] font-semibold tracking-[0.15em] text-fog hover:text-cy hover:border-cy/50 transition-colors">CORRELATE</button>
              </div>
            </div>
          )}
        </Panel>

        {/* live tracks */}
        <Panel title="PRIORITY TRACKS" right={<Tag tone="cy">{counts.flights + counts.ships + counts.sats} FUSED</Tag>} pad={false}>
          <div>
            {sim.flights.slice(0, 4).map((f) => (
              <button key={f.id} onClick={() => focusOn("flights", f.id, f.lat, f.lon)}
                className="w-full flex items-center gap-2 px-3 py-[7px] border-b border-line/50 hover:bg-panel2 transition-colors text-left">
                <Plane size={12} className={f.mil ? "text-am" : "text-cy"} />
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[10.5px] text-snow tabular">{f.cs} <span className="text-dim">· FL{Math.round(f.alt / 100)}</span></div>
                  <div className="text-[9px] text-dim truncate">{f.from} → {f.to}</div>
                </div>
                <span className="font-mono text-[9px] text-fog tabular">{Math.round(f.spd)}kt</span>
              </button>
            ))}
            {sim.ships.slice(0, 2).map((sh) => (
              <button key={sh.id} onClick={() => focusOn("ships", sh.id, sh.lat, sh.lon)}
                className="w-full flex items-center gap-2 px-3 py-[7px] border-b border-line/50 hover:bg-panel2 transition-colors text-left">
                <Ship size={12} className={sh.name.includes("DARK") ? "text-rd" : "text-tl"} />
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[10.5px] text-snow truncate">{sh.name}</div>
                  <div className="text-[9px] text-dim truncate">{fmtCoord(sh.lat, sh.lon)}</div>
                </div>
                <span className="font-mono text-[9px] text-fog tabular">{sh.spd.toFixed(0)}kn</span>
              </button>
            ))}
            {sim.quakes.slice(0, 2).map((q) => (
              <button key={q.id} onClick={() => focusOn("quakes", q.id, q.lat, q.lon)}
                className="w-full flex items-center gap-2 px-3 py-[7px] border-b border-line/50 hover:bg-panel2 transition-colors text-left">
                <Activity size={12} className="text-rd" />
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[10.5px] text-snow tabular">M{q.mag} — {q.place}</div>
                  <div className="text-[9px] text-dim">{agoLabel(q.age, sim.t)} · {q.depth}km deep</div>
                </div>
              </button>
            ))}
          </div>
        </Panel>

        {/* infrastructure strip */}
        <Panel title="INFRASTRUCTURE · CCTV MESH" pad={false}>
          <div className="px-3 py-2">
            <div className="flex justify-between font-mono text-[9px] text-dim mb-1">
              <span>ONLINE {sim.cams.filter((c) => c.online).length}/14</span>
              <span>VIEWERS {fmtInt(sim.cams.reduce((a, c) => a + c.viewers, 0))}</span>
            </div>
            <Bar v={(sim.cams.filter((c) => c.online).length / sim.cams.length) * 100} tone="bg-am" />
            <div className="mt-2 flex justify-between font-mono text-[9px] text-dim">
              <span>UPTIME 99.2%</span>
              <span className={sim.cams.some((c) => !c.online) ? "text-rd anim-blink" : "text-gn"}>{sim.cams.some((c) => !c.online) ? "DEGRADED NODES" : "ALL NOMINAL"}</span>
            </div>
          </div>
        </Panel>
      </aside>
    </div>
  );
}
