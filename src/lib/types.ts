export type View = "ops" | "feed" | "recon" | "entities" | "missions" | "watch" | "analytics" | "space" | "markets" | "graph" | "alerts";
export type MapMode = "vector" | "satellite" | "globe";
export type AnalyticsSection = "all" | "adsb" | "maritime" | "satellite" | "seismic" | "news" | "fusion";
export type LayerKey = "flights" | "ships" | "sats" | "cams" | "quakes" | "conflicts" | "fires";

export type SourceKey = "USGS" | "EONET" | "GDELT" | "OPENSKY" | "ADL" | "CELESTRAK" | "AISSTREAM" | "BLOCKCHAIR" | "SWPC" | "COINGECKO";
export interface FeedTelemetry { msgs: number; lat: number; ok: boolean; }
export type SourceState = "CONNECTING" | "LIVE" | "SIM" | "ERROR" | "STANDBY";

export interface Flight {
  id: string; cs: string; type: string; from: string; to: string;
  lat: number; lon: number; alt: number; spd: number; hdg: number; t: number;
  a: [number, number]; b: [number, number]; mil: boolean;
  live?: boolean;
  seen?: number;
}
export interface Ship {
  id: string; name: string; cls: string; lat: number; lon: number;
  spd: number; hdg: number; flag: string;
  live?: boolean; mmsi?: number;
}
export interface Sat {
  id: string; name: string; lat: number; lon: number; inc: number;
  phase: number; spd: number; altKm: number; kind: string;
  live?: boolean;
  trail?: [number, number][];
}
export interface Cam {
  id: string; name: string; lat: number; lon: number; online: boolean;
  viewers: number; fps: number; region: string;
}
export interface Quake { id: string; lat: number; lon: number; mag: number; depth: number; age: number; place: string; live?: boolean; }
export interface Conflict { id: string; name: string; lat: number; lon: number; rKm: number; intensity: number; trend: number; }
export interface Fire { id: string; name: string; lat: number; lon: number; mw: number; areaKm: number; live?: boolean; }

export interface NewsItem {
  id: string; t: number; source: string; region: string;
  priority: "FLASH" | "PRIORITY" | "ROUTINE";
  sentiment: number; title: string; body: string; coords?: [number, number];
  live?: boolean;
}

export interface Waypoint { lat: number; lon: number; alt: number; spd: number; action: string; }
export interface Rally { id: string; lat: number; lon: number; alt: number; }
export type UavMode = "STANDBY" | "ARMED" | "AUTO" | "LOITER" | "RTL";
export interface Uav {
  id: string; cs: string; frame: string; lat: number; lon: number; alt: number;
  gs: number; vs: number; hdg: number; batt: number; link: number; mode: UavMode;
  wpIndex: number; wps: Waypoint[]; home: [number, number]; rally: Rally[];
  bank: number; pitch: number; breach: boolean; lowB: boolean;
}

export interface Tx { hash: string; dir: "IN" | "OUT"; amount: number; cpty: string; time: string; flag?: string; }
export interface Wallet {
  id: string; label: string; chain: "BTC" | "ETH"; address: string; balance: number;
  usd: number; risk: number; txCount: number; spark: number[]; tags: string[]; txs: Tx[];
}
export interface SdnEntry { id: string; name: string; aliases: string[]; program: string; country: string; doc: string; }
export interface TgPost { time: string; text: string; sent: number; reach: number; kw: string[]; }
export interface TgChannel { id: string; handle: string; lang: string; subs: number; growth: number[]; posts: TgPost[]; spike: boolean; }

export interface WatchRule {
  id: string; entity: string; metric: string; op: string; threshold: number;
  active: boolean; triggered: boolean; last?: string;
}
export interface Alert { id: string; t: number; sev: "INFO" | "WARN" | "CRIT"; msg: string; }

export interface Sel { kind: LayerKey | "uav"; id: string }

export interface SpaceData {
  xray: { t: string; flux: number }[];
  kp: { t: string; kp: number }[];
  wind: { t: string; speed: number; density: number; temp: number }[];
  kpNow: number; fluxNow: number; speedNow: number;
  flare: string; storm: string;
}
export interface MarketCoin {
  id: string; symbol: string; name: string; price: number; change24h: number;
  spark: number[]; ohlc: [number, number, number, number, number][];
}

export interface StatsSeries {
  t: number[];
  flights: number[]; ships: number[]; sats: number[]; quakes: number[]; fires: number[];
  ingest: number[]; fusion: number[]; correlated: number[]; liveRatio: number[];
  darkShips: number[]; sentPos: number[]; sentNeg: number[]; sentNeu: number[]; newsRate: number[];
}

export interface SimState {
  t: number;
  flights: Flight[]; ships: Ship[]; sats: Sat[]; cams: Cam[];
  quakes: Quake[]; conflicts: Conflict[]; fires: Fire[];
  news: NewsItem[]; newsIdx: number; logs: string[];
  uavs: Uav[]; geofenceR: number;
  rules: WatchRule[]; alerts: Alert[]; tension: number[];
  stats: StatsSeries;
}
