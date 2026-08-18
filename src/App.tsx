import { useEffect, useState } from "react";
import { StoreProvider, useStore } from "./state/store";
import TopBar from "./components/TopBar";
import Sidebar from "./components/Sidebar";
import BottomBar from "./components/BottomBar";
import OpsView from "./views/OpsView";
import FeedView from "./views/FeedView";
import ReconView from "./views/ReconView";
import EntitiesView from "./views/EntitiesView";
import MissionView from "./views/MissionView";
import WatchlistView from "./views/WatchlistView";
import AnalyticsView from "./views/AnalyticsView";

const BOOT_LINES = [
  "AEGIS C2 KERNEL 4.2.1 — secure boot verified",
  "mounting sensor mesh … 14/14 relays online",
  "live uplinks: ADL re-api · USGS · EONET · GDELT · OPENSKY · CELESTRAK",
  "ADL India corridor armed · 0.10°S→66.5°N · 41.9°E→99.6°E · 15 s",
  "persistence vault mounted · rules + alert history durable",
  "synthetic fallback armed for unreachable feeds",
  "loading basemap · Natural Earth 110m … OK",
  "correlation engine seeded · 2,412 entities",
  "operator OP-7 NIGHTOWL authenticated · TS//SIM",
];

function Boot({ done }: { done: () => void }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((v) => v + 1), 190);
    const end = setTimeout(done, BOOT_LINES.length * 190 + 750);
    return () => { clearInterval(id); clearTimeout(end); };
  }, [done]);
  return (
    <div className="fixed inset-0 z-[100] bg-ink flex items-center justify-center amb-grid">
      <div className="scanlines absolute inset-0" />
      <div className="w-[440px]">
        <div className="flex items-center gap-3 mb-5">
          <svg width="40" height="40" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="10.5" fill="none" stroke="#4fd8eb" strokeWidth="1.4" />
            <path d="M16 1.5v8M16 22.5v8M1.5 16h8M22.5 16h8" stroke="#4fd8eb" strokeWidth="1.4" />
            <circle cx="16" cy="16" r="2" fill="#ffb454" />
          </svg>
          <div>
            <div className="font-display font-bold text-[24px] tracking-[0.26em] text-snow">AEGIS <span className="text-cy">C2</span></div>
            <div className="font-mono text-[9px] tracking-[0.34em] text-dim">OSINT COMMAND &amp; CONTROL CONSOLE</div>
          </div>
        </div>
        <div className="border border-line bg-panel/80 p-4 font-mono text-[10.5px] leading-[1.9] tabular min-h-[158px]">
          {BOOT_LINES.slice(0, n).map((l, i) => (
            <div key={i} className="anim-fadeup"><span className="text-gn">▸</span> <span className="text-fog">{l}</span></div>
          ))}
          {n < BOOT_LINES.length && <span className="text-cy anim-blink">▮</span>}
          {n >= BOOT_LINES.length && <div className="text-cy mt-1">ALL SYSTEMS NOMINAL — ENTERING CONSOLE…</div>}
          <div className="mt-3 h-[3px] bg-line overflow-hidden">
            <div className="h-full bg-cy" style={{ animation: "bootbar 1.9s cubic-bezier(0.3,0.8,0.4,1) forwards" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Shell() {
  const { view } = useStore();
  return (
    <div className="h-full flex flex-col relative amb-grid">
      {/* ambient glows */}
      <div className="pointer-events-none fixed inset-0 z-0"
        style={{ background: "radial-gradient(ellipse 55% 45% at 12% 0%, rgba(24,153,180,0.07), transparent 60%), radial-gradient(ellipse 45% 40% at 92% 100%, rgba(255,180,84,0.045), transparent 60%)" }} />
      <div className="scanlines fixed inset-0 z-[60]" />
      <div className="vignette fixed inset-0 z-[59]" />

      <TopBar />
      <div className="flex-1 flex min-h-0 relative z-10">
        <Sidebar />
        <main className="flex-1 flex min-h-0 min-w-0" key={view}>
          {view === "ops" && <OpsView />}
          {view === "feed" && <FeedView />}
          {view === "recon" && <ReconView />}
          {view === "entities" && <EntitiesView />}
          {view === "missions" && <MissionView />}
          {view === "watch" && <WatchlistView />}
          {view === "analytics" && <AnalyticsView />}
        </main>
      </div>
      <BottomBar />
    </div>
  );
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [fading, setFading] = useState(false);
  return (
    <StoreProvider>
      <Shell />
      {booting && (
        <div className={`transition-opacity duration-500 ${fading ? "opacity-0" : "opacity-100"}`}>
          <Boot done={() => { setFading(true); setTimeout(() => setBooting(false), 500); }} />
        </div>
      )}
    </StoreProvider>
  );
}
