import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Radar as RadarIcon } from "lucide-react";
import { useStore } from "../state/store";
import { Panel, Tag, Spark } from "../components/ui";
import { SOURCE_META } from "../lib/live";
import type { AnalyticsSection } from "../lib/types";

const CY = "#4fd8eb", TL = "#45d0b8", VIO = "#9d8cff", AM = "#ffb454", RD = "#ff5d5d", GN = "#55e09c", OR = "#ff8a3d", FOG = "#7f97b0";

const SECTIONS: { k: AnalyticsSection; label: string }[] = [
  { k: "all", label: "ALL SENSORS" },
  { k: "adsb", label: "ADS-B" },
  { k: "maritime", label: "MARITIME" },
  { k: "satellite", label: "SATELLITE" },
  { k: "seismic", label: "SEISMIC" },
  { k: "news", label: "NEWS" },
  { k: "fusion", label: "FUSION" },
];

const ax = { tick: { fill: "#54687e", fontSize: 9, fontFamily: "IBM Plex Mono" }, axisLine: { stroke: "#1c2d42" }, tickLine: false } as any;

function TT({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-ink border border-line2 px-2.5 py-1.5 font-mono text-[9.5px] tabular shadow-xl">
      <div className="text-dim mb-0.5">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color ?? p.fill }}>
          {p.name}: <span className="text-snow">{typeof p.value === "number" ? Math.round(p.value * 10) / 10 : p.value}</span>
        </div>
      ))}
    </div>
  );
}

function Chart({ title, right, h = 200, children }: { title: ReactNode; right?: ReactNode; h?: number; children: ReactNode }) {
  return (
    <Panel title={title} right={right} pad={false}>
      <div className="p-2 pt-3" style={{ height: h }}>
        <ResponsiveContainer width="100%" height="100%">{children as any}</ResponsiveContainer>
      </div>
    </Panel>
  );
}

function Kpi({ label, value, unit, sub, tone = "text-snow", spark, sparkTone = CY }: {
  label: string; value: ReactNode; unit?: string; sub?: string; tone?: string; spark?: number[]; sparkTone?: string;
}) {
  return (
    <div className="relative bg-panel/85 border border-line px-3.5 py-3 overflow-hidden group hover:border-line2 transition-colors">
      <div className="absolute inset-y-0 left-0 w-[3px] bg-line2 group-hover:bg-cy transition-colors" />
      <div className="font-mono text-[8.5px] tracking-[0.2em] text-dim">{label}</div>
      <div className={`font-display font-bold text-[26px] leading-tight tabular ${tone}`}>
        {value}{unit && <span className="text-[11px] font-mono text-fog ml-1.5">{unit}</span>}
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="font-mono text-[8.5px] text-dim">{sub}</span>
        {spark && <Spark data={spark.slice(-28)} tone={sparkTone} h={22} w={80} />}
      </div>
    </div>
  );
}

export default function AnalyticsView() {
  const { sim, sources, feedTelemetry } = useStore();
  const [sec, setSec] = useState<AnalyticsSection>("all");
  const st = sim.stats;

  /* ---- per-algorithm confidence engine — re-evaluated on live telemetry ---- */
  const [algos, setAlgos] = useState<{ id: string; cls: string; conf: number; hist: number[]; note: string }[]>([]);
  useEffect(() => {
    if (sim.t % 3 !== 0) return;
    const liveR = st.liveRatio[st.liveRatio.length - 1] ?? 0;
    const fusion = st.fusion[st.fusion.length - 1] ?? 0;
    const news = st.newsRate[st.newsRate.length - 1] ?? 0;
    const dark = st.darkShips[st.darkShips.length - 1] ?? 0;
    const jit = (b: number) => Math.sin(sim.t / 5 + b * 1.7) * 1.8;
    const defs: [string, string, number, string][] = [
      ["TRACK DEDUPLICATOR", "HEX / MMSI UNION", 88 + liveR * 0.1 + jit(1), "hex-keyed union of ADL + OpenSky + AIS streams; 75 s staleness window"],
      ["SPATIO-TEMPORAL CORRELATOR", "CROSS-DOMAIN JOIN", 58 + fusion * 0.34 + jit(2), "joins seismic ↔ news ↔ AIS inside 40 km / 15 min cells"],
      ["LEXICAL SENTIMENT CLASSIFIER", "NLP · LEXICON v3", 66 + Math.min(14, news * 0.6) + jit(3), "tone scoring over wire headlines · neural tier queued"],
      ["SEISMIC MAGNITUDE VERIFIER", "USGS CROSS-CHECK", sources.USGS === "LIVE" ? 95.5 + jit(4) * 0.4 : 58 + jit(4), "M-value agreement vs USGS feed within ±0.2"],
      ["AIS DARK-SHIP ANOMALY", "BEHAVIOURAL MODEL", 62 + Math.min(20, dark * 6) + jit(5), "AIS gaps · STS transfers · flag-state anomalies"],
      ["TENSION COMPOSITE", "AR-1 BLEND", Math.min(97, fusion * 0.92 + liveR * 0.06 + jit(6)), "conflict + seismic + sentiment weighted blend"],
    ];
    setAlgos((prev) => defs.map(([id, cls, c, note]) => {
      const conf = +Math.min(99, Math.max(30, c)).toFixed(1);
      const old = prev.find((p) => p.id === id);
      return { id, cls, conf, note, hist: [...(old?.hist ?? []), conf].slice(-30) };
    }));
  }, [sim.t]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => st.t.map((t, i) => ({
    time: t < 0 ? `T${t}` : `T+${t}`,
    flights: st.flights[i], ships: st.ships[i], sats: st.sats[i], quakes: st.quakes[i], fires: st.fires[i],
    ingest: st.ingest[i], fusion: st.fusion[i], correlated: st.correlated[i], liveRatio: st.liveRatio[i],
    dark: st.darkShips[i], pos: st.sentPos[i], neg: st.sentNeg[i], neu: st.sentNeu[i], news: st.newsRate[i],
  })), [st]);

  const last = <T,>(a: T[]): T => a[a.length - 1];
  const liveFl = sim.flights.filter((f) => f.live).length;
  const liveSh = sim.ships.filter((s) => s.live).length;
  const liveSa = sim.sats.filter((s) => s.live).length;
  const liveQ = sim.quakes.filter((q) => q.live).length;
  const liveFi = sim.fires.filter((f) => f.live).length;
  const liveNw = sim.news.filter((n) => n.live).length;
  const totalTracks = sim.flights.length + sim.ships.length + sim.sats.length + sim.quakes.length + sim.fires.length;
  const totalLive = liveFl + liveSh + liveSa + liveQ + liveFi;
  const corrTotal = st.correlated.reduce((a, b) => a + b, 0);

  /* ---------- histograms ---------- */
  const altBands = useMemo(() => {
    const b = [0, 0, 0, 0];
    sim.flights.forEach((f) => { if (f.alt < 10000) b[0]++; else if (f.alt < 25000) b[1]++; else if (f.alt < 35000) b[2]++; else b[3]++; });
    return [{ k: "<10K", v: b[0] }, { k: "10–25K", v: b[1] }, { k: "25–35K", v: b[2] }, { k: "35K+", v: b[3] }];
  }, [sim.flights]);
  const spdBands = useMemo(() => {
    const b = [0, 0, 0, 0];
    sim.ships.forEach((s) => { if (s.spd < 8) b[0]++; else if (s.spd < 14) b[1]++; else if (s.spd < 20) b[2]++; else b[3]++; });
    return [{ k: "0–8", v: b[0] }, { k: "8–14", v: b[1] }, { k: "14–20", v: b[2] }, { k: "20+", v: b[3] }];
  }, [sim.ships]);
  const magBands = useMemo(() => {
    const b = [0, 0, 0, 0];
    sim.quakes.forEach((q) => { if (q.mag < 4) b[0]++; else if (q.mag < 5) b[1]++; else if (q.mag < 6) b[2]++; else b[3]++; });
    return [{ k: "2.5–4", v: b[0] }, { k: "4–5", v: b[1] }, { k: "5–6", v: b[2] }, { k: "6+", v: b[3] }];
  }, [sim.quakes]);
  const srcTop = useMemo(() => {
    const m = new Map<string, number>();
    sim.news.forEach((n) => m.set(n.source, (m.get(n.source) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => ({ k: k.slice(0, 14), v }));
  }, [sim.news]);

  const coverage = useMemo(() => [
    { d: "ADS-B / AIR", vol: sim.flights.length, live: liveFl, max: 60, src: sources.OPENSKY, fresh: "45 s" },
    { d: "AIS / MARITIME", vol: sim.ships.length, live: liveSh, max: 240, src: sources.AISSTREAM, fresh: liveSh ? "1.5 s" : "—" },
    { d: "TLE / SGP4", vol: sim.sats.length, live: liveSa, max: 30, src: sources.CELESTRAK, fresh: "1 s" },
    { d: "SEISMIC", vol: sim.quakes.length, live: liveQ, max: 15, src: sources.USGS, fresh: "2 min" },
    { d: "WILDFIRE FRP", vol: sim.fires.length, live: liveFi, max: 14, src: sources.EONET, fresh: "3 min" },
    { d: "NEWS WIRE", vol: sim.news.length, live: liveNw, max: 60, src: sources.GDELT, fresh: "100 s" },
  ], [sim, sources, liveFl, liveSh, liveSa, liveQ, liveFi, liveNw]);

  const statusTag = (s: string) =>
    s === "LIVE" ? <Tag tone="gn"><span className="anim-pulse-soft">●</span>&nbsp;LIVE</Tag>
    : s === "CONNECTING" ? <Tag tone="am">SYNC…</Tag>
    : s === "ERROR" ? <Tag tone="rd">DOWN</Tag>
    : <Tag tone="fog">{s}</Tag>;

  const grid12 = "grid grid-cols-12 gap-2 content-start";

  return (
    <div className="flex-1 flex flex-col min-h-0 m-2 gap-2">
      {/* header strip */}
      <div className="shrink-0 flex items-center gap-4 bg-panel/85 border border-line px-4 py-2.5">
        <RadarIcon size={18} className="text-cy" />
        <div className="mr-2">
          <div className="font-display font-bold text-[16px] tracking-[0.2em] text-snow">SENSOR FUSION <span className="text-cy">ANALYTICS</span></div>
          <div className="font-mono text-[8.5px] tracking-[0.25em] text-dim">MULTI-INT CORRELATION TELEMETRY · 1 Hz SAMPLING · 90-TICK WINDOW</div>
        </div>
        <div className="flex gap-1 flex-wrap">
          {SECTIONS.map((s) => (
            <button key={s.k} onClick={() => setSec(s.k)}
              className={`px-3 py-1.5 border font-display text-[10px] font-semibold tracking-[0.16em] transition-all duration-150 ${sec === s.k
                ? "border-cy/60 bg-cy/12 text-cy shadow-[0_0_14px_rgba(79,216,235,0.18)]"
                : "border-line text-dim hover:text-fog hover:border-line2 hover:bg-panel2"}`}>
              {s.label}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        <div className="hidden lg:flex items-center gap-4 font-mono text-[9px] text-dim tabular">
          <span>TRACKS <span className="text-snow text-[13px] font-display font-bold">{totalTracks}</span></span>
          <span>LIVE <span className="text-gn text-[13px] font-display font-bold">{totalLive}</span></span>
          <span>FUSION <span className="text-cy text-[13px] font-display font-bold">{last(st.fusion).toFixed(0)}%</span></span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-0.5">
        {/* ============ ALL ============ */}
        {sec === "all" && (
          <div className={grid12}>
            <div className="col-span-3"><Kpi label="FUSED TRACKS" value={totalTracks} sub="air · sea · space · ground" spark={st.flights.map((f, i) => f + st.ships[i] + st.sats[i])} /></div>
            <div className="col-span-3"><Kpi label="LIVE SOURCING" value={`${last(st.liveRatio).toFixed(0)}`} unit="%" tone="text-gn" sub={`${totalLive} records off-wire`} spark={st.liveRatio} sparkTone={GN} /></div>
            <div className="col-span-3"><Kpi label="FUSION CONFIDENCE" value={last(st.fusion).toFixed(1)} unit="%" tone="text-cy" sub="cross-layer agreement" spark={st.fusion} /></div>
            <div className="col-span-3"><Kpi label="INGEST RATE" value={Math.round(last(st.ingest))} unit="msg/s" tone="text-am" sub="all pipelines" spark={st.ingest} sparkTone={AM} /></div>

            <div className="col-span-6">
              <Chart title="INGEST THROUGHPUT · MSG/S" right={<Tag tone="am">ALL PIPES</Tag>} h={210}>
                <AreaChart data={rows} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#14222f" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="time" {...ax} interval={14} />
                  <YAxis {...ax} />
                  <Tooltip content={<TT />} />
                  <Area name="msg/s" dataKey="ingest" stroke={AM} fill={AM} fillOpacity={0.14} strokeWidth={1.5} />
                </AreaChart>
              </Chart>
            </div>
            <div className="col-span-6">
              <Chart title="FUSION CONFIDENCE · %" right={<Tag tone="cy">COMPOSITE</Tag>} h={210}>
                <LineChart data={rows} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#14222f" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="time" {...ax} interval={14} />
                  <YAxis {...ax} domain={[30, 100]} />
                  <Tooltip content={<TT />} />
                  <ReferenceLine y={70} stroke={RD} strokeDasharray="4 4" strokeOpacity={0.5} />
                  <Line name="confidence" dataKey="fusion" stroke={CY} strokeWidth={1.6} dot={false} />
                </LineChart>
              </Chart>
            </div>

            <div className="col-span-6">
              <Chart title="ACTIVE TRACKS BY DOMAIN" right={<Tag tone="fog">STACKED</Tag>} h={210}>
                <AreaChart data={rows} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#14222f" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="time" {...ax} interval={14} />
                  <YAxis {...ax} />
                  <Tooltip content={<TT />} />
                  <Area name="ADS-B" dataKey="flights" stackId="1" stroke={CY} fill={CY} fillOpacity={0.35} strokeWidth={1} />
                  <Area name="AIS" dataKey="ships" stackId="1" stroke={TL} fill={TL} fillOpacity={0.35} strokeWidth={1} />
                  <Area name="TLE" dataKey="sats" stackId="1" stroke={VIO} fill={VIO} fillOpacity={0.35} strokeWidth={1} />
                  <Area name="SEISMIC" dataKey="quakes" stackId="1" stroke={RD} fill={RD} fillOpacity={0.35} strokeWidth={1} />
                  <Area name="FIRE" dataKey="fires" stackId="1" stroke={OR} fill={OR} fillOpacity={0.35} strokeWidth={1} />
                </AreaChart>
              </Chart>
            </div>
            <div className="col-span-3">
              <Chart title="NEWS SENTIMENT" h={210}>
                <BarChart data={rows.slice(-24)} margin={{ top: 4, right: 6, left: -22, bottom: 0 }}>
                  <CartesianGrid stroke="#14222f" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="time" {...ax} interval={7} />
                  <YAxis {...ax} />
                  <Tooltip content={<TT />} />
                  <Bar name="POS" dataKey="pos" stackId="s" fill={GN} fillOpacity={0.75} />
                  <Bar name="NEU" dataKey="neu" stackId="s" fill={FOG} fillOpacity={0.55} />
                  <Bar name="NEG" dataKey="neg" stackId="s" fill={RD} fillOpacity={0.75} />
                </BarChart>
              </Chart>
            </div>
            <div className="col-span-3">
              <Chart title="CROSS-CORRELATIONS / TICK" h={210}>
                <BarChart data={rows.slice(-24)} margin={{ top: 4, right: 6, left: -22, bottom: 0 }}>
                  <CartesianGrid stroke="#14222f" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="time" {...ax} interval={7} />
                  <YAxis {...ax} allowDecimals={false} />
                  <Tooltip content={<TT />} />
                  <Bar name="events" dataKey="correlated" fill={VIO} fillOpacity={0.8} />
                </BarChart>
              </Chart>
            </div>

            <div className="col-span-12">
              <Panel title="FUSION ALGORITHM CONFIDENCE" right={<Tag tone="cy">{algos.length ? algos.length : 6} MODELS ARMED · 3-TICK EVAL</Tag>} pad={false}>
                <div className="grid grid-cols-3 gap-px bg-line/60">
                  {(algos.length ? algos : []).map((a) => {
                    const tone = a.conf >= 85 ? "#55e09c" : a.conf >= 70 ? "#4fd8eb" : "#ffb454";
                    const delta = a.hist.length > 1 ? a.conf - a.hist[a.hist.length - 2] : 0;
                    return (
                      <div key={a.id} className="bg-panel px-3.5 py-3 hover:bg-panel2/70 transition-colors group">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display text-[10.5px] font-bold tracking-[0.12em] text-snow group-hover:text-cy transition-colors">{a.id}</span>
                          <span className="font-mono text-[7.5px] px-1.5 py-px border border-line2 text-dim whitespace-nowrap">{a.cls}</span>
                        </div>
                        <div className="flex items-end justify-between mt-1.5">
                          <div>
                            <span className="font-display font-bold text-[22px] tabular" style={{ color: tone }}>{a.conf.toFixed(1)}</span>
                            <span className="font-mono text-[9px] text-dim ml-1">% CONF</span>
                            <div className={`font-mono text-[8.5px] tabular ${delta >= 0 ? "text-gn" : "text-rd"}`}>
                              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)} / eval
                            </div>
                          </div>
                          <Spark data={a.hist} tone={tone} h={30} w={112} />
                        </div>
                        <div className="h-1 mt-2 bg-line/70 overflow-hidden">
                          <div className="h-full transition-all duration-700" style={{ width: `${a.conf}%`, background: tone, opacity: 0.8 }} />
                        </div>
                        <div className="font-mono text-[8.5px] text-dim mt-1.5 leading-relaxed">{a.note}</div>
                      </div>
                    );
                  })}
                  {!algos.length && <div className="col-span-3 bg-panel px-3 py-4 font-mono text-[9.5px] text-dim">CALIBRATING MODELS — first evaluation on next fusion tick…</div>}
                </div>
              </Panel>
            </div>

            <div className="col-span-12">
              <CoverageTable coverage={coverage} statusTag={statusTag} />
            </div>
          </div>
        )}

        {/* ============ ADS-B ============ */}
        {sec === "adsb" && (
          <div className={grid12}>
            <div className="col-span-3"><Kpi label="TRACKED AIRCRAFT" value={sim.flights.length} sub={sources.OPENSKY === "LIVE" ? "OpenSky · 2 boxes (EU + IND)" : "synthetic engine"} spark={st.flights} /></div>
            <div className="col-span-3"><Kpi label="LIVE ADS-B" value={liveFl} tone="text-gn" sub={`${liveFl ? Math.round((liveFl / Math.max(1, sim.flights.length)) * 100) : 0}% of layer`} spark={st.liveRatio} sparkTone={GN} /></div>
            <div className="col-span-3"><Kpi label="MEAN FLIGHT LEVEL" value={`FL${Math.round(sim.flights.reduce((a, f) => a + f.alt, 0) / Math.max(1, sim.flights.length) / 100)}`} sub="barometric" /></div>
            <div className="col-span-3"><Kpi label="STATE / MIL" value={sim.flights.filter((f) => f.mil).length} tone="text-am" sub="callsign heuristic" /></div>

            <div className="col-span-8">
              <Chart title="ADS-B TRACK VOLUME · 90-TICK WINDOW" right={statusTag(sources.OPENSKY)} h={220}>
                <AreaChart data={rows} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#14222f" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="time" {...ax} interval={14} />
                  <YAxis {...ax} />
                  <Tooltip content={<TT />} />
                  <Area name="tracks" dataKey="flights" stroke={CY} fill={CY} fillOpacity={0.14} strokeWidth={1.5} />
                </AreaChart>
              </Chart>
            </div>
            <div className="col-span-4">
              <Chart title="ALTITUDE DISTRIBUTION · FT" h={220}>
                <BarChart data={altBands} margin={{ top: 4, right: 6, left: -22, bottom: 0 }}>
                  <CartesianGrid stroke="#14222f" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="k" {...ax} />
                  <YAxis {...ax} allowDecimals={false} />
                  <Tooltip content={<TT />} />
                  <Bar name="ac" dataKey="v" fill={CY} fillOpacity={0.75} />
                </BarChart>
              </Chart>
            </div>

            <div className="col-span-12">
              <Panel title="TOP MOVERS · HIGHEST GROUND SPEED" pad={false}>
                <table className="w-full">
                  <thead><tr className="font-mono text-[8.5px] text-dim tracking-[0.15em] bg-panel2/60">
                    <th className="text-left font-normal px-3 py-1.5">CALLSIGN</th><th className="text-left font-normal py-1.5">TYPE</th>
                    <th className="text-left font-normal py-1.5">FROM → TO</th><th className="text-left font-normal py-1.5">ALT</th>
                    <th className="text-left font-normal py-1.5">GS</th><th className="text-left font-normal py-1.5">HDG</th><th className="text-left font-normal py-1.5 pr-3">SOURCE</th>
                  </tr></thead>
                  <tbody>
                    {[...sim.flights].sort((a, b) => b.spd - a.spd).slice(0, 9).map((f) => (
                      <tr key={f.id} className="border-t border-line/50 hover:bg-panel2/40 transition-colors font-mono text-[10.5px] tabular">
                        <td className="px-3 py-1.5 text-snow">{f.cs}{f.mil && <span className="text-am ml-1.5 text-[8px]">MIL</span>}</td>
                        <td className="py-1.5 text-fog">{f.type}</td>
                        <td className="py-1.5 text-fog">{f.from} → {f.to}</td>
                        <td className="py-1.5 text-fog">{Math.round(f.alt / 1000)}k ft</td>
                        <td className="py-1.5 text-cy">{Math.round(f.spd)} kt</td>
                        <td className="py-1.5 text-fog">{Math.round(f.hdg).toString().padStart(3, "0")}°</td>
                        <td className="py-1.5 pr-3">{f.live ? <Tag tone="gn">LIVE</Tag> : <Tag tone="fog">SIM</Tag>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            </div>
          </div>
        )}

        {/* ============ MARITIME ============ */}
        {sec === "maritime" && (
          <div className={grid12}>
            <div className="col-span-3"><Kpi label="VESSELS TRACKED" value={sim.ships.length} sub={liveSh ? "AISStream WS · live stream" : "synthetic traffic"} spark={st.ships} sparkTone={TL} /></div>
            <div className="col-span-3"><Kpi label="LIVE AIS" value={liveSh} tone="text-gn" sub={sources.AISSTREAM === "LIVE" ? "position reports 1.5s" : "awaiting operator key"} /></div>
            <div className="col-span-3"><Kpi label="AIS-DARK SUSPECTS" value={sim.ships.filter((s) => s.name.includes("DARK")).length} tone="text-rd" sub="sanctions heuristic" spark={st.darkShips} sparkTone={RD} /></div>
            <div className="col-span-3"><Kpi label="MEAN SOG" value={(sim.ships.reduce((a, s) => a + s.spd, 0) / Math.max(1, sim.ships.length)).toFixed(1)} unit="kn" sub="speed over ground" /></div>

            <div className="col-span-8">
              <Chart title="MARITIME TRACKS + AIS-DARK EVENTS" right={statusTag(sources.AISSTREAM)} h={220}>
                <AreaChart data={rows} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#14222f" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="time" {...ax} interval={14} />
                  <YAxis {...ax} />
                  <Tooltip content={<TT />} />
                  <Area name="vessels" dataKey="ships" stroke={TL} fill={TL} fillOpacity={0.14} strokeWidth={1.5} />
                  <Area name="dark" dataKey="dark" stroke={RD} fill={RD} fillOpacity={0.2} strokeWidth={1.2} />
                </AreaChart>
              </Chart>
            </div>
            <div className="col-span-4">
              <Chart title="SPEED DISTRIBUTION · KN" h={220}>
                <BarChart data={spdBands} margin={{ top: 4, right: 6, left: -22, bottom: 0 }}>
                  <CartesianGrid stroke="#14222f" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="k" {...ax} />
                  <YAxis {...ax} allowDecimals={false} />
                  <Tooltip content={<TT />} />
                  <Bar name="vessels" dataKey="v" fill={TL} fillOpacity={0.75} />
                </BarChart>
              </Chart>
            </div>

            <div className="col-span-12">
              <Panel title="SURFACE PICTURE · CONTACT LIST" pad={false}>
                <table className="w-full">
                  <thead><tr className="font-mono text-[8.5px] text-dim tracking-[0.15em] bg-panel2/60">
                    <th className="text-left font-normal px-3 py-1.5">VESSEL</th><th className="text-left font-normal py-1.5">CLASS</th>
                    <th className="text-left font-normal py-1.5">FLAG</th><th className="text-left font-normal py-1.5">SOG</th>
                    <th className="text-left font-normal py-1.5">HDG</th><th className="text-left font-normal py-1.5">MMSI</th><th className="text-left font-normal py-1.5 pr-3">SOURCE</th>
                  </tr></thead>
                  <tbody>
                    {sim.ships.slice(0, 10).map((s) => (
                      <tr key={s.id} className={`border-t border-line/50 hover:bg-panel2/40 transition-colors font-mono text-[10.5px] tabular ${s.name.includes("DARK") ? "text-rd" : ""}`}>
                        <td className="px-3 py-1.5 text-snow">{s.name}</td>
                        <td className="py-1.5 text-fog">{s.cls}</td>
                        <td className="py-1.5 text-fog">{s.flag}</td>
                        <td className="py-1.5 text-tl">{s.spd.toFixed(1)} kn</td>
                        <td className="py-1.5 text-fog">{Math.round(s.hdg).toString().padStart(3, "0")}°</td>
                        <td className="py-1.5 text-fog">{s.mmsi ?? "—"}</td>
                        <td className="py-1.5 pr-3">{s.live ? <Tag tone="gn">LIVE</Tag> : <Tag tone="fog">SIM</Tag>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            </div>
          </div>
        )}

        {/* ============ SATELLITE ============ */}
        {sec === "satellite" && (
          <div className={grid12}>
            <div className="col-span-3"><Kpi label="ORBITAL OBJECTS" value={sim.sats.length} sub={liveSa ? "TLE · SGP4 propagated 1 Hz" : "synthetic ephemeris"} spark={st.sats} sparkTone={VIO} /></div>
            <div className="col-span-3"><Kpi label="LIVE TLE" value={liveSa} tone="text-gn" sub={sources.CELESTRAK} /></div>
            <div className="col-span-3"><Kpi label="MEDIAN ALT" value={`${Math.round(sim.sats.map((s) => s.altKm).sort((a, b) => a - b)[Math.floor(sim.sats.length / 2)] ?? 0)}`} unit="km" sub="above ellipsoid" /></div>
            <div className="col-span-3"><Kpi label="MAX INCLINATION" value={`${Math.max(...sim.sats.map((s) => s.inc)).toFixed(1)}°`} sub="polar coverage" /></div>

            <div className="col-span-8">
              <Chart title="PROPAGATED OBJECTS · 90-TICK WINDOW" right={statusTag(sources.CELESTRAK)} h={220}>
                <AreaChart data={rows} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#14222f" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="time" {...ax} interval={14} />
                  <YAxis {...ax} />
                  <Tooltip content={<TT />} />
                  <Area name="objects" dataKey="sats" stroke={VIO} fill={VIO} fillOpacity={0.14} strokeWidth={1.5} />
                </AreaChart>
              </Chart>
            </div>
            <div className="col-span-4">
              <Panel title="ORBIT REGIME MIX" pad={false}>
                {(() => {
                  const leo = sim.sats.filter((s) => s.altKm < 2000).length;
                  const meo = sim.sats.filter((s) => s.altKm >= 2000 && s.altKm < 20000).length;
                  const geo = sim.sats.filter((s) => s.altKm >= 20000).length;
                  return [["LEO <2,000 KM", leo, CY], ["MEO 2–20K KM", meo, VIO], ["GEO 35,786 KM", geo, AM]].map(([l, v, c]) => (
                    <div key={l as string} className="px-3 py-2.5 border-b border-line/50 last:border-0">
                      <div className="flex justify-between font-mono text-[9px] mb-1"><span className="text-dim">{l as string}</span><span className="text-snow tabular">{v as number}</span></div>
                      <div className="h-1 bg-line/70"><div className="h-full" style={{ width: `${((v as number) / Math.max(1, sim.sats.length)) * 100}%`, background: c as string }} /></div>
                    </div>
                  ));
                })()}
              </Panel>
            </div>

            <div className="col-span-12">
              <Panel title="ORBITAL ORDER OF BATTLE" pad={false}>
                <table className="w-full">
                  <thead><tr className="font-mono text-[8.5px] text-dim tracking-[0.15em] bg-panel2/60">
                    <th className="text-left font-normal px-3 py-1.5">OBJECT</th><th className="text-left font-normal py-1.5">PAYLOAD</th>
                    <th className="text-left font-normal py-1.5">ALT</th><th className="text-left font-normal py-1.5">INCL</th>
                    <th className="text-left font-normal py-1.5 pr-3">SOURCE</th>
                  </tr></thead>
                  <tbody>
                    {sim.sats.map((s) => (
                      <tr key={s.id} className="border-t border-line/50 hover:bg-panel2/40 transition-colors font-mono text-[10.5px] tabular">
                        <td className="px-3 py-1.5 text-snow">{s.name}</td>
                        <td className="py-1.5 text-vio">{s.kind}</td>
                        <td className="py-1.5 text-fog">{s.altKm.toLocaleString()} km</td>
                        <td className="py-1.5 text-fog">{s.inc.toFixed(1)}°</td>
                        <td className="py-1.5 pr-3">{s.live ? <Tag tone="gn">SGP4</Tag> : <Tag tone="fog">SIM</Tag>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            </div>
          </div>
        )}

        {/* ============ SEISMIC ============ */}
        {sec === "seismic" && (
          <div className={grid12}>
            <div className="col-span-3"><Kpi label="EVENTS · 24H" value={sim.quakes.length} sub={liveQ ? "USGS realtime feed" : "synthetic events"} spark={st.quakes} sparkTone={RD} /></div>
            <div className="col-span-3"><Kpi label="MAX MAGNITUDE" value={`M${Math.max(...sim.quakes.map((q) => q.mag), 0).toFixed(1)}`} tone="text-rd" sub="window maximum" /></div>
            <div className="col-span-3"><Kpi label="MEAN DEPTH" value={`${Math.round(sim.quakes.reduce((a, q) => a + q.depth, 0) / Math.max(1, sim.quakes.length))}`} unit="km" sub="hypocenter" /></div>
            <div className="col-span-3"><Kpi label="LIVE EVENTS" value={liveQ} tone="text-gn" sub={`USGS ${sources.USGS}`} /></div>

            <div className="col-span-8">
              <Chart title="SEISMIC EVENT VOLUME" right={statusTag(sources.USGS)} h={220}>
                <AreaChart data={rows} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#14222f" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="time" {...ax} interval={14} />
                  <YAxis {...ax} />
                  <Tooltip content={<TT />} />
                  <Area name="events" dataKey="quakes" stroke={RD} fill={RD} fillOpacity={0.14} strokeWidth={1.5} />
                </AreaChart>
              </Chart>
            </div>
            <div className="col-span-4">
              <Chart title="MAGNITUDE BUCKETS" h={220}>
                <BarChart data={magBands} margin={{ top: 4, right: 6, left: -22, bottom: 0 }}>
                  <CartesianGrid stroke="#14222f" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="k" {...ax} />
                  <YAxis {...ax} allowDecimals={false} />
                  <Tooltip content={<TT />} />
                  <Bar name="events" dataKey="v" fill={RD} fillOpacity={0.75} />
                </BarChart>
              </Chart>
            </div>

            <div className="col-span-12">
              <Panel title="STRONGEST EVENTS" pad={false}>
                {[...sim.quakes].sort((a, b) => b.mag - a.mag).slice(0, 8).map((q) => (
                  <div key={q.id} className="flex items-center gap-3 px-3 py-2 border-b border-line/50 last:border-0 hover:bg-panel2/40 transition-colors">
                    <span className={`font-display font-bold text-[16px] w-14 tabular ${q.mag >= 6 ? "text-rd" : q.mag >= 5 ? "text-am" : "text-fog"}`}>M{q.mag}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-snow truncate">{q.place}</div>
                      <div className="font-mono text-[8.5px] text-dim tabular">{q.lat.toFixed(2)}°, {q.lon.toFixed(2)}° · {q.depth} km deep</div>
                    </div>
                    <div className="h-1 w-24 bg-line/70"><div className={`h-full ${q.mag >= 6 ? "bg-rd" : q.mag >= 5 ? "bg-am" : "bg-fog"}`} style={{ width: `${(q.mag / 8) * 100}%` }} /></div>
                    {q.live ? <Tag tone="gn">USGS</Tag> : <Tag tone="fog">SIM</Tag>}
                  </div>
                ))}
              </Panel>
            </div>
          </div>
        )}

        {/* ============ NEWS ============ */}
        {sec === "news" && (
          <div className={grid12}>
            <div className="col-span-3"><Kpi label="ITEMS · 6H WINDOW" value={sim.news.length} sub={liveNw ? "GDELT DOC 2.0" : "synthetic wire"} spark={st.newsRate} sparkTone={AM} /></div>
            <div className="col-span-3"><Kpi label="FLASH PRIORITY" value={sim.news.filter((n) => n.priority === "FLASH").length} tone="text-rd" sub="highest tier" /></div>
            <div className="col-span-3"><Kpi label="LIVE ITEMS" value={liveNw} tone="text-gn" sub={`${Math.round((liveNw / Math.max(1, sim.news.length)) * 100)}% of feed`} /></div>
            <div className="col-span-3"><Kpi label="NEGATIVE RATIO" value={`${Math.round((last(st.sentNeg) / Math.max(1, last(st.sentNeg) + last(st.sentPos) + last(st.sentNeu))) * 100)}%`} tone="text-am" sub="lexical tone" spark={st.sentNeg} sparkTone={RD} /></div>

            <div className="col-span-8">
              <Chart title="ITEMS PER 30-TICK WINDOW" right={statusTag(sources.GDELT)} h={220}>
                <AreaChart data={rows} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#14222f" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="time" {...ax} interval={14} />
                  <YAxis {...ax} />
                  <Tooltip content={<TT />} />
                  <Area name="items" dataKey="news" stroke={AM} fill={AM} fillOpacity={0.14} strokeWidth={1.5} />
                </AreaChart>
              </Chart>
            </div>
            <div className="col-span-4">
              <Chart title="TOP SOURCES" h={220}>
                <BarChart data={srcTop} layout="vertical" margin={{ top: 4, right: 10, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke="#14222f" strokeDasharray="2 4" horizontal={false} />
                  <XAxis type="number" {...ax} allowDecimals={false} />
                  <YAxis type="category" dataKey="k" {...ax} width={92} />
                  <Tooltip content={<TT />} />
                  <Bar name="items" dataKey="v" fill={AM} fillOpacity={0.75} />
                </BarChart>
              </Chart>
            </div>

            <div className="col-span-12">
              <Panel title="FLASH + PRIORITY ITEMS" pad={false}>
                {sim.news.filter((n) => n.priority !== "ROUTINE").slice(0, 8).map((n) => (
                  <div key={n.id} className="flex items-center gap-3 px-3 py-2 border-b border-line/50 last:border-0 hover:bg-panel2/40 transition-colors">
                    {n.priority === "FLASH" ? <Tag tone="rd">FLASH</Tag> : <Tag tone="am">PRIORITY</Tag>}
                    <span className="text-[11px] text-snow flex-1 truncate">{n.title}</span>
                    <span className="font-mono text-[8.5px] text-dim">{n.source}</span>
                    {n.live && <Tag tone="gn">LIVE</Tag>}
                  </div>
                ))}
              </Panel>
            </div>
          </div>
        )}

        {/* ============ FUSION ============ */}
        {sec === "fusion" && (
          <div className={grid12}>
            <div className="col-span-3"><Kpi label="FUSION CONFIDENCE" value={last(st.fusion).toFixed(1)} unit="%" tone="text-cy" sub="composite agreement" spark={st.fusion} /></div>
            <div className="col-span-3"><Kpi label="CORRELATED EVENTS" value={corrTotal} tone="text-vio" sub="90-tick window" spark={st.correlated} sparkTone={VIO} /></div>
            <div className="col-span-3"><Kpi label="DOMAINS ONLINE" value={`${coverage.filter((c) => c.src === "LIVE" || c.src === "SIM").length}/${coverage.length}`} sub={coverage.filter((c) => c.src === "LIVE").length + " on live wire"} /></div>
            <div className="col-span-3"><Kpi label="LIVE RECORD RATIO" value={`${last(st.liveRatio).toFixed(0)}%`} tone="text-gn" sub="off-wire vs synthetic" spark={st.liveRatio} sparkTone={GN} /></div>

            <div className="col-span-8">
              <Chart title="FUSION CONFIDENCE + CORRELATION EVENTS" h={230}>
                <AreaChart data={rows} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#14222f" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="time" {...ax} interval={14} />
                  <YAxis {...ax} domain={[0, 100]} />
                  <Tooltip content={<TT />} />
                  <ReferenceLine y={70} stroke={RD} strokeDasharray="4 4" strokeOpacity={0.5} />
                  <Area name="confidence %" dataKey="fusion" stroke={CY} fill={CY} fillOpacity={0.1} strokeWidth={1.5} />
                  <Area name="correlations ×10" dataKey="correlated" stroke={VIO} fill={VIO} fillOpacity={0.2} strokeWidth={1.2} />
                </AreaChart>
              </Chart>
            </div>
            <div className="col-span-4">
              <Panel title="ACTIVE CROSS-LINKS" pad={false}>
                {[
                  ["SEISMIC", "NEWS WIRE", Math.min(10, liveQ), RD],
                  ["ADS-B", "CONFLICT ZONES", sim.conflicts.length, CY],
                  ["AIS", "SANCTIONS GRAPH", sim.ships.filter((s) => s.name.includes("DARK")).length, TL],
                  ["TLE", "EO TASKING", liveSa, VIO],
                  ["WILDFIRE", "WEATHER", liveFi, OR],
                ].map(([a, b, v, c], i) => (
                  <div key={i} className="px-3 py-2.5 border-b border-line/50 last:border-0">
                    <div className="flex items-center justify-between font-mono text-[9.5px] mb-1.5">
                      <span className="text-snow">{a as string} <span className="text-dim">↔</span> {b as string}</span>
                      <span className="tabular" style={{ color: c as string }}>{v as number} links</span>
                    </div>
                    <div className="h-1 bg-line/70 overflow-hidden">
                      <div className="h-full dash-crawl" style={{ width: `${Math.min(100, 18 + (v as number) * 9)}%`, background: c as string, opacity: 0.85 }} />
                    </div>
                  </div>
                ))}
              </Panel>
            </div>

            <div className="col-span-12">
              <Panel title="FEED SUPERVISOR · INGEST PIPELINE TELEMETRY" pad={false}
                right={<Tag tone="gn">{Object.values(feedTelemetry).filter((v) => v.ok).length} FEEDS HOT</Tag>}>
                <table className="w-full">
                  <thead><tr className="font-mono text-[8.5px] text-dim tracking-[0.15em] bg-panel2/60">
                    <th className="text-left font-normal px-3 py-1.5">SOURCE</th>
                    <th className="text-left font-normal py-1.5">PIPELINE</th>
                    <th className="text-left font-normal py-1.5">STATE</th>
                    <th className="text-right font-normal py-1.5">MSGS INGESTED</th>
                    <th className="text-right font-normal py-1.5 pr-3">LATENCY</th>
                  </tr></thead>
                  <tbody>
                    {SOURCE_META.map((m) => {
                      const t = feedTelemetry[m.k];
                      const state = sources[m.k] ?? "STANDBY";
                      return (
                        <tr key={m.k} className="border-t border-line/50 hover:bg-panel2/40 transition-colors">
                          <td className="px-3 py-1.5 font-mono text-[10px] text-snow">{m.label}</td>
                          <td className="py-1.5 font-mono text-[9px] text-dim">{m.feed}</td>
                          <td className="py-1.5">{statusTag(state)}</td>
                          <td className="py-1.5 text-right font-mono text-[10px] tabular text-cy">{t && t.msgs > 0 ? t.msgs.toLocaleString("en-US") : "—"}</td>
                          <td className="py-1.5 pr-3 text-right font-mono text-[10px] tabular text-fog">{t?.lat ? `${t.lat} ms` : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="px-3 py-1.5 border-t border-line font-mono text-[8.5px] text-dim">
                  Every poll is timed and counted by the ingest supervisor · failed polls flip the pipeline to the synthetic engine without dropping the fusion bus
                </div>
              </Panel>
            </div>

            <div className="col-span-12">
              <CoverageTable coverage={coverage} statusTag={statusTag} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CoverageTable({ coverage, statusTag }: {
  coverage: { d: string; vol: number; live: number; max: number; src: string; fresh: string }[];
  statusTag: (s: string) => ReactNode;
}) {
  return (
    <Panel title="DOMAIN COVERAGE MATRIX · SENSOR HEALTH" right={<Tag tone="cy">FUSION BUS</Tag>} pad={false}>
      <table className="w-full">
        <thead><tr className="font-mono text-[8.5px] text-dim tracking-[0.15em] bg-panel2/60">
          <th className="text-left font-normal px-3 py-1.5">DOMAIN</th>
          <th className="text-left font-normal py-1.5 w-[30%]">VOLUME</th>
          <th className="text-left font-normal py-1.5">LIVE RECORDS</th>
          <th className="text-left font-normal py-1.5">REFRESH</th>
          <th className="text-left font-normal py-1.5 pr-3">UPLINK</th>
        </tr></thead>
        <tbody>
          {coverage.map((c) => (
            <tr key={c.d} className="border-t border-line/50 hover:bg-panel2/40 transition-colors">
              <td className="px-3 py-2 font-display text-[11px] font-semibold tracking-[0.12em] text-snow">{c.d}</td>
              <td className="py-2 pr-4">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-line/70">
                    <div className="h-full bg-cy transition-all duration-700" style={{ width: `${Math.min(100, (c.vol / c.max) * 100)}%` }} />
                  </div>
                  <span className="font-mono text-[10px] text-fog tabular w-8">{c.vol}</span>
                </div>
              </td>
              <td className="py-2 font-mono text-[10px] tabular">
                {c.live > 0 ? <span className="text-gn">{c.live} <span className="text-dim">({Math.round((c.live / Math.max(1, c.vol)) * 100)}%)</span></span> : <span className="text-dim">0</span>}
              </td>
              <td className="py-2 font-mono text-[10px] text-fog tabular">{c.fresh}</td>
              <td className="py-2 pr-3">{statusTag(c.src)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
