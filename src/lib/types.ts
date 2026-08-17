export type View = "ops" | "feed" | "recon" | "entities" | "missions" | "watch";
export type LayerKey = "flights" | "ships" | "sats" | "cams" | "quakes" | "conflicts" | "fires";

export interface Flight {
  id: string; cs: string; type: string; from: string; to: string;
  lat: number; lon: number; alt: number; spd: number; hdg: number; t: number;
  a: [number, number]; b: [number, number]; mil: boolean;
}
export interface Ship {
  id: string; name: string; cls: string; lat: number; lon: number;
  spd: number; hdg: number; flag: string;
}
export interface Sat {
  id: string; name: string; lat: number; lon: number; inc: number;
  phase: number; spd: number; altKm: number; kind: string;
}
export interface Cam {
  id: string; name: string; lat: number; lon: number; online: boolean;
  viewers: number; fps: number; region: string;
}
export interface Quake { id: string; lat: number; lon: number; mag: number; depth: number; age: number; place: string; }
export interface Conflict { id: string; name: string; lat: number; lon: number; rKm: number; intensity: number; trend: number; }
export interface Fire { id: string; name: string; lat: number; lon: number; mw: number; areaKm: number; }

export interface NewsItem {
  id: string; t: number; source: string; region: string;
  priority: "FLASH" | "PRIORITY" | "ROUTINE";
  sentiment: number; title: string; body: string; coords?: [number, number];
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

export interface SimState {
  t: number;
  flights: Flight[]; ships: Ship[]; sats: Sat[]; cams: Cam[];
  quakes: Quake[]; conflicts: Conflict[]; fires: Fire[];
  news: NewsItem[]; newsIdx: number; logs: string[];
  uavs: Uav[]; geofenceR: number;
  rules: WatchRule[]; alerts: Alert[]; tension: number[];
}
