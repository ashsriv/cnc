import { useState } from "react";
import { KeyRound, Radio, X, Eye, EyeOff, MapPin } from "lucide-react";
import { useStore, AIS_REGIONS } from "../state/store";
import { SOURCE_META } from "../lib/live";
import { Corners, Tag, Dot } from "./ui";

const ST_TONE: Record<string, { tone: "gn" | "cy" | "am" | "rd" | "fog"; blink?: boolean }> = {
  LIVE: { tone: "gn", blink: true }, CONNECTING: { tone: "am", blink: true },
  SIM: { tone: "fog" }, ERROR: { tone: "rd" }, STANDBY: { tone: "fog" },
};

export default function SettingsModal() {
  const { settingsOpen, setSettingsOpen, aisKey, saveAisKey, aisRegions, toggleAisRegion, sources } = useStore();
  const [draft, setDraft] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);
  if (!settingsOpen) return null;

  const value = draft ?? aisKey;
  const st = sources.AISSTREAM;
  const meta = ST_TONE[st] ?? ST_TONE.STANDBY;

  const save = () => { saveAisKey(value); setDraft(null); };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center" onClick={() => setSettingsOpen(false)}>
      <div className="absolute inset-0 bg-ink/85" />
      <div className="relative w-[600px] max-h-[86vh] overflow-y-auto bg-panel border border-line2 anim-fadeup" onClick={(e) => e.stopPropagation()}>
        <Corners color="border-cy/60" />
        <div className="flex items-center justify-between px-4 h-11 border-b border-line bg-panel2/60 sticky top-0 z-10">
          <div className="font-display text-[12px] font-bold tracking-[0.22em] text-snow">
            UPLINK <span className="text-cy">CONFIGURATION</span>
          </div>
          <button onClick={() => setSettingsOpen(false)} className="text-dim hover:text-rd transition-colors"><X size={15} /></button>
        </div>

        {/* AIS key */}
        <div className="p-4 border-b border-line">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Radio size={13} className="text-tl" />
              <span className="font-display text-[11px] font-semibold tracking-[0.18em] text-snow">AISSTREAM · MARITIME POSITION REPORTS</span>
            </div>
            <Tag tone={meta.tone}><span className={meta.blink ? "anim-blink" : ""}>●</span>&nbsp;{st}</Tag>
          </div>
          <div className="flex gap-1.5">
            <div className="flex-1 relative">
              <KeyRound size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" />
              <input
                type={reveal ? "text" : "password"}
                value={value}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="paste your AISStream API key"
                spellCheck={false}
                className="w-full bg-ink border border-line2 pl-8 pr-9 py-2 font-mono text-[11px] text-snow placeholder:text-dim focus:border-tl/60 transition-colors"
              />
              <button onClick={() => setReveal(!reveal)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dim hover:text-fog">
                {reveal ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
            <button onClick={save}
              className="px-4 border border-tl/60 text-tl font-display text-[10px] font-bold tracking-[0.16em] hover:bg-tl/15 hover:shadow-[0_0_14px_rgba(69,208,184,0.3)] transition-all">
              {aisKey ? "RECONNECT" : "ARM UPLINK"}
            </button>
            {aisKey && (
              <button onClick={() => { saveAisKey(""); setDraft(null); }}
                className="px-3 border border-line2 text-dim font-display text-[10px] font-bold tracking-[0.16em] hover:text-rd hover:border-rd/50 transition-colors">
                CLEAR
              </button>
            )}
          </div>

          <div className="mt-3">
            <div className="flex items-center gap-1.5 mb-1.5 font-mono text-[8.5px] tracking-[0.2em] text-dim">
              <MapPin size={10} /> STREAM REGIONS (BBOX)
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(AIS_REGIONS).map(([k, r]) => {
                const on = aisRegions.includes(k);
                return (
                  <button key={k} onClick={() => toggleAisRegion(k)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 border font-mono text-[10px] tracking-wider transition-all ${on ? "border-tl/50 text-tl bg-tl/8" : "border-line text-dim hover:text-fog hover:border-line2"}`}>
                    <span className={`w-2 h-2 border ${on ? "border-tl bg-tl" : "border-line2"}`} />
                    {r.label}
                    <span className="ml-auto text-[8px] text-dim">{r.box}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="mt-3 font-mono text-[8.5px] text-dim leading-relaxed">
            Key is stored <span className="text-fog">only in this browser's localStorage</span> and sent exclusively to{" "}
            <span className="text-tl">wss://stream.aisstream.io</span>. Class A + B position reports stream in real time;
            tracks render on the AIS layer with live telemetry. Without a key the layer runs on synthetic traffic.
          </p>
        </div>

        {/* keyless feeds */}
        <div className="p-4">
          <div className="font-display text-[11px] font-semibold tracking-[0.18em] text-snow mb-2.5">KEYLESS FEEDS · AUTO-ARMED</div>
          <div className="grid grid-cols-2 gap-x-4">
            {SOURCE_META.filter((s) => s.k !== "AISSTREAM").map((s) => {
              const state = sources[s.k] ?? "STANDBY";
              const m = ST_TONE[state] ?? ST_TONE.STANDBY;
              return (
                <div key={s.k} className="flex items-center gap-2 py-1.5 border-b border-line/40">
                  <Dot tone={state === "LIVE" ? "bg-gn" : state === "CONNECTING" ? "bg-am" : state === "ERROR" ? "bg-rd" : "bg-dim"} blink={state === "LIVE" || state === "CONNECTING"} />
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] text-snow">{s.label} <span className="text-dim">· {state}</span></div>
                    <div className="font-mono text-[8px] text-dim truncate">{s.feed}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 font-mono text-[8.5px] text-dim">
            Any feed that fails to respond within its timeout automatically degrades to the synthetic engine — the console never goes dark.
          </p>
        </div>
      </div>
    </div>
  );
}
