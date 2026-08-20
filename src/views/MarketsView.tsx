import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, CandlestickChart, RefreshCw } from "lucide-react";
import { useStore } from "../state/store";
import { Panel, Tag, Spark, Btn } from "../components/ui";
import { fetchOhlc } from "../lib/live";

function fmtPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (p >= 1) return p.toFixed(2);
  return p.toFixed(4);
}

function Candles({ ohlc }: { ohlc: [number, number, number, number, number][] }) {
  if (ohlc.length < 2) return <div className="h-full flex items-center justify-center font-mono text-[10px] text-dim">LOADING CANDLES…</div>;
  const w = 640, h = 220, pad = 8;
  const highs = ohlc.map((c) => c[2]), lows = ohlc.map((c) => c[3]);
  const max = Math.max(...highs), min = Math.min(...lows), span = max - min || 1;
  const y = (v: number) => h - pad - ((v - min) / span) * (h - pad * 2);
  const bw = (w - pad * 2) / ohlc.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h }}>
      {[0.25, 0.5, 0.75].map((f) => {
        const gy = pad + f * (h - pad * 2);
        const val = max - f * span;
        return <g key={f}><line x1="0" y1={gy} x2={w} y2={gy} stroke="#1c2d42" strokeWidth="0.6" strokeDasharray="3 5" /><text x={w - 4} y={gy - 3} textAnchor="end" fontSize="7.5" fill="#54687e" fontFamily="IBM Plex Mono">{fmtPrice(val)}</text></g>;
      })}
      {ohlc.map((c, i) => {
        const [, o, hi, lo, cl] = c;
        const up = cl >= o;
        const color = up ? "#55e09c" : "#ff5d5d";
        const cx = pad + i * bw + bw / 2;
        const bodyTop = y(Math.max(o, cl)), bodyBot = y(Math.min(o, cl));
        return (
          <g key={i}>
            <line x1={cx} y1={y(hi)} x2={cx} y2={y(lo)} stroke={color} strokeWidth="1" />
            <rect x={cx - bw * 0.32} y={bodyTop} width={bw * 0.64} height={Math.max(1.5, bodyBot - bodyTop)} fill={color} opacity="0.9" />
          </g>
        );
      })}
    </svg>
  );
}

export default function MarketsView() {
  const { marketsData, sources, log, setView } = useStore();
  const [selId, setSelId] = useState("bitcoin");
  const [range, setRange] = useState(7);
  const [ohlc, setOhlc] = useState<[number, number, number, number, number][]>([]);
  const [loading, setLoading] = useState(false);

  const sel = marketsData.find((c) => c.id === selId) ?? marketsData[0];

  useEffect(() => {
    let stop = false;
    const load = async () => {
      if (!sel) return;
      setLoading(true);
      try {
        const c = await fetchOhlc(sel.id, range);
        if (!stop) setOhlc(c);
      } catch { if (!stop) setOhlc([]); }
      if (!stop) setLoading(false);
    };
    load();
    return () => { stop = true; };
  }, [selId, range, sel]);

  const up = marketsData.filter((c) => c.change24h >= 0).length;
  const best = [...marketsData].sort((a, b) => b.change24h - a.change24h)[0];
  const worst = [...marketsData].sort((a, b) => a.change24h - b.change24h)[0];

  return (
    <div className="flex-1 flex min-h-0 gap-2 m-2">
      {/* watchlist */}
      <section className="w-[340px] shrink-0 flex flex-col min-h-0">
        <Panel className="flex-1 flex flex-col min-h-0" pad={false}
          title="CRYPTO WATCHLIST"
          right={<div className="flex items-center gap-1.5">
            <Tag tone={sources.COINGECKO === "LIVE" ? "gn" : "fog"}>{sources.COINGECKO}</Tag>
            <Tag tone="fog">{marketsData.length} CCY</Tag>
          </div>}>
          <div className="px-3 py-2 border-b border-line bg-panel2/40 font-mono text-[9px] text-dim flex justify-between">
            <span>BREADTH <span className={up >= marketsData.length / 2 ? "text-gn" : "text-rd"}>{up}/{marketsData.length} UP</span></span>
            <span>FEED {sources.COINGECKO === "LIVE" ? "COINGECKO · KEYLESS" : "—"}</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {marketsData.length === 0 && (
              <div className="p-6 text-center">
                <RefreshCw size={18} className="mx-auto text-dim animate-spin" />
                <p className="font-mono text-[9.5px] text-dim mt-2">CONTACTING COINGECKO…<br />{sources.COINGECKO === "SIM" ? "FEED UNREACHABLE" : ""}</p>
              </div>
            )}
            {marketsData.map((c) => {
              const pos = c.change24h >= 0;
              const active = sel?.id === c.id;
              return (
                <button key={c.id} onClick={() => { setSelId(c.id); log(`[MKT] focus ${c.symbol}`); }}
                  className={`w-full text-left px-3 py-2 border-b border-line/60 last:border-0 transition-colors ${active ? "bg-cy/8 border-l-2 border-l-cy" : "hover:bg-panel2/60"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {pos ? <TrendingUp size={13} className="text-gn" /> : <TrendingDown size={13} className="text-rd" />}
                      <div>
                        <div className="font-display font-bold text-[13px] tracking-wider text-snow">{c.symbol}</div>
                        <div className="font-mono text-[8px] text-dim uppercase">{c.name}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-[12px] text-snow tabular">${fmtPrice(c.price)}</div>
                      <div className={`font-mono text-[9.5px] tabular ${pos ? "text-gn" : "text-rd"}`}>{pos ? "▲" : "▼"} {Math.abs(c.change24h).toFixed(2)}%</div>
                    </div>
                  </div>
                  <div className="mt-1.5 -mb-0.5"><Spark data={c.spark} tone={pos ? "#55e09c" : "#ff5d5d"} h={22} w={290} /></div>
                </button>
              );
            })}
          </div>
        </Panel>
      </section>

      {/* chart + context */}
      <section className="flex-1 min-w-0 flex flex-col gap-2 min-h-0">
        <Panel className="flex-[1.4] min-h-0 flex flex-col" pad={false}
          title={<span className="flex items-center gap-1.5"><CandlestickChart size={11} className="text-cy" /> {sel ? `${sel.name} · ${sel.symbol}/USD` : "SELECT AN INSTRUMENT"}</span>}
          right={
            <div className="flex gap-1">
              {[["1D", 1], ["7D", 7], ["30D", 30], ["90D", 90]].map(([l, d]) => (
                <button key={l} onClick={() => setRange(d as number)}
                  className={`px-2 py-0.5 border font-mono text-[9px] tracking-wider transition-colors ${range === d ? "border-cy/60 text-cy bg-cy/10" : "border-line2 text-dim hover:text-fog"}`}>{l}</button>
              ))}
            </div>
          }>
          <div className="flex-1 p-2 min-h-0">
            {loading ? (
              <div className="h-full flex items-center justify-center"><RefreshCw size={18} className="text-dim animate-spin" /></div>
            ) : (
              <Candles ohlc={ohlc} />
            )}
          </div>
          <div className="px-3 py-1.5 border-t border-line bg-panel2/40 flex justify-between font-mono text-[8.5px] text-dim">
            <span>{ohlc.length} CANDLES · {range === 1 ? "30-MIN" : range === 7 ? "4-HR" : "DAILY"} BARS · COINGECKO OHLC</span>
            <span>{sel ? `LAST $${fmtPrice(sel.price)}` : ""}</span>
          </div>
        </Panel>

        <div className="grid grid-cols-4 gap-2">
          <Panel title="24H HIGH / LOW"><div className="font-mono text-[10px] space-y-1">
            {sel ? (<>
              <div className="flex justify-between"><span className="text-dim">MKT CAP RANK</span><span className="text-snow tabular">#{marketsData.findIndex((c) => c.id === sel.id) + 1}</span></div>
              <div className="flex justify-between"><span className="text-dim">24H Δ</span><span className={`tabular ${sel.change24h >= 0 ? "text-gn" : "text-rd"}`}>{sel.change24h >= 0 ? "+" : ""}{sel.change24h.toFixed(2)}%</span></div>
            </>) : <span className="text-dim">—</span>}
          </div></Panel>
          <Panel title="SESSION BEST" pad={false}><div className="p-3">
            {best && <><div className="font-display font-bold text-[14px] text-gn">{best.symbol}</div><div className="font-mono text-[9.5px] text-gn tabular">▲ {best.change24h.toFixed(2)}%</div></>}
          </div></Panel>
          <Panel title="SESSION WORST" pad={false}><div className="p-3">
            {worst && <><div className="font-display font-bold text-[14px] text-rd">{worst.symbol}</div><div className="font-mono text-[9.5px] text-rd tabular">▼ {Math.abs(worst.change24h).toFixed(2)}%</div></>}
          </div></Panel>
          <Panel title="OSINT CROSS-LINK" pad={false}><div className="p-3">
            <p className="font-mono text-[8.5px] text-dim leading-relaxed">Crypto flows feed the <span className="text-cy">ENTITY</span> wallet-intel module. Sanctioned addresses are OFAC-screened.</p>
            <Btn small tone="fog" onClick={() => { log("[MKT] pivot → entity wallet intel"); setView("entities"); }}><span className="text-[9px]">OPEN ENTITIES</span></Btn>
          </div></Panel>
        </div>
      </section>
    </div>
  );
}
