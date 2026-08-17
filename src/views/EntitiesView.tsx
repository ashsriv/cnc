import { useState } from "react";
import { Wallet, ShieldAlert, Send, ArrowDownLeft, ArrowUpRight, Search } from "lucide-react";
import { seedWallets, seedSdn, seedTg } from "../data/seed";
import { Panel, Tag, Bar, Spark, Kv, Stat, Btn } from "../components/ui";
import { useStore } from "../state/store";
import { fmtInt, mulberry, hashStr } from "../lib/geo";

type Tab = "wallets" | "ofac" | "tg";

export default function EntitiesView() {
  const { log, raiseAlert, addRule } = useStore();
  const [tab, setTab] = useState<Tab>("wallets");
  const [wSel, setWSel] = useState(seedWallets[0].id);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; score: number }[] | null>(null);
  const [checked, setChecked] = useState(false);

  const wallet = seedWallets.find((w) => w.id === wSel)!;

  const crossCheck = (q: string) => {
    const norm = q.toLowerCase();
    const res = seedSdn
      .map((e) => {
        const names = [e.name, ...e.aliases].map((n) => n.toLowerCase());
        let score = 0;
        names.forEach((n) => {
          const toks = n.split(/[^a-z0-9]+/).filter(Boolean);
          const qtoks = norm.split(/[^a-z0-9]+/).filter(Boolean);
          const inter = toks.filter((t) => qtoks.includes(t)).length;
          score = Math.max(score, toks.length ? Math.round((inter / Math.max(toks.length, 1)) * 62 + (norm.includes(n.slice(0, 8)) ? 36 : 0) + (hashStr(n + norm) % 9)) : 0);
        });
        return { id: e.id, score: Math.min(99, score) };
      })
      .filter((r) => r.score > 34)
      .sort((a, b) => b.score - a.score);
    setResults(res); setChecked(true);
    if (res.some((r) => r.score >= 85)) {
      raiseAlert("CRIT", `OFAC SDN HIT ≥85% — query "${q.slice(0, 32)}" matches ${res[0].id}`);
    }
    log(`[OFAC] SDN cross-check "${q.slice(0, 28)}" → ${res.length} candidates above 34%`);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 m-2 gap-2">
      {/* tabs */}
      <div className="flex gap-1.5 shrink-0">
        {([["wallets", "CRYPTO WALLET INTEL", Wallet], ["ofac", "OFAC / SDN CROSS-CHECK", ShieldAlert], ["tg", "TELEGRAM OSINT LAYER", Send]] as [Tab, string, any][]).map(([k, l, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex items-center gap-2 px-4 py-2 border font-display text-[11px] font-semibold tracking-[0.14em] transition-all ${tab === k ? "border-cy/60 bg-cy/10 text-cy shadow-[0_0_14px_rgba(79,216,235,0.12)]" : "border-line bg-panel text-dim hover:text-fog hover:border-line2"}`}>
            <Icon size={13} /> {l}
          </button>
        ))}
        <span className="flex-1 border-b border-line" />
      </div>

      {/* ---------- WALLETS ---------- */}
      {tab === "wallets" && (
        <div className="flex-1 flex min-h-0 gap-2 anim-fadeup">
          <Panel className="w-[330px] shrink-0 flex flex-col min-h-0" pad={false} title="TRACKED ADDRESSES" right={<Tag tone="am">{seedWallets.length} DOSSIERS</Tag>}>
            <div className="flex-1 overflow-y-auto">
              {seedWallets.map((w) => (
                <button key={w.id} onClick={() => setWSel(w.id)}
                  className={`w-full text-left px-3 py-2.5 border-b border-line/60 transition-colors ${wSel === w.id ? "bg-cy/8 border-l-2 border-l-cy" : "hover:bg-panel2"}`}>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-[9px] px-1 py-px border ${w.chain === "BTC" ? "text-am border-am/40" : "text-vio border-vio/40"}`}>{w.chain}</span>
                    <span className="font-display text-[11.5px] font-semibold text-snow truncate">{w.label}</span>
                  </div>
                  <div className="font-mono text-[9px] text-dim truncate mt-1">{w.address}</div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="font-mono text-[9px] text-fog tabular">${(w.usd / 1e6).toFixed(1)}M</span>
                    <div className="flex items-center gap-1.5 w-24">
                      <Bar v={w.risk} tone={w.risk > 75 ? "bg-rd" : w.risk > 40 ? "bg-am" : "bg-gn"} />
                      <span className={`font-mono text-[9px] tabular ${w.risk > 75 ? "text-rd" : w.risk > 40 ? "text-am" : "text-gn"}`}>{w.risk}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Panel>

          <Panel className="flex-1 min-w-0 flex flex-col min-h-0" pad={false}
            title={`DOSSIER · ${wallet.label}`}
            right={<div className="flex gap-1.5">
              <Btn small tone="rd" onClick={() => { setTab("ofac"); setQuery(wallet.address); crossCheck(wallet.label.split("·")[0].trim()); }}>SDN CHECK</Btn>
              <Btn small tone="cy" onClick={() => { addRule({ entity: "WALLET", metric: "VELOCITY ($/H)", op: "≥", threshold: 250000, active: true }); raiseAlert("INFO", `Watch rule armed on ${wallet.address.slice(0, 18)}…`); }}>+ WATCH</Btn>
            </div>}>
            <div className="p-3.5 grid grid-cols-5 gap-3 border-b border-line">
              <Stat label="BALANCE" value={wallet.balance.toLocaleString()} unit={wallet.chain} />
              <Stat label="USD VALUE" value={`$${(wallet.usd / 1e6).toFixed(2)}M`} />
              <Stat label="RISK SCORE" value={wallet.risk} unit="/100" tone={wallet.risk > 75 ? "text-rd" : wallet.risk > 40 ? "text-am" : "text-gn"} />
              <Stat label="TX COUNT" value={fmtInt(wallet.txCount)} />
              <Stat label="FLOW · 12W" value={<Spark data={wallet.spark} tone={wallet.risk > 75 ? "#ff5d5d" : "#4fd8eb"} w={86} h={24} />} />
            </div>
            <div className="px-3.5 py-2 flex gap-1.5 flex-wrap items-center border-b border-line">
              <span className="font-mono text-[9px] text-dim tracking-widest mr-1">TAGS</span>
              {wallet.tags.map((t) => <Tag key={t} tone={t === "OFAC-HIT" ? "rd" : t.includes("MIXER") || t.includes("DPRK") ? "am" : "fog"}>{t}</Tag>)}
              <span className="flex-1" />
              <span className="font-mono text-[9.5px] text-fog truncate max-w-[46%]">{wallet.address}</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full">
                <thead>
                  <tr className="font-mono text-[8.5px] text-dim tracking-[0.15em]">
                    <th className="text-left font-normal px-3.5 py-1.5">TX</th><th className="text-left font-normal py-1.5">DIR</th>
                    <th className="text-right font-normal py-1.5">AMOUNT</th><th className="text-left font-normal px-3 py-1.5">COUNTERPARTY</th>
                    <th className="text-left font-normal py-1.5">UTC</th><th className="text-left font-normal px-3 py-1.5">FLAG</th>
                  </tr>
                </thead>
                <tbody>
                  {wallet.txs.map((tx) => (
                    <tr key={tx.hash} className="border-t border-line/50 hover:bg-panel2/50 transition-colors">
                      <td className="px-3.5 py-2 font-mono text-[10px] text-cy">{tx.hash}</td>
                      <td className="py-2">
                        <span className={`flex items-center gap-1 font-mono text-[9.5px] ${tx.dir === "IN" ? "text-gn" : "text-am"}`}>
                          {tx.dir === "IN" ? <ArrowDownLeft size={11} /> : <ArrowUpRight size={11} />}{tx.dir}
                        </span>
                      </td>
                      <td className="py-2 text-right font-mono text-[10.5px] text-snow tabular pr-1">{tx.amount.toLocaleString()} {wallet.chain}</td>
                      <td className="px-3 py-2 font-mono text-[9.5px] text-fog truncate max-w-[220px]">{tx.cpty}</td>
                      <td className="py-2 font-mono text-[9.5px] text-dim tabular">{tx.time}</td>
                      <td className="px-3 py-2">{tx.flag ? <Tag tone="rd">{tx.flag}</Tag> : <span className="font-mono text-[9px] text-dim">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {/* ---------- OFAC ---------- */}
      {tab === "ofac" && (
        <div className="flex-1 flex flex-col min-h-0 gap-2 anim-fadeup">
          <Panel title="SANCTIONS SCREENING · OFAC SDN + CONSOLIDATED LISTS" right={<Tag tone="rd">LIST REV 744</Tag>}>
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" />
                <input value={query} onChange={(e) => { setQuery(e.target.value); setChecked(false); }}
                  onKeyDown={(e) => e.key === "Enter" && crossCheck(query)}
                  placeholder="name, alias, vessel, wallet label…" spellCheck={false}
                  className="w-full bg-ink border border-line2 pl-8 pr-3 py-2 font-mono text-[11.5px] text-snow placeholder:text-dim focus:border-rd/60 transition-colors" />
              </div>
              <Btn tone="rd" onClick={() => crossCheck(query)} disabled={!query.trim()}>CROSS-CHECK</Btn>
            </div>
          </Panel>

          <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-2 xl:grid-cols-3 gap-2 content-start">
            {!checked && seedSdn.map((e) => (
              <button key={e.id} onClick={() => { setQuery(e.name); crossCheck(e.name); }}
                className="text-left bg-panel border border-line hover:border-rd/40 hover:bg-panel2 transition-all p-3 group">
                <div className="flex items-center justify-between">
                  <span className="font-display font-semibold text-[12.5px] text-snow group-hover:text-rd transition-colors">{e.name}</span>
                  <Tag tone="rd">{e.program}</Tag>
                </div>
                <div className="font-mono text-[9px] text-dim mt-1.5">ALIASES · {e.aliases.join(" · ")}</div>
                <div className="flex gap-3 mt-1.5 font-mono text-[9px] text-fog">
                  <span>JURISDICTION <span className="text-snow">{e.country}</span></span>
                  <span>{e.doc}</span>
                </div>
              </button>
            ))}
            {checked && (results?.length === 0) && (
              <div className="col-span-full p-10 text-center">
                <div className="font-display text-[15px] font-bold text-gn tracking-widest">NO MATCH — QUERY CLEAN</div>
                <p className="font-mono text-[10px] text-dim mt-2">0 candidates above 34% similarity across 8 SDN records · list rev 744</p>
              </div>
            )}
            {checked && results?.map((r) => {
              const e = seedSdn.find((x) => x.id === r.id)!;
              const hit = r.score >= 85;
              return (
                <div key={r.id} className={`relative bg-panel border p-3 anim-fadeup ${hit ? "border-rd/70 shadow-[0_0_18px_rgba(255,93,93,0.12)]" : "border-line"}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-display font-semibold text-[12.5px] text-snow">{e.name}</span>
                    <Tag tone={hit ? "rd" : "am"}>{hit ? "HIT" : "PARTIAL"} {r.score}%</Tag>
                  </div>
                  <div className="mt-2"><Bar v={r.score} tone={hit ? "bg-rd" : "bg-am"} /></div>
                  <div className="grid grid-cols-2 gap-x-3 mt-2">
                    <Kv k="PROGRAM" v={e.program} /><Kv k="COUNTRY" v={e.country} />
                    <Kv k="DOC" v={e.doc} /><Kv k="ALIASES" v={`${e.aliases.length} on file`} />
                  </div>
                  {hit && <div className="mt-2 font-mono text-[9px] text-rd anim-blink">▲ AUTO-ESCALATED TO WATCHLIST · CRIT ALERT RAISED</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------- TELEGRAM ---------- */}
      {tab === "tg" && (
        <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-1 xl:grid-cols-2 gap-2 content-start anim-fadeup">
          {seedTg.map((ch) => (
            <Panel key={ch.id} pad={false}
              title={<span className="font-mono text-[11px] text-cy tracking-normal">@{ch.handle}</span>}
              right={<div className="flex items-center gap-1.5">
                <Tag tone="fog">{ch.lang}</Tag>
                {ch.spike && <Tag tone="rd"><span className="anim-blink">▲</span>&nbsp;VOLUME SPIKE</Tag>}
              </div>}>
              <div className="flex items-center gap-4 px-3.5 py-2.5 border-b border-line">
                <Stat label="SUBSCRIBERS" value={fmtInt(ch.subs)} />
                <Stat label="Δ 7D" value={`+${fmtInt(ch.growth[ch.growth.length - 1] * 1000)}`} tone="text-gn" />
                <Stat label="POSTS/H" value={Math.round(ch.growth[ch.growth.length - 1] / 8)} />
                <div className="ml-auto"><Spark data={ch.growth} tone={ch.spike ? "#ff5d5d" : "#4fd8eb"} w={120} h={30} /></div>
              </div>
              <div>
                {ch.posts.map((p, i) => (
                  <div key={i} className="px-3.5 py-2.5 border-b border-line/50 last:border-0 hover:bg-panel2/40 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] text-dim tabular">{p.time}</span>
                      <Tag tone={p.sent <= -2 ? "rd" : p.sent === -1 ? "am" : "fog"}>{p.sent <= -2 ? "HOSTILE" : p.sent === -1 ? "NEG" : "NEU"}</Tag>
                      <span className="font-mono text-[8.5px] text-dim ml-auto tabular">REACH {fmtInt(p.reach)}</span>
                    </div>
                    <p className="text-[11px] text-snow/90 mt-1 leading-relaxed">{p.text}</p>
                    <div className="flex gap-1 mt-1.5">{p.kw.map((k) => <Tag key={k} tone="cy">{k}</Tag>)}</div>
                  </div>
                ))}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
