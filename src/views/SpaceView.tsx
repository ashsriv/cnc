import { useEffect } from "react";
import { Satellite, Zap, Wind, ThermometerSun, Activity, Orbit } from "lucide-react";
import { useStore } from "../state/store";
import { Panel, Tag, Stat, Bar } from "../components/ui";
import { SOURCE_META } from "../lib/live";

function KpGauge({ kp }: { kp: number }) {
  const pct = Math.min(1, kp / 9);
  const ang = -110 + pct * 220;
  const color = kp >= 7 ? "#ff5d5d" : kp >= 5 ? "#ffb454" : "#4fd8eb";
  const ticks = Array.from({ length: 10 }, (_, i) => i);
  return (
    <div className="relative w-[200px] h-[118px] mx-auto">
      <svg viewBox="0 0 200 118" className="w-full h-full">
        <path d="M20 100 A80 80 0 1 1 180 100" fill="none" stroke="#1c2d42" strokeWidth="10" strokeLinecap="round" />
        <path d="M20 100 A80 80 0 1 1 180 100" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${pct * 251} 251`} opacity="0.9" />
        {ticks.map((i) => {
          const a = ((-110 + (i / 9) * 220) * Math.PI) / 180;
          const x1 = 100 + Math.sin(a) * 66, y1 = 100 - Math.cos(a) * 66;
          const x2 = 100 + Math.sin(a) * 58, y2 = 100 - Math.cos(a) * 58;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#54687e" strokeWidth="1.4" />;
        })}
        <g transform={`rotate(${ang} 100 100)`}>
          <line x1="100" y1="100" x2="100" y2="34" stroke={color} strokeWidth="2.4" />
        </g>
        <circle cx="100" cy="100" r="5" fill={color} />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <div className="font-display font-bold text-[26px] tabular leading-none" style={{ color }}>{kp.toFixed(2)}</div>
        <div className="font-mono text-[8.5px] text-dim tracking-[0.2em] mt-1">PLANETARY Kp</div>
      </div>
    </div>
  );
}

function FluxChart({ data }: { data: { t: string; flux: number }[] }) {
  if (data.length < 2) return null;
  const w = 260, h = 64;
  const logs = data.map((d) => Math.log10(Math.max(d.flux, 1e-9)));
  const min = Math.min(...logs), max = Math.max(...logs), span = max - min || 1;
  const pts = logs.map((v, i) => `${(i / (logs.length - 1)) * w},${h - ((v - min) / span) * (h - 8) - 3}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full" style={{ height: h }}>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill="#ffb454" opacity="0.12" />
      <polyline points={pts} fill="none" stroke="#ffb454" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
      {["A", "B", "C", "M", "X"].map((c, i) => {
        const lv = Math.log10(Math.pow(10, -8 + i));
        const y = h - ((lv - min) / span) * (h - 8) - 3;
        if (y < 2 || y > h - 2) return null;
        return <g key={c}><line x1="0" y1={y} x2={w} y2={y} stroke="#1c2d42" strokeWidth="0.6" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" /><text x={w - 10} y={y - 2} fontSize="7" fill="#54687e" fontFamily="IBM Plex Mono">{c}</text></g>;
      })}
    </svg>
  );
}

function WindChart({ data }: { data: { t: string; speed: number; density: number }[] }) {
  if (data.length < 2) return null;
  const w = 260, h = 64;
  const sp = data.map((d) => d.speed), dn = data.map((d) => d.density);
  const mk = (arr: number[]) => {
    const min = Math.min(...arr), max = Math.max(...arr), span = max - min || 1;
    return arr.map((v, i) => [ (i / (arr.length - 1)) * w, h - ((v - min) / span) * (h - 10) - 4 ]);
  };
  const spts = mk(sp), dpts = mk(dn);
  const toStr = (p: number[][]) => p.map(([x, y]) => `${x},${y}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full" style={{ height: h }}>
      <polyline points={toStr(dpts)} fill="none" stroke="#9d8cff" strokeWidth="1.1" vectorEffect="non-scaling-stroke" opacity="0.7" />
      <polyline points={toStr(spts)} fill="none" stroke="#45d0b8" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function SpaceView() {
  const { sim, spaceData, sources, setView, log } = useStore();
  useEffect(() => { log("[SPACE] solar weather console opened · NOAA SWPC uplink"); }, []); // eslint-disable-line

  const swpcMeta = SOURCE_META.find((m) => m.k === "SWPC");
  const state = sources.SWPC ?? "STANDBY";
  const liveSats = sim.sats.filter((s) => s.live).length;
  const d = spaceData;

  const stormTone = !d ? "fog" : d.storm.startsWith("G5") || d.storm.startsWith("G4") ? "rd" : d.storm.startsWith("G") || d.storm === "STORM WATCH" ? "am" : "gn";
  const flareTone = !d ? "fog" : d.flare.startsWith("X") ? "rd" : d.flare.startsWith("M") ? "am" : "cy";

  return (
    <div className="flex-1 flex min-h-0 gap-2 m-2">
      {/* left column */}
      <section className="w-[320px] shrink-0 flex flex-col gap-2 min-h-0 overflow-y-auto">
        <Panel title="GEOMAGNETIC CONDITIONS" right={<Tag tone={stormTone as any}>{d?.storm ?? "—"}</Tag>}>
          <KpGauge kp={d?.kpNow ?? 0} />
          <div className="mt-3 space-y-1">
            {[
              ["QUIET", 0, 4, "#55e09c"], ["UNSETTLED", 4, 5, "#4fd8eb"], ["ACTIVE", 5, 6, "#ffb454"],
              ["MINOR STORM", 6, 7, "#ff8a3d"], ["MAJOR+", 7, 9, "#ff5d5d"],
            ].map(([label, lo, hi, c]) => {
              const v = d?.kpNow ?? 0;
              const on = v >= (lo as number) && v < (hi as number);
              return (
                <div key={label as string} className={`flex items-center gap-2 px-2 py-1 border ${on ? "border-line2 bg-panel2/60" : "border-transparent opacity-40"}`}>
                  <span className="w-2 h-2" style={{ background: c as string }} />
                  <span className="font-mono text-[9.5px] tracking-[0.15em] text-snow flex-1">{label as string}</span>
                  <span className="font-mono text-[9px] text-dim tabular">Kp {lo as number}–{hi as number}</span>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="ORBITAL ASSETS IN SCOPE" right={<Tag tone="gn">{liveSats} TRACKED</Tag>}>
          <div className="flex items-center gap-3">
            <Orbit size={26} className="text-vio anim-pulse-soft" />
            <div className="flex-1">
              <div className="font-display font-bold text-[15px] text-snow">{liveSats} <span className="text-[10px] text-fog font-mono">live sats</span></div>
              <div className="font-mono text-[8.5px] text-dim">CelesTrak TLE · SGP4 propagated each second</div>
            </div>
          </div>
          <Bar v={Math.min(100, liveSats * 5)} tone="bg-vio" />
          <button onClick={() => setView("ops")} className="mt-2 w-full border border-line2 py-1.5 font-display text-[9.5px] font-semibold tracking-[0.15em] text-fog hover:text-vio hover:border-vio/50 transition-colors">
            VIEW GROUND TRACKS ON MAP →
          </button>
        </Panel>
      </section>

      {/* main column */}
      <section className="flex-1 min-w-0 flex flex-col gap-2 min-h-0 overflow-y-auto">
        <div className="grid grid-cols-4 gap-2">
          <Panel title="SOLAR X-RAY" pad={false} className="col-span-2"
            right={<Tag tone={flareTone as any}>{d?.flare ?? "—"}</Tag>}>
            <div className="p-3">
              <div className="flex items-end gap-2">
                <Zap size={16} className="text-am mb-1" />
                <span className="font-display font-bold text-[24px] tabular text-am leading-none">{d ? d.fluxNow.toExponential(1) : "—"}</span>
                <span className="font-mono text-[8.5px] text-dim mb-1">W/m² · 0.1–0.8 nm</span>
              </div>
              <div className="mt-2"><FluxChart data={d?.xray ?? []} /></div>
              <div className="font-mono text-[8px] text-dim mt-1 flex justify-between"><span>GOES · 5-MIN</span><span>LOG SCALE</span></div>
            </div>
          </Panel>

          <Panel title="SOLAR WIND" pad={false} className="col-span-2">
            <div className="p-3">
              <div className="flex items-end gap-4">
                <div><div className="flex items-center gap-1.5"><Wind size={14} className="text-tl" /><span className="font-display font-bold text-[22px] tabular text-tl leading-none">{d ? Math.round(d.speedNow) : "—"}</span><span className="font-mono text-[8px] text-dim mb-0.5">km/s</span></div></div>
                <div><span className="font-display font-bold text-[16px] tabular text-vio">{d && d.wind.length ? d.wind[d.wind.length - 1].density.toFixed(1) : "—"}</span><span className="font-mono text-[8px] text-dim ml-1">p/cm³</span></div>
              </div>
              <div className="mt-2"><WindChart data={d?.wind ?? []} /></div>
              <div className="font-mono text-[8px] text-dim mt-1 flex justify-between"><span><span className="text-tl">— SPEED</span> · <span className="text-vio">— DENSITY</span></span><span>DSCOVR · 2-HR</span></div>
            </div>
          </Panel>
        </div>

        <Panel title="Kp INDEX · 3-DAY HISTORY" pad={false} right={<Tag tone="fog">{swpcMeta?.feed}</Tag>}>
          <div className="p-3 flex items-end gap-[3px] h-[110px]">
            {(d?.kp ?? []).map((k, i) => {
              const h = 6 + (k.kp / 9) * 90;
              const c = k.kp >= 7 ? "#ff5d5d" : k.kp >= 5 ? "#ffb454" : "#4fd8eb";
              return (
                <div key={i} className="flex-1 group relative flex items-end h-full">
                  <div className="w-full transition-all duration-300 group-hover:opacity-100 opacity-80" style={{ height: h, background: c }} />
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 font-mono text-[7.5px] text-fog opacity-0 group-hover:opacity-100 tabular">{k.kp.toFixed(1)}</span>
                </div>
              );
            })}
            {!d?.kp?.length && <div className="w-full text-center font-mono text-[10px] text-dim self-center">AWAITING SWPC FEED…</div>}
          </div>
        </Panel>

        <div className="grid grid-cols-3 gap-2">
          <Panel title="IMPACT WATCH"><div className="space-y-2">
            {[
              ["HF RADIO BLACKOUT", flareTone === "rd" ? 90 : flareTone === "am" ? 55 : 12, "bg-rd"],
              ["GPS DEGRADATION", (d?.kpNow ?? 0) * 11, "bg-am"],
              ["AURORA / GIC RISK", Math.min(100, (d?.kpNow ?? 0) * 13), "bg-vio"],
              ["SAT DRAG / DECAY", Math.min(100, ((d?.speedNow ?? 0) - 300) / 4), "bg-cy"],
            ].map(([label, v, c]) => (
              <div key={label as string}>
                <div className="flex justify-between font-mono text-[8.5px] mb-1"><span className="text-dim">{label as string}</span><span className="text-fog tabular">{Math.max(0, Math.min(100, v as number)).toFixed(0)}%</span></div>
                <Bar v={v as number} tone={c as string} />
              </div>
            ))}
          </div></Panel>

          <Panel title="SOURCE STATUS">
            <div className="space-y-2">
              {[["SWPC", state], ["CELESTRAK", sources.CELESTRAK ?? "—"]].map(([k, s]) => (
                <div key={k} className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-snow">{k}</span>
                  <Tag tone={s === "LIVE" ? "gn" : s === "CONNECTING" ? "am" : "fog"}>{s}</Tag>
                </div>
              ))}
              <p className="font-mono text-[8.5px] text-dim leading-relaxed pt-1">All solar data is genuine NOAA SWPC telemetry, keyless. Impact estimates are heuristic.</p>
            </div>
          </Panel>

          <Panel title="LATEST KP SAMPLES" pad={false}>
            <div className="max-h-[140px] overflow-y-auto">
              {(d?.kp ?? []).slice(-8).reverse().map((k, i) => (
                <div key={i} className="flex justify-between px-3 py-1 border-b border-line/50 last:border-0">
                  <span className="font-mono text-[9px] text-dim tabular">{k.t.replace("T", " ").slice(0, 16)}Z</span>
                  <span className="font-mono text-[10px] tabular" style={{ color: k.kp >= 7 ? "#ff5d5d" : k.kp >= 5 ? "#ffb454" : "#4fd8eb" }}>{k.kp.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}
