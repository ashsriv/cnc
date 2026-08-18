import { useEffect, useMemo, useRef, useState } from "react";
import { geoNaturalEarth1, geoPath, geoGraticule10, geoCircle } from "d3-geo";
import { feature } from "topojson-client";
// @ts-ignore — bundled offline basemap
import worldTopo from "world-atlas/countries-110m.json";
import type { LayerKey, Sel, Uav } from "../lib/types";
import { useStore } from "../state/store";
import { clamp, fmtCoord } from "../lib/geo";

const W = 1200, H = 640;

const topo = worldTopo as any;
const projection = geoNaturalEarth1().scale(219).translate([W / 2, H / 2 + 14]);
const path = geoPath(projection);
const landD = path(feature(topo, topo.objects.land) as any) ?? "";
const bordersD = path(feature(topo, topo.objects.countries) as any) ?? "";
const gratD = path(geoGraticule10()) ?? "";
const circleGen = geoCircle().precision(2);

export interface MissionOverlay { uav: Uav; geofenceR: number; }

export default function WorldMap({ mission, heightClass = "h-full" }: { mission?: MissionOverlay; heightClass?: string }) {
  const { sim, layers, sel, select, focus, setFocus } = useStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const [tf, setTf] = useState({ k: 1, x: 0, y: 0 });
  const [drag, setDrag] = useState<{ px: number; py: number; x: number; y: number } | null>(null);
  const [cursor, setCursor] = useState<{ lat: number; lon: number } | null>(null);
  const [hover, setHover] = useState<{ px: number; py: number; label: string; sub: string } | null>(null);

  // programmatic focus
  useEffect(() => {
    if (!focus) return;
    const p = projection([focus.lon, focus.lat]);
    if (!p) return;
    setTf({ k: focus.k, x: W / 2 - p[0] * focus.k, y: H / 2 - p[1] * focus.k });
    setFocus(null);
  }, [focus, setFocus]);

  const toVB = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = svgRef.current!.getBoundingClientRect();
    return [(e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height)];
  };

  const onWheel = (e: React.WheelEvent) => {
    const [px, py] = toVB(e);
    setTf(({ k, x, y }) => {
      const k2 = clamp(k * Math.exp(-e.deltaY * 0.0014), 1, 10);
      return { k: k2, x: px - ((px - x) * k2) / k, y: py - ((py - y) * k2) / k };
    });
  };

  const onMove = (e: React.PointerEvent) => {
    if (drag) {
      const [px, py] = toVB(e);
      setTf((t) => ({ ...t, x: drag.x + (px - drag.px), y: drag.y + (py - drag.py) }));
    }
    const [px, py] = toVB(e);
    const inv = projection.invert?.([(px - tf.x) / tf.k, (py - tf.y) / tf.k]);
    if (inv && Math.abs(inv[0]) <= 180 && Math.abs(inv[1]) <= 86) setCursor({ lat: inv[1], lon: inv[0] });
    else setCursor(null);
  };

  const zoomBy = (f: number) => setTf(({ k, x, y }) => {
    const k2 = clamp(k * f, 1, 10);
    return { k: k2, x: W / 2 - ((W / 2 - x) * k2) / k, y: H / 2 - ((H / 2 - y) * k2) / k };
  });

  const P = (lon: number, lat: number): [number, number] | null => projection([lon, lat]) as [number, number] | null;
  const M = (lon: number, lat: number, node: React.ReactNode, key: string) => {
    const p = P(lon, lat);
    if (!p) return null;
    return <g key={key} transform={`translate(${p[0]},${p[1]})`}>{node}</g>;
  };

  const isSel = (kind: LayerKey, id: string) => sel?.kind === kind && sel?.id === id;
  const ring = (r: number, tone: string) => (
    <circle r={r} fill="none" stroke={tone} strokeWidth={1.2} opacity={0.95} />
  );
  const label = (text: string, tone: string, dy = -11) => (
    <text y={dy} textAnchor="middle" fontSize={8.5} fontFamily="IBM Plex Mono, monospace" fill={tone}
      stroke="#06090f" strokeWidth={2.4} paintOrder="stroke" style={{ letterSpacing: "0.06em" }}>{text}</text>
  );

  // scale bar
  const kmPerPx = 111 / (219 * (Math.PI / 180)) / tf.k;
  const scaleKm = [2000, 1000, 500, 250, 100].find((km) => km / kmPerPx <= 170) ?? 100;

  const s = 1 / tf.k;

  return (
    <div className={`relative w-full ${heightClass} overflow-hidden bg-abyss border border-line`}>
      {/* ambient map glow */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 80% 70% at 50% 42%, rgba(24,153,180,0.10), transparent 65%)" }} />

      <svg
        ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-full block cursor-crosshair select-none touch-none"
        onWheel={onWheel}
        onPointerDown={(e) => { const [px, py] = toVB(e); setDrag({ px, py, x: tf.x, y: tf.y }); (e.target as Element).setPointerCapture?.(e.pointerId); }}
        onPointerMove={onMove}
        onPointerUp={() => setDrag(null)}
        onPointerLeave={() => { setDrag(null); setCursor(null); }}
      >
        <defs>
          <radialGradient id="fireGlow">
            <stop offset="0%" stopColor="#ff8a3d" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#ff8a3d" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="conflictGlow">
            <stop offset="0%" stopColor="#ff5d5d" stopOpacity="0.16" />
            <stop offset="80%" stopColor="#ff5d5d" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#ff5d5d" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g transform={`translate(${tf.x},${tf.y}) scale(${tf.k})`} style={{ transition: drag ? "none" : "transform 0.7s cubic-bezier(0.22,0.9,0.24,1)" }}>
          <path d={gratD} fill="none" stroke="#142233" strokeWidth={0.5 * s} />
          <path d={landD} fill="#101c2b" stroke="#24394f" strokeWidth={0.7 * s} />
          <path d={bordersD} fill="none" stroke="#1d3049" strokeWidth={0.4 * s} />

          {/* ---- CONFLICT ZONES ---- */}
          {layers.conflicts && sim.conflicts.map((c) => {
            const d = path(circleGen.center([c.lon, c.lat]).radius(c.rKm / 111)() as any);
            const p = P(c.lon, c.lat);
            return d ? (
              <g key={c.id} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); select({ kind: "conflicts", id: c.id }); }}>
                <path d={d} fill="url(#conflictGlow)" stroke="#ff5d5d" strokeWidth={0.9 * s} strokeDasharray={`${4 * s} ${3 * s}`} className="dash-crawl" opacity={0.8} />
                {p && <g transform={`translate(${p[0]},${p[1]}) scale(${s})`}>
                  <path d="M-4 0H4M0 -4V4" stroke="#ff5d5d" strokeWidth={1} opacity={0.9} />
                  {(isSel("conflicts", c.id) || tf.k > 2.4) && label(c.name, "#ff8b8b", -9)}
                  {isSel("conflicts", c.id) && ring(8, "#ff5d5d")}
                </g>}
              </g>
            ) : null;
          })}

          {/* ---- WILDFIRES ---- */}
          {layers.fires && sim.fires.map((f) => {
            const p = P(f.lon, f.lat); if (!p) return null;
            const r = 7 + f.mw / 130;
            return (
              <g key={f.id} transform={`translate(${p[0]},${p[1]})`} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); select({ kind: "fires", id: f.id }); }}>
                <circle r={r * s} fill="url(#fireGlow)" className="anim-pulse-soft" />
                <g transform={`scale(${s})`}>
                  <path d="M0 -4.5 C 2.6 -1.5 3.4 1.6 0 4.5 C -3.4 1.6 -2.6 -1.5 0 -4.5 Z" fill="#ff8a3d" stroke="#ffd9b0" strokeWidth={0.6} />
                  {(isSel("fires", f.id) || tf.k > 3) && label(f.name, "#ffb37e", -10)}
                  {isSel("fires", f.id) && ring(9, "#ff8a3d")}
                </g>
              </g>
            );
          })}

          {/* ---- SEISMIC ---- */}
          {layers.quakes && sim.quakes.map((q) => {
            const p = P(q.lon, q.lat); if (!p) return null;
            const r = 3 + q.mag * 1.15;
            const fresh = q.age < 18;
            return (
              <g key={q.id} transform={`translate(${p[0]},${p[1]})`} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); select({ kind: "quakes", id: q.id }); }}>
                <g transform={`scale(${s})`}>
                  {fresh && <>
                    <circle r={r} fill="none" stroke="#ff5d5d" strokeWidth={1.1}>
                      <animate attributeName="r" values={`${r};${r * 2.6}`} dur="1.6s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.8;0" dur="1.6s" repeatCount="indefinite" />
                    </circle>
                  </>}
                  <circle r={r} fill={fresh ? "rgba(255,93,93,0.25)" : "rgba(255,93,93,0.10)"} stroke="#ff5d5d" strokeWidth={1} opacity={fresh ? 1 : 0.55} />
                  <circle r={1.6} fill="#ff5d5d" />
                  {(isSel("quakes", q.id) || (tf.k > 2.6 && fresh)) && label(`M${q.mag} ${q.place}`, "#ff9a9a", -(r + 6))}
                  {isSel("quakes", q.id) && ring(r + 5, "#ff5d5d")}
                </g>
              </g>
            );
          })}

          {/* ---- CCTV ---- */}
          {layers.cams && sim.cams.map((c) => {
            const p = P(c.lon, c.lat); if (!p) return null;
            const tone = c.online ? "#ffb454" : "#ff5d5d";
            return (
              <g key={c.id} transform={`translate(${p[0]},${p[1]})`} className="cursor-pointer"
                onClick={(e) => { e.stopPropagation(); select({ kind: "cams", id: c.id }); }}
                onPointerEnter={(e) => { const [px, py] = toVB(e); setHover({ px, py, label: c.name, sub: c.online ? `LIVE · ${c.viewers.toLocaleString()} viewers · ${c.fps}fps` : "SIGNAL LOST" }); }}
                onPointerLeave={() => setHover(null)}>
                <g transform={`scale(${s})`}>
                  <rect x={-3.4} y={-3.4} width={6.8} height={6.8} fill={c.online ? "rgba(255,180,84,0.14)" : "rgba(255,93,93,0.1)"} stroke={tone} strokeWidth={1} className={c.online ? "" : "anim-blink"} />
                  <circle cx={0} cy={0} r={1.1} fill={tone} />
                  {(isSel("cams", c.id) || tf.k > 3.4) && label(c.name, "#ffcf9a", -9)}
                  {isSel("cams", c.id) && ring(8.5, tone)}
                </g>
              </g>
            );
          })}

          {/* ---- MARITIME ---- */}
          {layers.ships && sim.ships.map((sh) => {
            const p = P(sh.lon, sh.lat); if (!p) return null;
            const dark = sh.name.includes("DARK");
            const tone = dark ? "#ff5d5d" : "#45d0b8";
            return (
              <g key={sh.id} transform={`translate(${p[0]},${p[1]})`} className="cursor-pointer"
                onClick={(e) => { e.stopPropagation(); select({ kind: "ships", id: sh.id }); }}
                onPointerEnter={(e) => { const [px, py] = toVB(e); setHover({ px, py, label: sh.name, sub: `${sh.cls} · ${sh.spd.toFixed(0)}kn · ${sh.flag}` }); }}
                onPointerLeave={() => setHover(null)}>
                <g transform={`scale(${s}) rotate(${sh.hdg - 90})`}>
                  <path d="M5 0 L-3.6 3.2 L-1.8 0 L-3.6 -3.2 Z" fill={dark ? "rgba(255,93,93,0.2)" : "rgba(69,208,184,0.18)"} stroke={tone} strokeWidth={1} />
                </g>
                <g transform={`scale(${s})`}>
                  {(isSel("ships", sh.id) || tf.k > 3) && label(sh.name, dark ? "#ff9a9a" : "#8fe8d6", -9)}
                  {isSel("ships", sh.id) && ring(9, tone)}
                </g>
              </g>
            );
          })}

          {/* ---- SATELLITES ---- */}
          {layers.sats && sim.sats.map((sa) => {
            const p = P(sa.lon, sa.lat); if (!p) return null;
            // short predicted ground track
            const trail: string[] = [];
            for (let i = 1; i <= 12; i++) {
              const ph = sa.phase + sa.spd * 0.02 * i;
              const lo = sa.lon + 1.15 * i;
              const la = clamp(sa.inc > 90 ? sa.inc - 180 + (180 - sa.inc) * 2 * Math.sin(ph) : sa.inc * Math.sin(ph), -85, 85);
              const tp = P(((lo + 180) % 360) - 180, la);
              if (tp) trail.push(`${tp[0]},${tp[1]}`);
            }
            return (
              <g key={sa.id} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); select({ kind: "sats", id: sa.id }); }}>
                <polyline points={trail.join(" ")} fill="none" stroke="#9d8cff" strokeWidth={0.8 * s} strokeDasharray={`${2.5 * s} ${3 * s}`} opacity={0.4} />
                <g transform={`translate(${p[0]},${p[1]}) scale(${s})`}>
                  <path d="M0 -4 L4 0 L0 4 L-4 0 Z" fill="rgba(157,140,255,0.16)" stroke="#9d8cff" strokeWidth={1} />
                  <circle r={0.9} fill="#9d8cff" />
                  {(isSel("sats", sa.id) || tf.k > 3.2) && label(sa.name, "#c0b5ff", -9)}
                  {isSel("sats", sa.id) && ring(8.5, "#9d8cff")}
                </g>
              </g>
            );
          })}

          {/* ---- FLIGHTS ---- */}
          {layers.flights && sim.flights.map((f) => {
            const p = P(f.lon, f.lat); if (!p) return null;
            const tone = f.mil ? "#ffb454" : "#4fd8eb";
            const pa = P(f.a[1], f.a[0]); const pb = P(f.b[1], f.b[0]);
            return (
              <g key={f.id} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); select({ kind: "flights", id: f.id }); }}
                onPointerEnter={(e) => { const [px, py] = toVB(e); setHover({ px, py, label: f.cs, sub: `${f.type} · FL${Math.round(f.alt / 100)} · ${Math.round(f.spd)}kt` }); }}
                onPointerLeave={() => setHover(null)}>
                {isSel("flights", f.id) && pa && pb && (
                  <line x1={pa[0]} y1={pa[1]} x2={pb[0]} y2={pb[1]} stroke={tone} strokeWidth={0.8 * s} strokeDasharray={`${5 * s} ${4 * s}`} className="dash-crawl" opacity={0.75} />
                )}
                <g transform={`translate(${p[0]},${p[1]})`}>
                  <g transform={`scale(${s}) rotate(${f.hdg})`}>
                    <path d="M0 -5.2 L1.4 -1.6 L5.6 1.2 L5.6 2.4 L1.1 1.3 L0.9 4 L2.4 5.4 L2.4 6.2 L0 5.5 L-2.4 6.2 L-2.4 5.4 L-0.9 4 L-1.1 1.3 L-5.6 2.4 L-5.6 1.2 L-1.4 -1.6 Z"
                      fill={f.mil ? "rgba(255,180,84,0.25)" : "rgba(79,216,235,0.2)"} stroke={tone} strokeWidth={0.9} />
                  </g>
                  <g transform={`scale(${s})`}>
                    {(isSel("flights", f.id) || tf.k > 3.6) && label(f.cs, f.mil ? "#ffd08a" : "#a5e9f5", -10)}
                    {isSel("flights", f.id) && ring(10, tone)}
                  </g>
                </g>
              </g>
            );
          })}

          {/* ---- MISSION OVERLAY ---- */}
          {mission && <MissionLayer uav={mission.uav} geofenceR={mission.geofenceR} s={s} />}
        </g>
      </svg>

      {/* zoom controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1">
        {[["+", () => zoomBy(1.5)], ["−", () => zoomBy(1 / 1.5)], ["⌂", () => setTf({ k: 1, x: 0, y: 0 })]].map(([t, fn], i) => (
          <button key={i} onClick={fn as any}
            className="w-7 h-7 border border-line2 bg-panel/90 text-cy font-mono text-sm hover:bg-cy/15 hover:border-cy/50 transition-colors">
            {t as string}
          </button>
        ))}
      </div>

      {/* cursor coords */}
      <div className="absolute bottom-2.5 left-3 font-mono text-[10px] text-fog bg-ink/70 border border-line px-2 py-1 tabular">
        {cursor ? fmtCoord(cursor.lat, cursor.lon) : "— CURSOR TRACK —"}
        <span className="text-dim ml-3">ZM {tf.k.toFixed(1)}×</span>
      </div>

      {/* scale bar */}
      <div className="absolute bottom-2.5 right-3 flex items-center gap-2 font-mono text-[9px] text-dim">
        <span>{scaleKm} KM</span>
        <div className="border-b border-l border-r border-dim h-1.5" style={{ width: scaleKm / kmPerPx }} />
      </div>

      {/* hover tooltip */}
      {hover && (
        <div className="absolute pointer-events-none z-20 bg-ink/95 border border-line2 px-2.5 py-1.5 anim-fadeup"
          style={{ left: Math.min(hover.px, W - 220), top: Math.max(8, hover.py - 46) }}>
          <div className="font-display text-[11px] font-semibold tracking-wider text-snow">{hover.label}</div>
          <div className="font-mono text-[9.5px] text-fog tabular">{hover.sub}</div>
        </div>
      )}
    </div>
  );
}

function MissionLayer({ uav, geofenceR, s }: { uav: Uav; geofenceR: number; s: number }) {
  const { select, sel } = useStore();
  const wpD = useMemo(() => {
    const line = { type: "LineString", coordinates: uav.wps.map((w) => [w.lon, w.lat]) } as any;
    return path(line as any) ?? "";
  }, [uav.wps]);
  const fenceD = useMemo(() => {
    const c = circleGen.center([uav.home[1], uav.home[0]]).radius(geofenceR / 111);
    return path(c() as any) ?? "";
  }, [uav.home, geofenceR]);
  const up = projection([uav.lon, uav.lat]);
  const hp = projection([uav.home[1], uav.home[0]]);

  return (
    <g>
      <path d={fenceD} fill="rgba(157,140,255,0.045)" stroke="#9d8cff" strokeWidth={0.9 * s} strokeDasharray={`${6 * s} ${4 * s}`} className={uav.breach ? "anim-blink" : ""} />
      <path d={wpD} fill="none" stroke="#4fd8eb" strokeWidth={1.1 * s} strokeDasharray={`${7 * s} ${5 * s}`} className="dash-crawl" opacity={0.85} />
      {uav.wps.map((w, i) => {
        const p = projection([w.lon, w.lat]); if (!p) return null;
        const done = i < uav.wpIndex; const cur = i === uav.wpIndex && uav.mode === "AUTO";
        return (
          <g key={i} transform={`translate(${p[0]},${p[1]})`} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); select({ kind: "uav", id: uav.id }); }}>
            <g transform={`scale(${s})`}>
              <circle r={cur ? 7 : 5} fill={cur ? "rgba(79,216,235,0.25)" : "rgba(12,21,34,0.9)"} stroke={done ? "#54687e" : cur ? "#4fd8eb" : "#7f97b0"} strokeWidth={cur ? 1.6 : 1} />
              <text textAnchor="middle" dy={3} fontSize={7} fontFamily="IBM Plex Mono" fill={done ? "#54687e" : "#dce8f5"}>{i + 1}</text>
              <text textAnchor="middle" y={-9} fontSize={6.5} fontFamily="IBM Plex Mono" fill="#7f97b0" stroke="#06090f" strokeWidth={2} paintOrder="stroke">{w.action}</text>
            </g>
          </g>
        );
      })}
      {uav.rally.map((r) => {
        const p = projection([r.lon, r.lat]); if (!p) return null;
        return (
          <g key={r.id} transform={`translate(${p[0]},${p[1]}) scale(${s})`}>
            <rect x={-5} y={-5} width={10} height={10} transform="rotate(45)" fill="rgba(85,224,156,0.12)" stroke="#55e09c" strokeWidth={1} />
            <text textAnchor="middle" dy={2.6} fontSize={7} fontFamily="IBM Plex Mono" fill="#55e09c">R</text>
          </g>
        );
      })}
      {hp && (
        <g transform={`translate(${hp[0]},${hp[1]}) scale(${s})`}>
          <circle r={4.5} fill="rgba(255,180,84,0.15)" stroke="#ffb454" strokeWidth={1} />
          <text textAnchor="middle" dy={2.8} fontSize={6.5} fontFamily="IBM Plex Mono" fill="#ffb454">H</text>
        </g>
      )}
      {up && (
        <g transform={`translate(${up[0]},${up[1]})`} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); select({ kind: "uav", id: uav.id }); }}>
          <g transform={`scale(${s})`}>
            <circle r={13} fill="none" stroke="#55e09c" strokeWidth={0.8} opacity={0.5} className={uav.mode !== "STANDBY" ? "anim-pulse-soft" : ""} />
            <g transform={`rotate(${uav.hdg})`}>
              <path d="M0 -7 L5 5 L0 2.6 L-5 5 Z" fill="rgba(85,224,156,0.3)" stroke="#55e09c" strokeWidth={1.2} />
            </g>
            <text textAnchor="middle" y={-17} fontSize={8} fontFamily="IBM Plex Mono" fill="#8fe8b8" stroke="#06090f" strokeWidth={2.4} paintOrder="stroke">{uav.cs}</text>
            {sel?.kind === "uav" && sel.id === uav.id && <circle r={17} fill="none" stroke="#55e09c" strokeWidth={1} />}
          </g>
        </g>
      )}
    </g>
  );
}
