import { useState } from "react";
import { BrainCircuit, MapPin, TrendingUp, Archive } from "lucide-react";
import { useStore } from "../state/store";
import { Panel, Tag, Area, Btn } from "../components/ui";
import { agoLabel } from "../lib/geo";

const REGIONS = ["ALL", "EUROPE", "MENA", "ASIA-PAC", "AMERICAS", "AFRICA", "CYBER", "MARITIME", "GLOBAL"];

function Sentiment({ v }: { v: number }) {
  if (v <= -2) return <Tag tone="rd">HOSTILE −−</Tag>;
  if (v === -1) return <Tag tone="am">NEGATIVE −</Tag>;
  if (v === 0) return <Tag tone="fog">NEUTRAL</Tag>;
  return <Tag tone="gn">POSITIVE +</Tag>;
}

export default function FeedView() {
  const { sim, setView, setFocus, log } = useStore();
  const [region, setRegion] = useState("ALL");
  const [prioOnly, setPrioOnly] = useState(false);

  const items = sim.news.filter((n) => (region === "ALL" || n.region === region) && (!prioOnly || n.priority !== "ROUTINE"));
  const liveCount = sim.news.filter((n) => n.live).length;
  const tension = sim.tension;
  const crit = sim.conflicts.filter((c) => c.intensity > 80);
  const dark = sim.ships.filter((s) => s.name.includes("DARK"));
  const spikes = sim.alerts.filter((a) => a.sev === "CRIT").slice(0, 3);

  return (
    <div className="flex-1 flex min-h-0 gap-2 m-2">
      {/* left rail: AI digest */}
      <aside className="w-[330px] shrink-0 flex flex-col gap-2 min-h-0 overflow-y-auto">
        <Panel title={<span className="flex items-center gap-1.5"><BrainCircuit size={11} className="text-vio" /> AI SITUATION DIGEST</span>} right={<Tag tone="vio">LLM-FUSED</Tag>}>
          <p className="text-[11px] leading-relaxed text-fog">
            Automated synthesis of <span className="text-snow font-medium">{sim.news.length}</span> items across{" "}
            <span className="text-snow font-medium">37</span> sources. Dominant signal:{" "}
            <span className="text-rd font-medium">Red Sea maritime interdiction cycle</span> continues with drone swarms;
            correlated with AIS-dark tanker activity {dark.length > 0 ? `(${dark[0].name.split("·")[0].trim()})` : ""} and
            Telegram volume spikes in RU-language channels.
          </p>
          <ul className="mt-2.5 space-y-1.5">
            {[
              ["rd", `Kinetic pressure ${crit.length > 0 ? crit[0].name : "—"} intensity ${crit[0]?.intensity ?? "—"}%`],
              ["am", `Seismic swarm: ${sim.quakes.length} events tracked, max M${Math.max(...sim.quakes.map((q) => q.mag), 0).toFixed(1)}`],
              ["vio", `Satellite tasking surge — watch Plesetsk-Kura corridor`],
              ["cy", `3 UAS assets responsive · geofence ${sim.geofenceR} km armed`],
            ].map(([tone, txt], i) => (
              <li key={i} className="flex gap-2 text-[10.5px] text-fog">
                <span className="mt-1 w-1.5 h-1.5 shrink-0" style={{ background: { rd: "#ff5d5d", am: "#ffb454", vio: "#9d8cff", cy: "#4fd8eb" }[tone] }} />
                {txt}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="GLOBAL TENSION INDEX" right={<Tag tone={tension[tension.length - 1] > 70 ? "rd" : "am"}>{tension[tension.length - 1].toFixed(0)}/100</Tag>} pad={false}>
          <div className="p-3">
            <Area data={tension} tone={tension[tension.length - 1] > 70 ? "#ff5d5d" : "#ffb454"} h={52} />
            <div className="flex justify-between font-mono text-[8.5px] text-dim mt-1 tabular">
              <span>−90 MIN</span><span>COMPOSITE · CONFLICT+SEISMIC+CVD</span><span>NOW</span>
            </div>
          </div>
        </Panel>

        <Panel title="CRITICAL FLASHES" pad={false}>
          {spikes.length === 0 && <p className="px-3 py-3 font-mono text-[10px] text-dim">No critical flashes in window.</p>}
          {spikes.map((a) => (
            <div key={a.id} className="px-3 py-2 border-b border-line/50 last:border-0">
              <div className="text-[10.5px] text-snow leading-snug">{a.msg}</div>
              <div className="font-mono text-[8.5px] text-rd tabular mt-0.5">{agoLabel(a.t, sim.t)}</div>
            </div>
          ))}
        </Panel>
      </aside>

      {/* main feed */}
      <section className="flex-1 min-w-0 flex flex-col min-h-0">
        <Panel className="flex-1 flex flex-col min-h-0" pad={false}
          title={<span>INTELLIGENCE FEED · {liveCount > 0 ? <span className="text-gn">{liveCount} LIVE</span> : "AI-AGGREGATED"}</span>}
          right={
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPrioOnly(!prioOnly)}
                className={`px-2 py-0.5 border font-mono text-[9px] tracking-wider transition-colors ${prioOnly ? "border-am/60 text-am bg-am/10" : "border-line2 text-dim hover:text-fog"}`}>
                ≥ PRIORITY
              </button>
              <select value={region} onChange={(e) => setRegion(e.target.value)}
                className="bg-panel2 border border-line2 font-mono text-[9px] text-fog px-1.5 py-0.5 tracking-wider">
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          }>
          <div className="flex-1 overflow-y-auto">
            {items.map((n, i) => (
              <article key={n.id} className="group px-4 py-3 border-b border-line/60 hover:bg-panel2/60 transition-colors anim-fadeup" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[9px] text-dim tabular">{agoLabel(n.t, sim.t)}</span>
                  <Tag tone="fog">{n.source}</Tag>
                  {n.live && <Tag tone="gn"><span className="anim-pulse-soft">●</span>&nbsp;LIVE</Tag>}
                  <Tag tone={n.region === "CYBER" ? "vio" : n.region === "MARITIME" ? "tl" : "cy"}>{n.region}</Tag>
                  {n.priority === "FLASH" && <Tag tone="rd"><span className="anim-blink">◆</span>&nbsp;FLASH</Tag>}
                  {n.priority === "PRIORITY" && <Tag tone="am">PRIORITY</Tag>}
                  <Sentiment v={n.sentiment} />
                  <span className="flex-1" />
                  {n.coords && (
                    <button onClick={() => { setFocus({ lat: n.coords![1], lon: n.coords![0], k: 3.6 }); setView("ops"); log(`[OPS] geolocate pivot → ${n.title.slice(0, 40)}…`); }}
                      className="flex items-center gap-1 font-mono text-[9px] text-dim hover:text-cy transition-colors">
                      <MapPin size={10} /> GEOLOCATE
                    </button>
                  )}
                  <button onClick={() => log(`[ARCHIVE] item ${n.id} sealed to evidence vault`)}
                    className="font-mono text-[9px] text-dim hover:text-cy transition-colors flex items-center gap-1">
                    <Archive size={10} /> ARCHIVE
                  </button>
                </div>
                <h3 className={`font-display font-semibold leading-snug mt-1.5 group-hover:text-cy transition-colors ${n.priority === "FLASH" ? "text-[15px] text-snow" : "text-[13.5px] text-snow/95"}`}>
                  {n.priority === "FLASH" && <span className="text-rd mr-1.5">▪</span>}{n.title}
                </h3>
                <p className="text-[11.5px] text-fog leading-relaxed mt-1 max-w-[760px]">{n.body}</p>
              </article>
            ))}
            {items.length === 0 && (
              <div className="p-8 text-center font-mono text-[10px] text-dim">NO ITEMS MATCH FILTER — broaden region or priority.</div>
            )}
          </div>
          <div className="px-4 py-2 border-t border-line flex items-center justify-between bg-panel2/50">
            <span className="font-mono text-[9px] text-dim tabular">{items.length} ITEMS · WINDOW 6H · DEDUP ON · NLP ENTITY LINKING ON</span>
            <Btn small tone="fog" onClick={() => log("[FEED] manual refresh forced · 0 new unique items")}>REFRESH</Btn>
          </div>
        </Panel>
      </section>
    </div>
  );
}
