import { Plus, Trash2, BatteryCharging, Radio } from "lucide-react";
import WorldMap from "../components/WorldMap";
import { useStore } from "../state/store";
import { Panel, Tag, Bar, Btn, Stat } from "../components/ui";
import { distKm, fmtCoord, fmtInt, clamp } from "../lib/geo";

const ACTIONS = ["TAKEOFF", "TRANSIT", "SURVEY", "ORBIT", "PHOTO", "RELAY", "LAND"];
const MODE_TONE: Record<string, "gn" | "cy" | "am" | "vio" | "fog"> = {
  STANDBY: "fog", ARMED: "am", AUTO: "cy", LOITER: "vio", RTL: "rd" as any,
};

function Attitude({ bank, pitch }: { bank: number; pitch: number }) {
  const off = clamp(pitch * 2.2, -26, 26);
  return (
    <div className="relative w-[92px] h-[92px] rounded-full border border-line2 overflow-hidden bg-ink mx-auto">
      <div className="absolute inset-0 rounded-full overflow-hidden" style={{ transform: `rotate(${-bank}deg)` }}>
        <div className="absolute left-[-20%] right-[-20%] transition-transform duration-500" style={{ top: 0, height: 200, transform: `translateY(${off - 46}px)` }}>
          <div className="h-1/2 bg-[#1d3a5f]" />
          <div className="h-[2px] bg-snow/80" />
          <div className="h-1/2 bg-[#3d2c1a]" />
          {[-30, -15, 15, 30].map((p) => (
            <div key={p} className="absolute left-1/2 -translate-x-1/2 w-8 h-px bg-snow/30" style={{ top: `${50 - p * 1.1}%` }} />
          ))}
        </div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-12 h-px bg-am" />
        <div className="absolute w-1.5 h-1.5 rounded-full border border-am" />
      </div>
      <div className="absolute bottom-1 inset-x-0 text-center font-mono text-[7.5px] text-fog tabular">
        BNK {bank.toFixed(0)}° · PCH {pitch.toFixed(1)}°
      </div>
    </div>
  );
}

export default function MissionView() {
  const { sim, uavSel, setUavSel, uavCmd, updateWp, addWp, removeWp, updateRally, geofenceR, setGeofenceR, select, log } = useStore();
  const uav = sim.uavs.find((u) => u.id === uavSel) ?? sim.uavs[0];

  const totalKm = uav.wps.slice(1).reduce((acc, w, i) => acc + distKm([uav.wps[i].lat, uav.wps[i].lon], [w.lat, w.lon]), 0);
  const avgSpd = uav.wps.reduce((a, w) => a + w.spd, 0) / uav.wps.length;
  const etaMin = totalKm / (avgSpd * 1.852) * 60;

  const canLaunch = uav.mode === "ARMED" || uav.mode === "STANDBY";
  const airborne = uav.mode !== "STANDBY";

  return (
    <div className="flex-1 flex min-h-0 gap-2 m-2">
      {/* ---- UAS ROSTER ---- */}
      <aside className="w-[262px] shrink-0 flex flex-col gap-2 min-h-0">
        <Panel title="AIR ASSET ROSTER" right={<Tag tone="gn">{sim.uavs.filter((u) => u.mode !== "STANDBY").length} AIRBORNE</Tag>} pad={false}>
          {sim.uavs.map((u) => (
            <button key={u.id} onClick={() => { setUavSel(u.id); select({ kind: "uav", id: u.id }); }}
              className={`w-full text-left px-3 py-2.5 border-b border-line/60 last:border-0 transition-colors ${uavSel === u.id ? "bg-gn/8 border-l-2 border-l-gn" : "hover:bg-panel2"}`}>
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-[13px] tracking-wider text-snow">{u.cs}</span>
                <Tag tone={MODE_TONE[u.mode]}>{u.mode}</Tag>
              </div>
              <div className="font-mono text-[8.5px] text-dim mt-0.5">{u.frame}</div>
              <div className="flex items-center gap-2 mt-1.5">
                <BatteryCharging size={12} className={u.batt < 25 ? "text-rd" : u.batt < 50 ? "text-am" : "text-gn"} />
                <Bar v={u.batt} tone={u.batt < 25 ? "bg-rd" : u.batt < 50 ? "bg-am" : "bg-gn"} w="flex-1" />
                <span className={`font-mono text-[9.5px] tabular ${u.batt < 25 ? "text-rd" : "text-fog"}`}>{u.batt.toFixed(0)}%</span>
              </div>
              <div className="flex justify-between mt-1 font-mono text-[8.5px] text-dim tabular">
                <span>ALT {fmtInt(u.alt)}ft</span><span>GS {Math.round(u.gs)}kt</span>
                <span className="flex items-center gap-1"><Radio size={8} className="text-gn" />{u.link.toFixed(0)}%</span>
              </div>
            </button>
          ))}
        </Panel>

        {/* telemetry */}
        <Panel title={`TELEMETRY · ${uav.cs}`} pad={false}>
          <div className="p-3">
            <Attitude bank={uav.bank} pitch={uav.pitch} />
            <div className="grid grid-cols-3 gap-2 mt-3">
              <Stat label="ALT MSL" value={fmtInt(uav.alt)} unit="ft" />
              <Stat label="GND SPD" value={Math.round(uav.gs)} unit="kt" />
              <Stat label="V/S" value={`${uav.vs >= 0 ? "+" : ""}${uav.vs.toFixed(1)}`} unit="m/s" />
              <Stat label="HDG" value={`${Math.round(uav.hdg).toString().padStart(3, "0")}°`} />
              <Stat label="LINK" value={uav.link.toFixed(0)} unit="%" tone={uav.link > 85 ? "text-gn" : "text-am"} />
              <Stat label="WP SEQ" value={`${Math.min(uav.wpIndex + 1, uav.wps.length)}/${uav.wps.length}`} />
            </div>
            <div className="mt-2.5 flex items-center justify-between font-mono text-[9px] text-dim">
              <span>POS {fmtCoord(uav.lat, uav.lon)}</span>
              <span className={uav.breach ? "text-rd anim-blink" : "text-gn"}>{uav.breach ? "GEOFENCE!" : "IN FENCE"}</span>
            </div>
          </div>
        </Panel>

        {/* commands */}
        <Panel title="FLIGHT COMMAND" pad={false}>
          <div className="p-3 grid grid-cols-2 gap-1.5">
            <Btn tone="am" disabled={uav.mode !== "STANDBY"} onClick={() => uavCmd(uav.id, "ARMED")}>ARM</Btn>
            <Btn tone="gn" disabled={!canLaunch} onClick={() => uavCmd(uav.id, "LAUNCH")}>LAUNCH</Btn>
            <Btn tone="cy" disabled={!airborne} onClick={() => uavCmd(uav.id, "LOITER")}>LOITER</Btn>
            <Btn tone="rd" disabled={!airborne} onClick={() => uavCmd(uav.id, "RTL")}>RTL</Btn>
            <div className="col-span-2">
              <Btn tone="fog" disabled={uav.mode === "STANDBY"} onClick={() => uavCmd(uav.id, "DISARM")}>DISARM / RESET</Btn>
            </div>
          </div>
          <div className="px-3 pb-3 -mt-1 font-mono text-[8.5px] text-dim leading-relaxed">
            MAVLink-style state machine. RTL diverts to rally {uav.rally[0]?.id}. Geofence failover engages automatically.
          </div>
        </Panel>
      </aside>

      {/* ---- CENTER: MAP + PLANNER ---- */}
      <section className="flex-1 min-w-0 flex flex-col gap-2 min-h-0">
        <div className="relative flex-[1.15] min-h-0">
          <WorldMap mission={{ uav, geofenceR }} />
          <div className="absolute top-3 left-3 bg-ink/85 border border-line px-2.5 py-1.5">
            <div className="font-display text-[11px] font-bold tracking-[0.18em] text-gn">PLAN VIEW · {uav.cs}</div>
            <div className="font-mono text-[8.5px] text-dim mt-0.5 tabular">
              MISSION {totalKm.toFixed(0)} KM · ETA {etaMin.toFixed(0)} MIN · CRUISE {Math.round(avgSpd)} KT
            </div>
          </div>
          {uav.mode !== "STANDBY" && (
            <div className="absolute bottom-2.5 left-3 flex items-center gap-2 bg-ink/85 border border-line px-2.5 py-1">
              <span className={`w-1.5 h-1.5 rounded-full ${uav.mode === "AUTO" ? "bg-cy" : uav.mode === "RTL" ? "bg-rd" : "bg-vio"} anim-pulse-soft`} />
              <span className="font-mono text-[9px] text-fog tabular">MODE {uav.mode} · WP {Math.min(uav.wpIndex + 1, uav.wps.length)}/{uav.wps.length} · BATT {uav.batt.toFixed(0)}%</span>
            </div>
          )}
        </div>

        <Panel className="flex-[0.9] min-h-0 flex flex-col" pad={false}
          title="MISSION WAYPOINT EDITOR"
          right={<div className="flex items-center gap-2">
            <span className="font-mono text-[9px] text-dim tabular">{uav.wps.length} WPS · {totalKm.toFixed(0)} KM</span>
            <Btn small tone="cy" onClick={() => addWp(uav.id)}><span className="flex items-center gap-1"><Plus size={10} />ADD WP</span></Btn>
          </div>}>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-panel2">
                <tr className="font-mono text-[8.5px] text-dim tracking-[0.15em]">
                  <th className="text-left font-normal px-3 py-1.5">#</th>
                  <th className="text-left font-normal py-1.5">LATITUDE</th>
                  <th className="text-left font-normal py-1.5">LONGITUDE</th>
                  <th className="text-left font-normal py-1.5">ALT (FT)</th>
                  <th className="text-left font-normal py-1.5">SPD (KT)</th>
                  <th className="text-left font-normal px-2 py-1.5">ACTION</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {uav.wps.map((w, i) => {
                  const active = i === uav.wpIndex && uav.mode === "AUTO";
                  const done = i < uav.wpIndex;
                  return (
                    <tr key={i} className={`border-t border-line/50 transition-colors ${active ? "bg-cy/8" : done ? "opacity-40" : "hover:bg-panel2/40"}`}>
                      <td className="px-3 py-1">
                        <span className={`inline-flex items-center justify-center w-5 h-5 border font-mono text-[9.5px] ${active ? "border-cy text-cy" : done ? "border-dim text-dim" : "border-line2 text-fog"}`}>{i + 1}</span>
                      </td>
                      <td className="py-1 pr-2">
                        <input type="number" step="0.05" value={w.lat}
                          onChange={(e) => updateWp(uav.id, i, { lat: +e.target.value })}
                          className="w-[92px] bg-ink border border-line px-1.5 py-1 font-mono text-[10px] text-snow focus:border-cy/60 tabular" />
                      </td>
                      <td className="py-1 pr-2">
                        <input type="number" step="0.05" value={w.lon}
                          onChange={(e) => updateWp(uav.id, i, { lon: +e.target.value })}
                          className="w-[92px] bg-ink border border-line px-1.5 py-1 font-mono text-[10px] text-snow focus:border-cy/60 tabular" />
                      </td>
                      <td className="py-1 pr-2">
                        <input type="number" step="500" value={w.alt}
                          onChange={(e) => updateWp(uav.id, i, { alt: +e.target.value })}
                          className="w-[76px] bg-ink border border-line px-1.5 py-1 font-mono text-[10px] text-snow focus:border-cy/60 tabular" />
                      </td>
                      <td className="py-1 pr-2">
                        <input type="number" step="5" value={w.spd}
                          onChange={(e) => updateWp(uav.id, i, { spd: +e.target.value })}
                          className="w-[62px] bg-ink border border-line px-1.5 py-1 font-mono text-[10px] text-snow focus:border-cy/60 tabular" />
                      </td>
                      <td className="py-1 px-2">
                        <select value={w.action} onChange={(e) => { updateWp(uav.id, i, { action: e.target.value }); log(`[PLAN] ${uav.cs} WP${i + 1} action → ${e.target.value}`); }}
                          className="bg-ink border border-line px-1.5 py-1 font-mono text-[9.5px] text-fog">
                          {ACTIONS.map((a) => <option key={a}>{a}</option>)}
                        </select>
                      </td>
                      <td className="py-1 pr-2">
                        <button onClick={() => removeWp(uav.id, i)} disabled={uav.wps.length <= 2}
                          className="text-dim hover:text-rd transition-colors disabled:opacity-25"><Trash2 size={12} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>

      {/* ---- RIGHT: FENCE + RALLY ---- */}
      <aside className="w-[252px] shrink-0 flex flex-col gap-2 min-h-0">
        <Panel title="GEOFENCE" right={uav.breach ? <Tag tone="rd">BREACH</Tag> : <Tag tone="gn">ARMED</Tag>}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[9px] text-dim tracking-widest">RADIUS</span>
            <span className="font-mono text-[12px] text-vio tabular">{geofenceR} KM</span>
          </div>
          <input type="range" min={100} max={2500} step={25} value={geofenceR} onChange={(e) => setGeofenceR(+e.target.value)} className="w-full" />
          <p className="font-mono text-[8.5px] text-dim leading-relaxed mt-2.5">
            Circular fence centered on HOME. Breach raises CRIT alert and forces RTL to nearest rally point.
          </p>
        </Panel>

        <Panel title="RALLY POINTS" right={<Tag tone="gn">{uav.rally.length}</Tag>} pad={false}>
          {uav.rally.map((r, i) => (
            <div key={r.id} className="px-3 py-2.5 border-b border-line/50 last:border-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-display text-[11px] font-bold tracking-widest text-gn">{r.id}</span>
                <span className="font-mono text-[8.5px] text-dim tabular">ALT {fmtInt(r.alt)}ft</span>
              </div>
              <div className="flex gap-1.5">
                <input type="number" step="0.05" value={r.lat} onChange={(e) => updateRally(uav.id, i, { lat: +e.target.value })}
                  className="flex-1 min-w-0 bg-ink border border-line px-1.5 py-1 font-mono text-[9.5px] text-snow focus:border-gn/60 tabular" />
                <input type="number" step="0.05" value={r.lon} onChange={(e) => updateRally(uav.id, i, { lon: +e.target.value })}
                  className="flex-1 min-w-0 bg-ink border border-line px-1.5 py-1 font-mono text-[9.5px] text-snow focus:border-gn/60 tabular" />
              </div>
            </div>
          ))}
        </Panel>

        <Panel title="COMMS BUDGET">
          <div className="space-y-2.5">
            <div>
              <div className="flex justify-between font-mono text-[9px] mb-1"><span className="text-dim">C2 LINK · KU-BAND</span><span className={uav.link > 85 ? "text-gn tabular" : "text-am tabular"}>{uav.link.toFixed(0)}%</span></div>
              <Bar v={uav.link} tone={uav.link > 85 ? "bg-gn" : "bg-am"} />
            </div>
            <div>
              <div className="flex justify-between font-mono text-[9px] mb-1"><span className="text-dim">BATTERY</span><span className="text-fog tabular">{uav.batt.toFixed(0)}%</span></div>
              <Bar v={uav.batt} tone={uav.batt < 25 ? "bg-rd" : uav.batt < 50 ? "bg-am" : "bg-gn"} />
            </div>
            <div>
              <div className="flex justify-between font-mono text-[9px] mb-1"><span className="text-dim">MISSION PROGRESS</span><span className="text-fog tabular">{Math.round((Math.min(uav.wpIndex, uav.wps.length) / uav.wps.length) * 100)}%</span></div>
              <Bar v={(Math.min(uav.wpIndex, uav.wps.length) / uav.wps.length) * 100} tone="bg-cy" />
            </div>
          </div>
        </Panel>

        <Panel title="CHECKLIST LOG" pad={false} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 overflow-y-auto p-3 space-y-1 font-mono text-[9px] tabular">
            {sim.logs.filter((l) => l.includes("UAS") || l.includes("CMD")).slice(-8).reverse().map((l, i) => (
              <div key={i} className={`${i === 0 ? "text-gn" : "text-dim"} truncate`}>{l}</div>
            ))}
          </div>
        </Panel>
      </aside>
    </div>
  );
}
