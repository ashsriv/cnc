import { useEffect, useRef, useState } from "react";
import { Globe, FileSearch, ServerCog, ShieldCheck, Play } from "lucide-react";
import { Panel, Tag, Btn } from "../components/ui";
import { genRecon } from "../lib/sim";
import { useStore } from "../state/store";

type Tool = "dns" | "whois" | "ip" | "ssl";

const TOOLS: { k: Tool; name: string; icon: any; desc: string; ph: string; def: string; tone: string }[] = [
  { k: "dns", name: "DNS LOOKUP", icon: Globe, desc: "A/AAAA/NS/MX/TXT · passive-DNS rotation heuristics", ph: "target.example", def: "vostok-digital.ru", tone: "#4fd8eb" },
  { k: "whois", name: "WHOIS RECORD", icon: FileSearch, desc: "Registrar lineage · creation cadence · privacy posture", ph: "domain.tld", def: "nordstream-logistics.lv", tone: "#ffb454" },
  { k: "ip", name: "IP INTEL", icon: ServerCog, desc: "ASN · geo · open ports · TOR/proxy reputation", ph: "1.2.3.4 or host", def: "91.242.217.40", tone: "#45d0b8" },
  { k: "ssl", name: "SSL CERT SCAN", icon: ShieldCheck, desc: "Issuer chain · SAN mesh · CT log cadence", ph: "host:port", def: "api.vostok-digital.ru:443", tone: "#9d8cff" },
];

interface Session { tool: Tool; input: string; lines: string[]; done: boolean; t: string; hits: number; }

export default function ReconView() {
  const { log } = useStore();
  const [sessions, setSessions] = useState<Record<Tool, Session | null>>({ dns: null, whois: null, ip: null, ssl: null });
  const [inputs, setInputs] = useState<Record<Tool, string>>({ dns: "vostok-digital.ru", whois: "nordstream-logistics.lv", ip: "91.242.217.40", ssl: "api.vostok-digital.ru:443" });
  const [history, setHistory] = useState<{ tool: Tool; input: string; t: string; hits: number }[]>([
    { tool: "ip", input: "45.155.205.86", t: "03:41:12Z", hits: 2 },
    { tool: "whois", input: "albaraka-exch.com", t: "03:38:55Z", hits: 1 },
  ]);
  const timers = useRef<number[]>([]);
  useEffect(() => () => { timers.current.forEach(clearInterval); }, []);

  const run = (tool: Tool) => {
    const input = inputs[tool].trim();
    if (!input) return;
    const full = genRecon(tool, input);
    const t = new Date().toISOString().slice(11, 19) + "Z";
    setSessions((s) => ({ ...s, [tool]: { tool, input, lines: [], done: false, t, hits: 0 } }));
    let i = 0;
    const id = window.setInterval(() => {
      i++;
      setSessions((s) => {
        const cur = s[tool]; if (!cur) return s;
        const lines = full.slice(0, i);
        const hits = lines.filter((l) => l.startsWith("[!]")).length;
        return { ...s, [tool]: { ...cur, lines, hits, done: i >= full.length } };
      });
      if (i >= full.length) {
        clearInterval(id);
        const hits = full.filter((l) => l.startsWith("[!]")).length;
        setHistory((h) => [{ tool, input, t, hits }, ...h].slice(0, 14));
        log(`[RECON] ${tool.toUpperCase()} ${input} complete · ${hits} flags raised`);
      }
    }, 90);
    timers.current.push(id);
  };

  return (
    <div className="flex-1 flex min-h-0 gap-2 m-2">
      <section className="flex-1 min-w-0 grid grid-cols-2 gap-2 content-start overflow-y-auto pr-0.5">
        {TOOLS.map(({ k, name, icon: Icon, desc, ph, tone }) => {
          const s = sessions[k];
          const running = s !== null && !s.done;
          return (
            <Panel key={k} className="min-w-[340px]"
              title={<span className="flex items-center gap-1.5"><Icon size={11} style={{ color: tone }} /> {name}</span>}
              right={running ? <Tag tone="am">RUNNING</Tag> : s?.done ? (s.hits > 0 ? <Tag tone="rd">{s.hits} FLAGS</Tag> : <Tag tone="gn">CLEAN</Tag>) : <Tag tone="fog">IDLE</Tag>}>
              <p className="text-[10px] text-dim mb-2">{desc}</p>
              <div className="flex gap-1.5">
                <input
                  value={inputs[k]}
                  onChange={(e) => setInputs((v) => ({ ...v, [k]: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && run(k)}
                  placeholder={ph}
                  spellCheck={false}
                  className="flex-1 bg-ink border border-line2 px-2.5 py-1.5 font-mono text-[11px] text-snow placeholder:text-dim focus:border-cy/60 transition-colors"
                />
                <button onClick={() => run(k)} disabled={running}
                  className={`px-3 border font-display text-[10px] font-bold tracking-[0.15em] flex items-center gap-1.5 transition-all ${running ? "border-line2 text-dim" : "text-ink bg-cy border-cy hover:shadow-[0_0_16px_rgba(79,216,235,0.4)]"}`}>
                  <Play size={10} /> EXEC
                </button>
              </div>
              <div className="mt-2 h-[168px] bg-ink border border-line overflow-y-auto relative">
                {s === null ? (
                  <div className="absolute inset-0 flex items-center justify-center font-mono text-[9.5px] text-dim tracking-[0.2em]">
                    STANDBY — AWAITING QUERY ▮
                  </div>
                ) : (
                  <pre className="p-2.5 font-mono text-[10px] leading-[1.55] whitespace-pre-wrap text-fog tabular">
                    {s.lines.map((l, i) => (
                      <span key={i} className={`block ${l.startsWith("[!]") ? "text-am" : l.startsWith("[ok]") ? "text-gn" : l.startsWith("$") ? "text-cy" : l.startsWith("▸") ? "text-vio" : ""}`}>{l}</span>
                    ))}
                    {!s.done && <span className="text-cy anim-blink">▮</span>}
                  </pre>
                )}
              </div>
            </Panel>
          );
        })}
      </section>

      <aside className="w-[280px] shrink-0 flex flex-col gap-2 min-h-0">
        <Panel title="OPERATOR NOTES" pad={false}>
          <div className="p-3 text-[10.5px] text-fog leading-relaxed">
            All reconnaissance executes through the <span className="text-cy font-mono text-[10px]">FRA-02</span> anonymizing relay.
            Queries never originate from the console IP. Hits are auto-pivoted into the{" "}
            <span className="text-snow">entity correlation graph</span>.
          </div>
          <div className="border-t border-line px-3 py-2 flex justify-between font-mono text-[9px] text-dim">
            <span>RELAY HEALTH <span className="text-gn">OK</span></span>
            <span>DNSSEC <span className="text-gn">VERIFIED</span></span>
          </div>
        </Panel>

        <Panel title="SESSION HISTORY" right={<Btn small tone="fog" onClick={() => setHistory([])}>PURGE</Btn>} pad={false} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {history.length === 0 && <p className="px-3 py-4 font-mono text-[9.5px] text-dim">NO SESSIONS LOGGED.</p>}
            {history.map((h, i) => (
              <div key={i} className="px-3 py-2 border-b border-line/50 last:border-0 flex items-center gap-2 anim-fadeup">
                <span className="w-1 h-6" style={{ background: TOOLS.find((t) => t.k === h.tool)?.tone }} />
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[10px] text-snow truncate">{h.input}</div>
                  <div className="font-mono text-[8.5px] text-dim tabular">{h.tool.toUpperCase()} · {h.t}</div>
                </div>
                {h.hits > 0 ? <Tag tone="rd">{h.hits}!</Tag> : <Tag tone="gn">0</Tag>}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="QUICK PIVOTS" pad={false}>
          <div className="grid grid-cols-2 gap-1.5 p-2.5">
            {["REVERSE-IP", "crt.sh MIRROR", "URLHAUS", "VIRUSTOTAL", "SHODAN-ISH", "GREYNOISE"].map((q) => (
              <button key={q} onClick={() => log(`[RECON] pivot queued → ${q} (external dataset)`)}
                className="border border-line2 py-1.5 font-mono text-[9px] text-fog hover:text-cy hover:border-cy/50 transition-colors tracking-wider">
                {q}
              </button>
            ))}
          </div>
        </Panel>
      </aside>
    </div>
  );
}
