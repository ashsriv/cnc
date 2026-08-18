import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { useStore } from "../state/store";
import { Dot } from "./ui";
import SettingsModal from "./SettingsModal";
import { SOURCE_META } from "../lib/live";
import type { SourceState } from "../lib/types";

const ST_STYLE: Record<SourceState, { c: string; dot: string; note: string }> = {
  LIVE: { c: "text-gn border-gn/40", dot: "bg-gn", note: "real-time ingest" },
  CONNECTING: { c: "text-am border-am/30", dot: "bg-am anim-blink", note: "negotiating…" },
  SIM: { c: "text-fog border-line2", dot: "bg-fog/70", note: "unreachable · synthetic fallback" },
  ERROR: { c: "text-rd border-rd/40", dot: "bg-rd", note: "query failed" },
  STANDBY: { c: "text-dim border-line", dot: "bg-dim", note: "on-demand" },
};

const THREATS = [
  { n: "GREEN", c: "text-gn", bg: "bg-gn" },
  { n: "GUARDED", c: "text-tl", bg: "bg-tl" },
  { n: "ELEVATED", c: "text-am", bg: "bg-am" },
  { n: "HIGH", c: "text-or", bg: "bg-or" },
  { n: "SEVERE", c: "text-rd", bg: "bg-rd" },
];

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 250);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-right leading-none">
      <div className="font-mono text-[15px] text-snow tabular tracking-widest">{now.toISOString().slice(11, 19)}<span className="text-cy text-[10px]"> UTC</span></div>
      <div className="font-mono text-[9px] text-dim tabular mt-0.5">{now.toISOString().slice(0, 10)} · JD{Math.floor((Date.now() / 86400000) + 2440587.5)}</div>
    </div>
  );
}

export default function TopBar() {
  const { threat, setThreat, sim, setSettingsOpen } = useStore();
  const packets = 1284331 + sim.t * 412 + (sim.t % 7) * 31;
  const t = THREATS[threat];

  return (
    <>
    <header className="h-12 shrink-0 flex items-stretch border-b border-line bg-panel/90 relative z-30">
      {/* brand */}
      <div className="flex items-center gap-2.5 pl-3 pr-4 border-r border-line">
        <svg width="26" height="26" viewBox="0 0 32 32" className="shrink-0">
          <circle cx="16" cy="16" r="10.5" fill="none" stroke="#4fd8eb" strokeWidth="1.6" opacity="0.9" />
          <circle cx="16" cy="16" r="4.5" fill="none" stroke="#4fd8eb" strokeWidth="1.2" opacity="0.6" />
          <path d="M16 1.5v8M16 22.5v8M1.5 16h8M22.5 16h8" stroke="#4fd8eb" strokeWidth="1.6" />
          <circle cx="16" cy="16" r="2" fill="#ffb454" />
        </svg>
        <div className="leading-none">
          <div className="font-display font-bold text-[17px] tracking-[0.22em] text-snow">
            AEGIS<span className="text-cy"> C2</span>
          </div>
          <div className="font-mono text-[8.5px] tracking-[0.3em] text-dim mt-0.5">OSINT COMMAND CONSOLE · v4.2.1</div>
        </div>
      </div>

      {/* module context */}
      <div className="hidden lg:flex items-center gap-2 pl-4 border-r border-line">
        <Dot tone="bg-gn" blink />
        <span className="font-mono text-[10px] text-fog tracking-widest">SENSOR MESH <span className="text-gn">14/14</span></span>
        <span className="text-line2">|</span>
        <span className="font-mono text-[10px] text-fog tracking-widest">SATLINK <span className="text-cy tabular">{18 + (sim.t % 9)}ms</span></span>
        <span className="text-line2">|</span>
        <span className="font-mono text-[10px] text-fog tracking-widest">PKTS <span className="text-snow tabular">{packets.toLocaleString("en-US")}</span></span>
      </div>

      <div className="flex-1" />

      {/* uplink configuration */}
      <div className="hidden md:flex items-center border-l border-line px-3">
        <button onClick={() => setSettingsOpen(true)} title="Uplink configuration · AIS key"
          className="w-8 h-8 border border-line2 text-fog hover:text-cy hover:border-cy/50 hover:shadow-[0_0_12px_rgba(79,216,235,0.2)] flex items-center justify-center transition-all">
          <Settings size={14} />
        </button>
      </div>

      {/* threat condition */}
      <div className="hidden md:flex items-center gap-2 pr-4 border-l border-line pl-4">
        <span className="font-mono text-[9px] text-dim tracking-[0.2em]">THREATCON</span>
        <div className="flex">
          {THREATS.map((th, i) => (
            <button key={th.n} onClick={() => setThreat(i)}
              className={`px-2 py-1 font-display text-[9.5px] font-semibold tracking-widest border transition-all duration-200 ${i === threat
                ? `${th.c} ${th.bg}/15 border-current shadow-[0_0_12px_rgba(255,255,255,0.06)]`
                : "text-dim border-line hover:text-fog hover:border-line2"} ${i > 0 ? "-ml-px" : ""}`}>
              {th.n}
            </button>
          ))}
        </div>
      </div>

      {/* clock + operator */}
      <div className="flex items-center gap-3 pl-4 pr-3 border-l border-line">
        <Clock />
        <div className="hidden xl:block text-right leading-tight border-l border-line pl-3">
          <div className="font-display text-[10px] font-semibold tracking-[0.18em] text-cy">OP-7 · NIGHTOWL</div>
          <div className="font-mono text-[8.5px] text-dim">CLEARANCE: TS//NOFORN-SIM</div>
        </div>
      </div>

      {/* threat strip glow */}
      <div className={`absolute bottom-0 left-0 right-0 h-px ${t.bg} opacity-40`} />
    </header>
    <SettingsModal />
    </>
  );
}
