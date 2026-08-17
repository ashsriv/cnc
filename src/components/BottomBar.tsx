import { useStore } from "../state/store";

export default function BottomBar() {
  const { sim } = useStore();
  const lastLog = sim.logs[sim.logs.length - 1] ?? "";
  const prevLog = sim.logs[sim.logs.length - 2] ?? "";
  const heads = sim.news.slice(0, 12);
  const ticker = heads.map((n) => `${n.priority === "FLASH" ? "◆" : "▪"} ${n.title}`).join("   ///   ");

  return (
    <footer className="h-9 shrink-0 border-t border-line bg-panel/90 flex items-stretch relative z-30">
      {/* console strip */}
      <div className="w-[46%] min-w-[320px] border-r border-line px-3 flex flex-col justify-center overflow-hidden">
        <div key={sim.t} className="font-mono text-[9.5px] text-gn/90 truncate anim-fadeup tabular">{lastLog}</div>
        <div className="font-mono text-[9px] text-dim truncate tabular">{prevLog}</div>
      </div>
      {/* headline ticker */}
      <div className="flex-1 overflow-hidden flex items-center relative">
        <span className="absolute left-0 top-0 bottom-0 z-10 flex items-center px-2 bg-panel font-display text-[9px] font-bold tracking-[0.2em] text-am border-r border-line">
          INTEL WIRE
        </span>
        <div className="marquee-track whitespace-nowrap pl-24 font-mono text-[10px] text-fog tabular">
          <span className="mr-12">{ticker}   ///   </span>
          <span>{ticker}   ///   </span>
        </div>
      </div>
      {/* right stats */}
      <div className="hidden md:flex items-center gap-3 px-3 border-l border-line font-mono text-[9px] text-dim tabular">
        <span>FEEDS <span className="text-cy">37</span></span>
        <span>INGEST <span className="text-gn">{(412 + (sim.t % 90)).toLocaleString()} msg/s</span></span>
        <span className="text-fog">T+<span className="text-snow">{String(Math.floor(sim.t / 60)).padStart(2, "0")}:{String(sim.t % 60).padStart(2, "0")}</span></span>
      </div>
    </footer>
  );
}
