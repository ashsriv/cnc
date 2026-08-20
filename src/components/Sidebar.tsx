import { Globe2, Newspaper, Terminal, Fingerprint, Navigation, BellRing, BarChart3, Orbit, CandlestickChart, Network, Siren } from "lucide-react";
import type { View } from "../lib/types";
import { useStore } from "../state/store";

const NAV: { v: View; label: string; icon: any; hint: string }[] = [
  { v: "ops", label: "GLOBAL OPS", icon: Globe2, hint: "sensor fusion map" },
  { v: "analytics", label: "ANALYTICS", icon: BarChart3, hint: "sensor fusion metrics" },
  { v: "space", label: "SPACE", icon: Orbit, hint: "solar weather · NOAA SWPC" },
  { v: "markets", label: "MARKETS", icon: CandlestickChart, hint: "crypto · CoinGecko" },
  { v: "feed", label: "INTEL FEED", icon: Newspaper, hint: "AI aggregation" },
  { v: "recon", label: "RECON", icon: Terminal, hint: "DNS · WHOIS · IP · SSL" },
  { v: "entities", label: "ENTITIES", icon: Fingerprint, hint: "wallets · SDN · TG" },
  { v: "graph", label: "GRAPH", icon: Network, hint: "entity correlation" },
  { v: "missions", label: "MISSIONS", icon: Navigation, hint: "UAS control" },
  { v: "alerts", label: "ALERTS", icon: Siren, hint: "live alert stream" },
  { v: "watch", label: "WATCHLIST", icon: BellRing, hint: "rules & alerts" },
];

function Radar() {
  return (
    <div className="relative w-[74px] h-[74px] rounded-full border border-line2 bg-abyss overflow-hidden mx-auto">
      <div className="absolute inset-0 radar-sweep rounded-full" />
      <div className="absolute inset-[24%] rounded-full border border-line" />
      <div className="absolute inset-[46%] rounded-full border border-line/70" />
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-line/60" />
      <div className="absolute top-1/2 left-0 right-0 h-px bg-line/60" />
      <span className="absolute w-1 h-1 rounded-full bg-gn" style={{ left: "30%", top: "26%" }} />
      <span className="absolute w-1 h-1 rounded-full bg-am anim-blink" style={{ left: "64%", top: "58%" }} />
      <span className="absolute w-1 h-1 rounded-full bg-cy" style={{ left: "44%", top: "70%" }} />
      <span className="absolute bottom-0.5 inset-x-0 text-center font-mono text-[7px] text-dim tracking-[0.2em]">SWEEP 3.6S</span>
    </div>
  );
}

export default function Sidebar() {
  const { view, setView, sim, marketsData, spaceData } = useStore();
  const crit = sim.alerts.filter((a) => a.sev === "CRIT" && sim.t - a.t < 240).length;
  const airborne = sim.uavs.filter((u) => u.mode !== "STANDBY").length;

  const badges: Partial<Record<View, { n: number; tone: string }>> = {
    watch: crit > 0 ? { n: crit, tone: "bg-rd text-ink" } : { n: sim.alerts.length, tone: "bg-line2 text-snow" },
    alerts: crit > 0 ? { n: crit, tone: "bg-rd text-ink" } : { n: sim.alerts.length, tone: "bg-line2 text-snow" },
    missions: { n: airborne, tone: "bg-gn/90 text-ink" },
    feed: { n: sim.news.filter((x) => x.priority === "FLASH").length, tone: "bg-am text-ink" },
    markets: { n: marketsData.filter((c) => c.change24h >= 0).length, tone: "bg-tl text-ink" },
    space: spaceData && spaceData.kpNow >= 5 ? { n: 1, tone: "bg-am text-ink" } : undefined,
  };

  return (
    <nav className="w-[76px] shrink-0 border-r border-line bg-panel/80 flex flex-col items-stretch py-2 relative z-20">
      {NAV.map(({ v, label, icon: Icon, hint }) => {
        const active = view === v;
        const b = badges[v];
        return (
          <button key={v} onClick={() => setView(v)} title={hint}
            className={`relative group mx-1.5 my-0.5 py-2.5 flex flex-col items-center gap-1 border transition-all duration-200
              ${active ? "border-cy/50 bg-cy/10 text-cy shadow-[inset_2px_0_0_#4fd8eb]" : "border-transparent text-dim hover:text-fog hover:bg-panel2"}`}>
            <Icon size={17} strokeWidth={active ? 2.2 : 1.7} />
            <span className="font-display text-[7.5px] font-semibold tracking-[0.14em]">{label}</span>
            {b && b.n > 0 && (
              <span className={`absolute top-1 right-1.5 min-w-[14px] h-[14px] px-0.5 text-[8px] font-mono flex items-center justify-center ${b.tone}`}>{b.n}</span>
            )}
            {/* hover tooltip */}
            <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap bg-ink border border-line2 px-2 py-1 font-mono text-[9px] text-fog opacity-0 group-hover:opacity-100 transition-opacity z-50">
              {label} — {hint}
            </span>
          </button>
        );
      })}

      <div className="flex-1" />
      <div className="px-1 pb-2">
        <Radar />
        <div className="mt-2 text-center font-mono text-[8px] text-dim leading-relaxed">
          NODE FRA-02<br />
          <span className="text-gn">SYNC OK</span> · <span className="tabular">{(sim.t % 97) + 3}s</span>
        </div>
      </div>
    </nav>
  );
}
