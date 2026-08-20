import { useEffect, useMemo, useRef, useState } from "react";
import { Network, Fingerprint } from "lucide-react";
import { useStore } from "../state/store";
import { Panel, Tag } from "../components/ui";
import { seedWallets, seedSdn, seedTg } from "../data/seed";

interface GNode { id: string; label: string; type: string; x: number; y: number; vx: number; vy: number; r: number; }
interface GLink { a: string; b: string; kind: string; }

const TYPE_COLOR: Record<string, string> = {
  WALLET: "#ffb454", SDN: "#ff5d5d", DOMAIN: "#4fd8eb", IP: "#45d0b8",
  VESSEL: "#9d8cff", FLIGHT: "#4fd8eb", SAT: "#9d8cff", SEISMIC: "#ff8a3d",
  CONFLICT: "#ff5d5d", CHANNEL: "#45d0b8",
};

export default function GraphView() {
  const { sim, setView, log } = useStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<GNode[]>([]);
  const [hover, setHover] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; px: number; py: number } | null>(null);
  const nodesRef = useRef<GNode[]>([]);
  nodesRef.current = nodes;

  const { initNodes, links } = useMemo(() => {
    const W = 900, H = 560;
    const mk = (id: string, label: string, type: string, r = 14): GNode => ({
      id, label, type, r,
      x: W / 2 + (Math.random() - 0.5) * 400, y: H / 2 + (Math.random() - 0.5) * 300, vx: 0, vy: 0,
    });
    const n: GNode[] = [];
    const l: GLink[] = [];

    seedWallets.forEach((w) => { n.push(mk(`w-${w.id}`, w.label, "WALLET", 16)); });
    seedSdn.slice(0, 6).forEach((s) => { n.push(mk(`s-${s.id}`, s.name.slice(0, 18), "SDN", 15)); });
    sim.ships.slice(0, 5).forEach((sh) => { n.push(mk(`v-${sh.id}`, sh.name.split("·")[0].trim().slice(0, 16), "VESSEL", 13)); });
    sim.flights.filter((f) => f.mil).slice(0, 4).forEach((f) => { n.push(mk(`f-${f.id}`, f.cs, "FLIGHT", 12)); });
    sim.sats.slice(0, 4).forEach((s) => { n.push(mk(`sa-${s.id}`, s.name.slice(0, 16), "SAT", 12)); });
    sim.quakes.slice(0, 3).forEach((q) => { n.push(mk(`q-${q.id}`, `M${q.mag}`, "SEISMIC", 12)); });
    sim.conflicts.slice(0, 4).forEach((c) => { n.push(mk(`c-${c.id}`, c.name.slice(0, 16), "CONFLICT", 15)); });
    seedTg.slice(0, 3).forEach((t) => { n.push(mk(`t-${t.id}`, t.handle, "CHANNEL", 12)); });
    n.push(mk("d-1", "vostok-digital.ru", "DOMAIN", 13));
    n.push(mk("d-2", "nordstream-log.lv", "DOMAIN", 13));
    n.push(mk("ip-1", "91.242.217.40", "IP", 12));

    // links: wallet→SDN sanctions, domain→ip recon, vessel→conflict, etc.
    seedWallets.slice(0, 3).forEach((w, i) => { if (seedSdn[i]) l.push({ a: `w-${w.id}`, b: `s-${seedSdn[i].id}`, kind: "OFAC MATCH" }); });
    l.push({ a: "d-1", b: "ip-1", kind: "RESOLVES" });
    l.push({ a: "d-2", b: "ip-1", kind: "SHARED INFRA" });
    if (seedSdn[0]) l.push({ a: "d-1", b: `s-${seedSdn[0].id}`, kind: "REGISTRANT" });
    sim.ships.slice(0, 3).forEach((sh, i) => { if (sim.conflicts[i]) l.push({ a: `v-${sh.id}`, b: `c-${sim.conflicts[i].id}`, kind: "PROXIMITY" }); });
    sim.flights.filter((f) => f.mil).slice(0, 3).forEach((f, i) => { if (sim.conflicts[i]) l.push({ a: `f-${f.id}`, b: `c-${sim.conflicts[i].id}`, kind: "SORTIE" }); });
    sim.sats.slice(0, 3).forEach((s, i) => { if (sim.conflicts[i]) l.push({ a: `sa-${s.id}`, b: `c-${sim.conflicts[i].id}`, kind: "EO TASKING" }); });
    seedTg.slice(0, 3).forEach((t, i) => { if (sim.conflicts[i]) l.push({ a: `t-${t.id}`, b: `c-${sim.conflicts[i].id}`, kind: "GEOPOST" }); });
    sim.quakes.slice(0, 2).forEach((q, i) => { if (seedTg[i]) l.push({ a: `q-${q.id}`, b: `t-${seedTg[i].id}`, kind: "MENTION" }); });

    return { initNodes: n, links: l };
  }, [sim.ships, sim.flights, sim.sats, sim.quakes, sim.conflicts]);

  useEffect(() => {
    setNodes(initNodes);
  }, [initNodes]);

  // force simulation
  useEffect(() => {
    if (nodes.length === 0) return;
    const W = 900, H = 560;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    let raf: number;
    let alpha = 1;
    const tick = () => {
      const ns = nodesRef.current.map((n) => ({ ...n }));
      const idx = new Map(ns.map((n, i) => [n.id, i]));
      // repulsion
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          let dx = ns[j].x - ns[i].x, dy = ns[j].y - ns[i].y;
          let d2 = dx * dx + dy * dy || 1;
          const d = Math.sqrt(d2);
          const f = (2600 * alpha) / d2;
          dx /= d; dy /= d;
          ns[i].vx -= dx * f; ns[i].vy -= dy * f;
          ns[j].vx += dx * f; ns[j].vy += dy * f;
        }
      }
      // springs
      for (const lk of links) {
        const ia = idx.get(lk.a), ib = idx.get(lk.b);
        if (ia === undefined || ib === undefined) continue;
        const a = ns[ia], b = ns[ib];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = (d - 130) * 0.012 * alpha;
        a.vx += (dx / d) * f; a.vy += (dy / d) * f;
        b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
      }
      // integrate + center gravity
      for (const n of ns) {
        n.vx += (W / 2 - n.x) * 0.002 * alpha;
        n.vy += (H / 2 - n.y) * 0.002 * alpha;
        n.vx *= 0.82; n.vy *= 0.82;
        if (dragRef.current?.id !== n.id) { n.x += n.vx; n.y += n.vy; }
        n.x = Math.max(30, Math.min(W - 30, n.x));
        n.y = Math.max(30, Math.min(H - 30, n.y));
      }
      setNodes(ns);
      alpha *= 0.985;
      if (alpha > 0.02 || dragRef.current) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [nodes.length, links]);

  const reheat = () => {
    // nudge to restart sim
    setNodes((ns) => ns.map((n) => ({ ...n, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6 })));
  };

  const toVB = (e: React.PointerEvent): [number, number] => {
    const r = svgRef.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 900, ((e.clientY - r.top) / r.height) * 560];
  };

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const hovered = hover ? byId.get(hover) : null;

  return (
    <div className="flex-1 flex min-h-0 gap-2 m-2">
      <section className="flex-1 min-w-0 flex flex-col min-h-0">
        <Panel className="flex-1 flex flex-col min-h-0" pad={false}
          title={<span className="flex items-center gap-1.5"><Network size={11} className="text-vio" /> ENTITY CORRELATION GRAPH</span>}
          right={<div className="flex items-center gap-1.5">
            <Tag tone="vio">{nodes.length} NODES</Tag>
            <Tag tone="cy">{links.length} LINKS</Tag>
            <button onClick={reheat} className="px-2 py-0.5 border border-line2 font-mono text-[9px] text-fog hover:text-vio hover:border-vio/50 transition-colors">REHEAT</button>
          </div>}>
          <div className="flex-1 min-h-0 bg-abyss relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 60% at 50% 45%, rgba(157,140,255,0.07), transparent 65%)" }} />
            <svg ref={svgRef} viewBox="0 0 900 560" className="w-full h-full block cursor-grab select-none touch-none">
              {links.map((lk, i) => {
                const a = byId.get(lk.a), b = byId.get(lk.b);
                if (!a || !b) return null;
                const hot = hover === lk.a || hover === lk.b;
                return <g key={i}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={hot ? "#9d8cff" : "#2c445f"} strokeWidth={hot ? 1.6 : 0.8} opacity={hot ? 0.95 : 0.5} className={hot ? "dash-crawl" : ""} />
                  {hot && <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4} textAnchor="middle" fontSize="8" fill="#9d8cff" fontFamily="IBM Plex Mono" stroke="#06090f" strokeWidth="2.5" paintOrder="stroke">{lk.kind}</text>}
                </g>;
              })}
              {nodes.map((n) => {
                const c = TYPE_COLOR[n.type] ?? "#7f97b0";
                const active = hover === n.id;
                return (
                  <g key={n.id} transform={`translate(${n.x},${n.y})`} className="cursor-pointer"
                    onPointerDown={(e) => { const [px, py] = toVB(e); dragRef.current = { id: n.id, px, py }; (e.target as Element).setPointerCapture?.(e.pointerId); }}
                    onPointerMove={(e) => {
                      if (dragRef.current?.id === n.id) {
                        const [px, py] = toVB(e);
                        setNodes((ns) => ns.map((m) => (m.id === n.id ? { ...m, x: px, y: py, vx: 0, vy: 0 } : m)));
                      }
                    }}
                    onPointerUp={() => { dragRef.current = null; }}
                    onPointerEnter={() => setHover(n.id)}
                    onPointerLeave={() => setHover(null)}>
                    {active && <circle r={n.r + 6} fill="none" stroke={c} strokeWidth="1" opacity="0.5" className="anim-pulse-soft" />}
                    <circle r={n.r} fill={`${c}22`} stroke={c} strokeWidth={active ? 2 : 1.2} />
                    <text textAnchor="middle" dy="3.5" fontSize="8.5" fill={c} fontFamily="IBM Plex Mono" fontWeight="600">{n.type.slice(0, 2)}</text>
                    <text textAnchor="middle" y={n.r + 11} fontSize="8.5" fill={active ? "#dce8f5" : "#7f97b0"} fontFamily="IBM Plex Mono" stroke="#06090f" strokeWidth="2.5" paintOrder="stroke">{n.label}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        </Panel>
      </section>

      <aside className="w-[280px] shrink-0 flex flex-col gap-2 min-h-0">
        <Panel title="LEGEND" pad={false}>
          <div className="p-3 grid grid-cols-2 gap-x-2 gap-y-1.5">
            {Object.entries(TYPE_COLOR).map(([t, c]) => (
              <div key={t} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full border" style={{ borderColor: c, background: `${c}33` }} />
                <span className="font-mono text-[9px] text-fog">{t}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="SELECTED NODE">
          {!hovered ? (
            <p className="font-mono text-[9px] text-dim flex items-center gap-2"><Fingerprint size={12} /> hover / drag a node to inspect its links</p>
          ) : (
            <div className="anim-fadeup">
              <div className="font-display font-bold text-[14px]" style={{ color: TYPE_COLOR[hovered.type] }}>{hovered.label}</div>
              <div className="font-mono text-[9px] text-dim mt-0.5">{hovered.type} · {links.filter((l) => l.a === hovered.id || l.b === hovered.id).length} links</div>
              <div className="mt-2 space-y-1">
                {links.filter((l) => l.a === hovered.id || l.b === hovered.id).map((l, i) => {
                  const other = l.a === hovered.id ? byId.get(l.b) : byId.get(l.a);
                  return other ? (
                    <div key={i} className="flex items-center gap-2 font-mono text-[8.5px]">
                      <span className="text-vio">{l.kind}</span>
                      <span className="text-dim">→</span>
                      <span className="text-fog truncate">{other.label}</span>
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          )}
        </Panel>

        <Panel title="FUSION NOTE">
          <p className="font-mono text-[8.5px] text-dim leading-relaxed">
            Graph is rebuilt from the live entity pool each cycle — wallets, SDN matches, dark vessels, sorties, EO tasking and geoparsed Telegram posts. Link labels show the correlator's reasoning.
          </p>
          <button onClick={() => { setView("analytics"); log("[GRAPH] pivot → fusion analytics"); }}
            className="mt-2 w-full border border-line2 py-1.5 font-display text-[9.5px] font-semibold tracking-[0.15em] text-fog hover:text-vio hover:border-vio/50 transition-colors">
            OPEN FUSION ANALYTICS →
          </button>
        </Panel>
      </aside>
    </div>
  );
}
