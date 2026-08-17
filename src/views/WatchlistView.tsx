import { useState } from "react";
import { BellRing, Plus, Download } from "lucide-react";
import { useStore } from "../state/store";
import { Panel, Tag, Btn, Dot } from "../components/ui";
import { agoLabel } from "../lib/geo";

const ENTITIES = ["SEISMIC", "AIS", "ADS-B", "OFAC", "WALLET", "UAS", "GEOFENCE", "TELEGRAM", "FIRMS", "CCTV"];
const METRICS = ["MAGNITUDE", "DARK PERIOD (H)", "MATCH SCORE (%)", "BATTERY (%)", "VELOCITY ($/H)", "BREACH", "VOLUME Δ (%)", "FRP (MW)", "VIEWERS Δ (%)"];

export default function WatchlistView() {
  const { sim, addRule, toggleRule, log } = useStore();
  const [entity, setEntity] = useState("SEISMIC");
  const [metric, setMetric] = useState("MAGNITUDE");
  const [op, setOp] = useState("≥");
  const [threshold, setThreshold] = useState("6.0");
  const [exported, setExported] = useState(false);

  const active = sim.rules.filter((r) => r.active).length;

  return (
    <div className="flex-1 flex min-h-0 gap-2 m-2">
      <section className="flex-1 min-w-0 flex flex-col gap-2">
        {/* new rule */}
        <Panel title="ARM NEW WATCH RULE" right={<Tag tone="cy">{sim.rules.length} RULES · {active} ARMED</Tag>}>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <div className="font-mono text-[8.5px] text-dim tracking-widest mb-1">ENTITY</div>
              <select value={entity} onChange={(e) => setEntity(e.target.value)} className="bg-ink border border-line2 px-2 py-1.5 font-mono text-[10.5px] text-snow">
                {ENTITIES.map((e) => <option key={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <div className="font-mono text-[8.5px] text-dim tracking-widest mb-1">METRIC</div>
              <select value={metric} onChange={(e) => setMetric(e.target.value)} className="bg-ink border border-line2 px-2 py-1.5 font-mono text-[10.5px] text-snow">
                {METRICS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <div className="font-mono text-[8.5px] text-dim tracking-widest mb-1">OPERATOR</div>
              <select value={op} onChange={(e) => setOp(e.target.value)} className="bg-ink border border-line2 px-2 py-1.5 font-mono text-[10.5px] text-snow">
                {["≥", "≤", "==", "≠"].map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <div className="font-mono text-[8.5px] text-dim tracking-widest mb-1">THRESHOLD</div>
              <input value={threshold} onChange={(e) => setThreshold(e.target.value)}
                className="w-24 bg-ink border border-line2 px-2 py-1.5 font-mono text-[10.5px] text-snow focus:border-cy/60 tabular" />
            </div>
            <Btn tone="cy" onClick={() => {
              addRule({ entity, metric, op, threshold: parseFloat(threshold) || 0, active: true });
            }}><span className="flex items-center gap-1.5"><Plus size={11} /> ARM RULE</span></Btn>
          </div>
        </Panel>

        {/* rules table */}
        <Panel className="flex-1 min-h-0 flex flex-col" pad={false} title="ACTIVE RULE MATRIX">
          <div className="flex-1 overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-panel2 z-10">
                <tr className="font-mono text-[8.5px] text-dim tracking-[0.15em]">
                  <th className="text-left font-normal px-3 py-2">ID</th>
                  <th className="text-left font-normal py-2">ENTITY</th>
                  <th className="text-left font-normal py-2">CONDITION</th>
                  <th className="text-left font-normal py-2">STATUS</th>
                  <th className="text-left font-normal py-2">LAST TRIGGER</th>
                  <th className="text-left font-normal py-2 pr-3">ARMED</th>
                </tr>
              </thead>
              <tbody>
                {sim.rules.map((r) => (
                  <tr key={r.id} className="border-t border-line/50 hover:bg-panel2/40 transition-colors">
                    <td className="px-3 py-2.5 font-mono text-[10px] text-cy">{r.id}</td>
                    <td className="py-2.5"><Tag tone="fog">{r.entity}</Tag></td>
                    <td className="py-2.5 font-mono text-[11px] text-snow tabular">{r.metric} <span className="text-cy">{r.op}</span> {r.threshold}</td>
                    <td className="py-2.5">
                      {r.triggered ? <Tag tone="rd">TRIGGERED</Tag> : <Tag tone="gn">WATCHING</Tag>}
                    </td>
                    <td className="py-2.5 font-mono text-[9.5px] text-dim">{r.last ?? "—"}</td>
                    <td className="py-2.5 pr-3">
                      <button onClick={() => toggleRule(r.id)}
                        className={`relative w-9 h-4 border transition-colors ${r.active ? "border-gn/60 bg-gn/15" : "border-line2 bg-panel"}`}>
                        <span className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 transition-all ${r.active ? "left-[20px] bg-gn" : "left-0.5 bg-dim"}`} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 border-t border-line bg-panel2/50 flex items-center justify-between">
            <span className="font-mono text-[9px] text-dim">Rules evaluate on every fusion cycle · escalation routes: CONSOLE → ALERT → WIRE</span>
            <Btn small tone={exported ? "gn" : "fog"} onClick={() => { setExported(true); log("[WATCH] watchlist exported to evidence vault · SHA-256 sealed"); setTimeout(() => setExported(false), 2000); }}>
              <span className="flex items-center gap-1"><Download size={10} /> {exported ? "SEALED ✓" : "EXPORT"}</span>
            </Btn>
          </div>
        </Panel>
      </section>

      {/* alerts timeline */}
      <aside className="w-[340px] shrink-0 min-h-0">
        <Panel className="h-full flex flex-col" pad={false}
          title={<span className="flex items-center gap-1.5"><BellRing size={11} className="text-am" /> ALERT TIMELINE</span>}
          right={<div className="flex gap-1.5">
            <Tag tone="rd">{sim.alerts.filter((a) => a.sev === "CRIT").length} CRIT</Tag>
            <Tag tone="am">{sim.alerts.filter((a) => a.sev === "WARN").length} WARN</Tag>
          </div>}>
          <div className="flex-1 overflow-y-auto">
            {sim.alerts.map((a) => (
              <div key={a.id} className="flex gap-2.5 px-3 py-2.5 border-b border-line/50 last:border-0 anim-fadeup hover:bg-panel2/40 transition-colors">
                <div className="flex flex-col items-center pt-1">
                  <Dot tone={a.sev === "CRIT" ? "bg-rd" : a.sev === "WARN" ? "bg-am" : "bg-cy"} blink={a.sev === "CRIT"} />
                  <span className="w-px flex-1 bg-line mt-1" />
                </div>
                <div className="min-w-0 pb-1">
                  <div className="flex items-center gap-2">
                    <Tag tone={a.sev === "CRIT" ? "rd" : a.sev === "WARN" ? "am" : "cy"}>{a.sev}</Tag>
                    <span className="font-mono text-[8.5px] text-dim tabular">{agoLabel(a.t, sim.t)}</span>
                  </div>
                  <p className="text-[11px] text-snow/95 leading-snug mt-1">{a.msg}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </aside>
    </div>
  );
}
