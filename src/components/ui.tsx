import type { CSSProperties, ReactNode } from "react";

export function Corners({ color = "border-line2" }: { color?: string }) {
  const c = `absolute w-2.5 h-2.5 ${color}`;
  return (
    <>
      <span className={`${c} top-0 left-0 border-t border-l`} />
      <span className={`${c} top-0 right-0 border-t border-r`} />
      <span className={`${c} bottom-0 left-0 border-b border-l`} />
      <span className={`${c} bottom-0 right-0 border-b border-r`} />
    </>
  );
}

export function Panel({ title, right, children, className = "", pad = true }: {
  title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; pad?: boolean;
}) {
  return (
    <div className={`relative bg-panel/85 border border-line ${className}`}>
      <Corners />
      {title !== undefined && (
        <div className="flex items-center justify-between gap-3 px-3 h-9 border-b border-line bg-panel2/60">
          <div className="font-display text-[11px] font-semibold tracking-[0.18em] text-fog uppercase">{title}</div>
          {right}
        </div>
      )}
      <div className={pad ? "p-3" : ""}>{children}</div>
    </div>
  );
}

export function Tag({ children, tone = "cy" }: { children: ReactNode; tone?: "cy" | "am" | "rd" | "gn" | "vio" | "tl" | "fog" | "or" }) {
  const map: Record<string, string> = {
    cy: "text-cy border-cy/40 bg-cy/10",
    am: "text-am border-am/40 bg-am/10",
    rd: "text-rd border-rd/40 bg-rd/10",
    gn: "text-gn border-gn/40 bg-gn/10",
    vio: "text-vio border-vio/40 bg-vio/10",
    tl: "text-tl border-tl/40 bg-tl/10",
    or: "text-or border-or/40 bg-or/10",
    fog: "text-fog border-line2 bg-panel2/60",
  };
  return <span className={`inline-flex items-center px-1.5 py-px border font-mono text-[10px] tracking-wider ${map[tone]}`}>{children}</span>;
}

export function Stat({ label, value, unit, tone = "text-snow" }: { label: string; value: ReactNode; unit?: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] font-mono tracking-[0.14em] text-dim uppercase">{label}</div>
      <div className={`font-display font-semibold text-[15px] leading-tight tabular ${tone}`}>
        {value}{unit && <span className="text-[10px] text-fog font-mono ml-1">{unit}</span>}
      </div>
    </div>
  );
}

export function Bar({ v, tone = "bg-cy", w = "w-full" }: { v: number; tone?: string; w?: string }) {
  return (
    <div className={`h-1 ${w} bg-line/70 overflow-hidden`}>
      <div className={`h-full ${tone} transition-all duration-700`} style={{ width: `${Math.max(2, Math.min(100, v))}%` }} />
    </div>
  );
}

export function Spark({ data, tone = "#4fd8eb", h = 26, w = 90 }: { data: number[]; tone?: string; h?: number; w?: number }) {
  if (!data.length) return null;
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / span) * (h - 3) - 1.5}`).join(" ");
  return (
    <svg width={w} height={h} className="block">
      <polyline points={pts} fill="none" stroke={tone} strokeWidth="1.4" opacity="0.9" />
      <circle cx={w} cy={h - ((data[data.length - 1] - min) / span) * (h - 3) - 1.5} r="2" fill={tone} />
    </svg>
  );
}

export function Area({ data, tone = "#4fd8eb", h = 44 }: { data: number[]; tone?: string; h?: number }) {
  if (data.length < 2) return null;
  const w = 100;
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / span) * (h - 6) - 2}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full" style={{ height: h }}>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={tone} opacity="0.12" />
      <polyline points={pts} fill="none" stroke={tone} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Btn({ children, onClick, tone = "cy", disabled, small }: {
  children: ReactNode; onClick?: () => void; tone?: "cy" | "am" | "rd" | "gn" | "fog"; disabled?: boolean; small?: boolean;
}) {
  const map = {
    cy: "border-cy/50 text-cy hover:bg-cy/15 hover:shadow-[0_0_14px_rgba(79,216,235,0.25)]",
    am: "border-am/50 text-am hover:bg-am/15 hover:shadow-[0_0_14px_rgba(255,180,84,0.25)]",
    rd: "border-rd/50 text-rd hover:bg-rd/15 hover:shadow-[0_0_14px_rgba(255,93,93,0.28)]",
    gn: "border-gn/50 text-gn hover:bg-gn/15 hover:shadow-[0_0_14px_rgba(85,224,156,0.25)]",
    fog: "border-line2 text-fog hover:bg-panel2",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`border font-display font-semibold tracking-[0.14em] uppercase transition-all duration-150 ${map[tone]} ${small ? "text-[10px] px-2 py-1" : "text-[11px] px-3 py-1.5"} ${disabled ? "opacity-30 pointer-events-none" : ""}`}
    >
      {children}
    </button>
  );
}

export function Dot({ tone = "bg-gn", blink }: { tone?: string; blink?: boolean }) {
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${tone} ${blink ? "anim-blink" : ""}`} />;
}

export function Kv({ k, v, mono = true }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 py-1 border-b border-line/50 last:border-0">
      <span className="text-[10px] font-mono tracking-wider text-dim uppercase shrink-0">{k}</span>
      <span className={`text-[11px] text-snow text-right truncate ${mono ? "font-mono tabular" : ""}`}>{v}</span>
    </div>
  );
}

export const monoStyle: CSSProperties = { fontVariantNumeric: "tabular-nums" };
