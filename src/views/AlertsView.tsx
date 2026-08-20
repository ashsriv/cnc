import { useState } from "react";
import { BellRing, CheckCheck, Filter, Siren } from "lucide-react";
import { useStore } from "../state/store";
import { Panel, Tag, Dot } from "../components/ui";
import { agoLabel } from "../lib/geo";

export default function AlertsView() {
  const { sim, log } = useStore();
  const [filter, setFilter] = useState<"ALL" | "CRIT" | "WARN" | "INFO">("ALL");
  const [acked, setAcked] = useState<Set<string>>(new Set());

  const items = sim.alerts.filter((a) => filter === "ALL" || a.sev === filter);
  const counts = {
    CRIT: sim.alerts.filter((a) => a.sev === "CRIT").length,
    WARN: sim.alerts.filter((a) => a.sev === "WARN").length,
    INFO: sim.alerts.filter((a) => a.sev === "INFO").length,
  };
  const unacked = sim.alerts.filter((a) => !acked.has(a.id)).length;

  const sevTone = (s: string) => (s === "CRIT" ? "rd" : s === "WARN" ? "am" : "cy") as "rd" | "am" | "cy";
  const sevDot = (s: string) => (s === "CRIT" ? "bg-rd" : s === "WARN" ? "bg-am" : "bg-cy");

  return (
    <div className="flex-1 flex min-h-0 gap-2 m-2">
      {/* summary rail */}
      <aside className="w-[280px] shrink-0 flex flex-col gap-2 min-h-0">
        <Panel title="SEVERITY BREAKDOWN" pad={false}>
          {(["CRIT", "WARN", "INFO"] as const).map((s) => (
            <button key={s} onClick={() => setFilter(filter === s ? "ALL" : s)}
              className={`w-full flex items-center gap-2.5 px-3 py-3 border-b border-line/60 last:border-0 transition-colors ${filter === s ? "bg-panel2/70 border-l-2" : "hover:bg-panel2/40"}`}
              style={filter === s ? { borderLeftColor: s === "CRIT" ? "#ff5d5d" : s === "WARN" ? "#ffb454" : "#4fd8eb" } : {}}>
              <Dot tone={sevDot(s)} blink={s === "CRIT" && counts.CRIT > 0} />
              <span className="font-display text-[11px] font-bold tracking-[0.16em] text-snow flex-1 text-left">{s}</span>
              <span className="font-mono text-[15px] tabular" style={{ color: s === "CRIT" ? "#ff5d5d" : s === "WARN" ? "#ffb454" : "#4fd8eb" }}>{counts[s]}</span>
            </button>
          ))}
        </Panel>

        <Panel title="TRIAGE">
          <div className="space-y-2.5 font-mono text-[9px]">
            <div className="flex justify-between"><span className="text-dim">UNACKNOWLEDGED</span><span className={unacked > 0 ? "text-am tabular" : "text-gn tabular"}>{unacked}</span></div>
            <div className="flex justify-between"><span className="text-dim">WINDOW</span><span className="text-fog tabular">SESSION</span></div>
            <div className="flex justify-between"><span className="text-dim">ESCALATION</span><span className="text-fog">CONSOLE → WIRE</span></div>
          </div>
          <button onClick={() => { setAcked(new Set(sim.alerts.map((a) => a.id))); log("[ALERT] all alerts acknowledged by OP-7"); }}
            className="mt-3 w-full flex items-center justify-center gap-1.5 border border-gn/50 text-gn py-1.5 font-display text-[10px] font-bold tracking-[0.15em] hover:bg-gn/15 transition-colors">
            <CheckCheck size={12} /> ACK ALL
          </button>
        </Panel>

        <Panel title="ALERT ROUTING">
          <p className="font-mono text-[8.5px] text-dim leading-relaxed">
            Rules from the <span className="text-cy">WATCHLIST</span> module evaluate every fusion tick. CRIT events are mirrored to the intel wire and raise the THREATCON strip.
          </p>
        </Panel>
      </aside>

      {/* stream */}
      <section className="flex-1 min-w-0 flex flex-col min-h-0">
        <Panel className="flex-1 flex flex-col min-h-0" pad={false}
          title={<span className="flex items-center gap-1.5"><BellRing size={11} className="text-am" /> LIVE ALERT STREAM</span>}
          right={<div className="flex items-center gap-1.5">
            <Filter size={11} className="text-dim" />
            {(["ALL", "CRIT", "WARN", "INFO"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-2 py-0.5 border font-mono text-[9px] tracking-wider transition-colors ${filter === f ? "border-am/60 text-am bg-am/10" : "border-line2 text-dim hover:text-fog"}`}>{f}</button>
            ))}
          </div>}>
          <div className="flex-1 overflow-y-auto">
            {items.length === 0 && (
              <div className="p-10 text-center">
                <Siren size={22} className="mx-auto text-dim" />
                <p className="font-mono text-[10px] text-dim mt-2">NO ALERTS IN THIS LANE<br />fusion bus is quiet</p>
              </div>
            )}
            {items.map((a) => {
              const isAcked = acked.has(a.id);
              return (
                <div key={a.id} className={`group flex gap-3 px-4 py-3 border-b border-line/50 last:border-0 anim-fadeup hover:bg-panel2/50 transition-colors ${isAcked ? "opacity-45" : ""}`}>
                  <div className="flex flex-col items-center pt-1">
                    <Dot tone={sevDot(a.sev)} blink={a.sev === "CRIT" && !isAcked} />
                    <span className="w-px flex-1 bg-line mt-1.5" />
                  </div>
                  <div className="min-w-0 flex-1 pb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Tag tone={sevTone(a.sev)}>{a.sev}</Tag>
                      <span className="font-mono text-[8.5px] text-dim tabular">{agoLabel(a.t, sim.t)}</span>
                      <span className="font-mono text-[8px] text-dim">{a.id}</span>
                      {isAcked && <span className="font-mono text-[8px] text-gn flex items-center gap-0.5"><CheckCheck size={9} /> ACKED</span>}
                    </div>
                    <p className={`text-[12px] leading-snug mt-1.5 ${a.sev === "CRIT" ? "text-snow font-medium" : "text-snow/90"}`}>{a.msg}</p>
                  </div>
                  {!isAcked && (
                    <button onClick={() => { setAcked((s) => new Set(s).add(a.id)); log(`[ALERT] ${a.id} acknowledged`); }}
                      className="self-center opacity-0 group-hover:opacity-100 border border-line2 px-2 py-1 font-mono text-[8.5px] text-fog hover:text-gn hover:border-gn/50 transition-all shrink-0">
                      ACK
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      </section>
    </div>
  );
}
