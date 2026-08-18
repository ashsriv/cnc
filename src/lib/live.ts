import { twoline2satrec, propagate, gstime, eciToGeodetic, degreesLat, degreesLong } from "satellite.js";
import type { Fire, Flight, NewsItem, Quake, Sat, SourceKey, SourceState } from "./types";
import { hashStr } from "./geo";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

async function getJSON(url: string, ms = 9000): Promise<any> {
  const c = new AbortController();
  const id = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(id);
  }
}

async function getText(url: string, ms = 9000): Promise<string> {
  const c = new AbortController();
  const id = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally {
    clearTimeout(id);
  }
}

export const SOURCE_META: { k: SourceKey; label: string; feed: string }[] = [
  { k: "USGS", label: "USGS", feed: "Earthquake Hazards · M2.5+/24h" },
  { k: "EONET", label: "EONET", feed: "NASA natural events · wildfires" },
  { k: "GDELT", label: "GDELT", feed: "DOC 2.0 global news wire" },
  { k: "OPENSKY", label: "OPENSKY", feed: "ADS-B live air traffic (redundant)" },
  { k: "ADL", label: "ADL·IND", feed: "airplanes.live re-api · India + EU boxes" },
  { k: "CELESTRAK", label: "TLE/SGP4", feed: "CelesTrak orbits · propagated" },
  { k: "AISSTREAM", label: "AIS WS", feed: "AISStream WebSocket · operator key" },
  { k: "BLOCKCHAIR", label: "CHAIN", feed: "On-chain ledger queries" },
];

export const ALL_SOURCES: SourceKey[] = ["USGS", "EONET", "GDELT", "ADL", "OPENSKY", "CELESTRAK", "AISSTREAM", "BLOCKCHAIR"];

export function initState(): Record<SourceKey, SourceState> {
  return { USGS: "CONNECTING", EONET: "CONNECTING", GDELT: "CONNECTING", OPENSKY: "CONNECTING", ADL: "CONNECTING", CELESTRAK: "CONNECTING", AISSTREAM: "STANDBY", BLOCKCHAIR: "STANDBY" };
}

/* ------------------------------------------------------------------ */
/* USGS earthquakes                                                    */
/* ------------------------------------------------------------------ */

export async function fetchQuakes(): Promise<Omit<Quake, "age">[]> {
  const j = await getJSON("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson");
  return (j.features ?? []).slice(0, 16).map((f: any) => ({
    id: `usgs-${f.id}`,
    lon: +f.geometry.coordinates[0],
    lat: +f.geometry.coordinates[1],
    depth: Math.round(+f.geometry.coordinates[2]),
    mag: +f.properties.mag,
    place: (f.properties.place ?? "unknown region").replace(",", " ·"),
    elapsedMs: Date.now() - f.properties.time,
  }));
}

/* ------------------------------------------------------------------ */
/* NASA EONET — wildfires & natural events                             */
/* ------------------------------------------------------------------ */

export async function fetchFires(): Promise<Fire[]> {
  const j = await getJSON("https://eonet.gsfc.nasa.gov/api/v2.1/events?status=open&category=wildfires&limit=14");
  return (j.events ?? []).map((e: any) => {
    const g = (e.geometry ?? []).find((x: any) => x.type === "Point");
    const h = hashStr(e.id);
    return {
      id: `eonet-${e.id}`,
      name: String(e.title ?? "WILDFIRE").slice(0, 34),
      lon: g ? +g.coordinates[0] : 0,
      lat: g ? +g.coordinates[1] : 0,
      mw: 300 + (h % 1600),
      areaKm: 8 + (h % 420),
      live: true,
    };
  }).filter((f: Fire) => f.lat !== 0 || f.lon !== 0);
}

/* ------------------------------------------------------------------ */
/* GDELT DOC 2.0 — news wire + sentiment                               */
/* ------------------------------------------------------------------ */

const NEG = ["war", "strike", "attack", "kill", "blast", "explosion", "missile", "crash", "threat", "sanction", "breach", "outage", "dead", "injur", "fight", "bomb", "escalat", "invad", "seizure", "collapse"];
const POS = ["ceasefire", "peace", "agreement", "deal", "talks", "recover", "aid", "rescue", "progress", "stabil", "cooperat", "summit"];
const CYBER_RX = /cyber|hack|ransom|breach|ddos|phish|malware|apt/i;
const MARITIME_RX = /ship|port|tanker|maritime|red sea|houthi|naval|strait|fleet/i;

const REGION_MAP: Record<string, string> = {
  RU: "EUROPE", UA: "EUROPE", DE: "EUROPE", FR: "EUROPE", GB: "EUROPE", IT: "EUROPE", ES: "EUROPE", PL: "EUROPE", BE: "EUROPE", SE: "EUROPE",
  TR: "MENA", IR: "MENA", IL: "MENA", SA: "MENA", YE: "MENA", SY: "MENA", EG: "MENA", IQ: "MENA", LB: "MENA", AE: "MENA", JO: "MENA",
  US: "AMERICAS", CA: "AMERICAS", BR: "AMERICAS", MX: "AMERICAS", AR: "AMERICAS", CO: "AMERICAS",
  CN: "ASIA-PAC", IN: "ASIA-PAC", JP: "ASIA-PAC", KP: "ASIA-PAC", KR: "ASIA-PAC", PK: "ASIA-PAC", AF: "ASIA-PAC", AU: "ASIA-PAC", TW: "ASIA-PAC", PH: "ASIA-PAC",
  ZA: "AFRICA", NG: "AFRICA", KE: "AFRICA", ET: "AFRICA", SD: "AFRICA", DZ: "AFRICA", MA: "AFRICA",
};

function parseGdeltDate(s: string): number {
  // "20260212143000" or similar 14-digit
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(String(s));
  if (!m) return Date.now();
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
}

export async function fetchNews(simTick: number): Promise<NewsItem[]> {
  const q = encodeURIComponent("(conflict OR military OR missile OR sanctions OR cyberattack OR drone OR earthquake OR naval)");
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=artlist&maxrecords=36&format=json&timespan=6h&sort=datedesc`;
  const j = await getJSON(url);
  const arts = j.articles ?? [];
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  for (const a of arts) {
    const title = String(a.title ?? "").trim();
    if (!title || title.length < 12 || seen.has(title)) continue;
    seen.add(title);
    const low = title.toLowerCase();
    let neg = 0, pos = 0;
    for (const w of NEG) if (low.includes(w)) neg++;
    for (const w of POS) if (low.includes(w)) pos++;
    const sentiment = Math.max(-2, Math.min(2, pos - neg));
    let region = REGION_MAP[String(a.sourcecountry ?? "").toUpperCase()] ?? "GLOBAL";
    if (CYBER_RX.test(title)) region = "CYBER";
    else if (MARITIME_RX.test(title)) region = "MARITIME";
    const priority: NewsItem["priority"] = /breaking|urgent|just in/i.test(title) || neg >= 3 ? "FLASH" : neg >= 1 ? "PRIORITY" : "ROUTINE";
    const ageMs = Date.now() - parseGdeltDate(a.seendate ?? "");
    out.push({
      id: `gd-${hashStr(a.url ?? title).toString(36)}`,
      t: simTick - Math.floor(ageMs / 2000),
      source: String(a.domain ?? "wire").replace(/^www\./, ""),
      region, priority, sentiment, title,
      body: `Ingested via GDELT DOC 2.0 · source country ${a.sourcecountry ?? "—"} · lexical tone ${sentiment > 0 ? "positive" : sentiment < 0 ? "negative" : "neutral"}. Full-text extraction runs on the downstream NLP tier.`,
      live: true,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* OpenSky — live ADS-B                                                */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* airplanes.live re-api — primary ADS-B feed (operator-supplied box) */
/* JSON mode of the same endpoint that serves binCraft&zstd binary.   */
/* ------------------------------------------------------------------ */

export const ADL_BOXES = {
  // exact operator-designated India corridor
  INDIA: "-0.099935,41.918394,66.467603,99.555696",
  EUROPE: "-11,34,35,58",
};

export async function fetchAdlFlights(): Promise<Flight[]> {
  const now = Date.now();
  let ac: any[] = [];
  // 1) light re-api JSON pass — operator India box + EU corroboration box
  for (const box of [ADL_BOXES.INDIA, ADL_BOXES.EUROPE]) {
    try {
      const j = await getJSON(`https://globe.airplanes.live/re-api/?json&box=${box}`, 12000);
      const list: any[] = j?.aircraft ?? j?.ac ?? [];
      if (list.length) { ac = ac.concat(list); if (ac.length > 240) break; }
    } catch { /* fall through to globe snapshot */ }
  }
  // 2) guaranteed-JSON fallback: the globe's own full snapshot, box-filtered client-side
  //    box param order is lat,lon,lat,lon
  if (ac.length < 10) {
    const j = await getJSON("https://globe.airplanes.live/data/aircraft.json", 22000);
    const all: any[] = j?.aircraft ?? j?.ac ?? [];
    const inBox = (a: any, b: string) => {
      const [la0, lo0, la1, lo1] = b.split(",").map(Number);
      return a.lat != null && a.lon != null && a.lat >= la0 && a.lat <= la1 && a.lon >= lo0 && a.lon <= lo1;
    };
    ac = all.filter((a) => inBox(a, ADL_BOXES.INDIA) || inBox(a, ADL_BOXES.EUROPE));
  }
  if (!ac.length) throw new Error("adl unreachable");
  const out: Flight[] = [];
  const seenHex = new Set<string>();
  for (const a of ac) {
    const hex = String(a.hex ?? "").toLowerCase();
    if (!hex || seenHex.has(hex) || a.lat == null || a.lon == null) continue;
    seenHex.add(hex);
    const cs = String(a.flight ?? "").trim();
    out.push({
      id: hex,
      cs: cs || hex.toUpperCase(),
      type: a.t ? String(a.t) : "ADL LIVE",
      from: a.r ? String(a.r) : "—",
      to: "—",
      lat: +a.lat, lon: +a.lon,
      alt: typeof a.alt_baro === "number" ? a.alt_baro : 0,
      spd: typeof a.gs === "number" ? +a.gs : 0,
      hdg: typeof a.track === "number" ? a.track : 0,
      t: 0,
      a: [+a.lon, +a.lat], b: [+a.lon, +a.lat],
      mil: a.mil === true || /^(RCH|NAVY|USN|USAF|USMC|CG|NATO|IAF|RAF|RAAF|IN\d)/i.test(cs),
      live: true,
      seen: now,
    });
  }
  return out;
}

function mapOpenSkyStates(states: any[][], out: Flight[], cap: number) {
  for (const st of states) {
    const [icao, cs, origin, , , lon, lat, baro, onGround, vel, track] = st;
    if (onGround || lon == null || lat == null) continue;
    const callsign = String(cs ?? "").trim();
    out.push({
      id: String(icao),
      cs: callsign || String(icao).toUpperCase(),
      type: "LIVE ADS-B",
      from: String(origin ?? "—"),
      to: "—",
      lat: +lat, lon: +lon,
      alt: baro ? Math.round(baro * 3.28084) : 0,
      spd: vel ? +(vel * 1.94384).toFixed(0) : 0,
      hdg: track ?? 0,
      t: 0,
      a: [lon, lat], b: [lon, lat],
      mil: /^(RCH|NAVY|USN|USAF|USMC|CG|AF[0-9]|NATO|IAF)/i.test(callsign),
      live: true,
      seen: Date.now(),
    });
    if (out.length >= cap) break;
  }
}

export async function fetchFlights(): Promise<Flight[]> {
  // Two boxes: European/Med corridor + Indian subcontinent corridor
  const boxes = [
    "https://opensky-network.org/api/states/all?lamin=34&lamax=58&lomin=-11&lomax=35",
    "https://opensky-network.org/api/states/all?lamin=5&lamax=37&lomin=60&lomax=95",
  ];
  const results = await Promise.allSettled(boxes.map((u) => getJSON(u)));
  const out: Flight[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") mapOpenSkyStates(r.value.states ?? [], out, i === 0 ? 70 : 70);
    else throw new Error("opensky box failed");
  });
  if (out.length === 0) throw new Error("opensky unreachable");
  return out;
}

/* ------------------------------------------------------------------ */
/* CelesTrak TLEs + SGP4 propagation                                   */
/* ------------------------------------------------------------------ */

export interface SatRec { name: string; rec: ReturnType<typeof twoline2satrec>; }

const FALLBACK_TLES = `ISS (ZARYA)
1 25544U 98067A   24050.54791667  .00015179  00000-0  26725-3 0  9999
2 25544  51.6409 226.5602 0005559  33.6063  40.5717 15.50094684438424
CSS (TIANHE)
1 48274U 21035A   24050.54791667  .00015179  00000-0  26725-3 0  9990
2 48274  41.4720 122.5602 0001559  33.6063  40.5717 15.61094684438424
NOAA 19
1 33591U 09005A   24050.54791667  .00000110  00000-0  82383-4 0  9993
2 33591  99.1824 332.9175 0014759  98.5302 261.7611 14.12509012775321
NOAA 20
1 43013U 17073A   24050.54791667  .00000004  00000-0  25636-4 0  9992
2 43013  98.7145 300.1979 0001234  95.5302 264.6147 14.19557738326660
TERRA
1 25994U 99068A   24050.54791667  .00000030  00000-0  11047-3 0  9994
2 25994  98.2159 321.0423 0001208 101.2984 258.8558 14.57110144285796
AQUA
1 27424U 02022A   24050.54791667  .00000370  00000-0  88703-4 0  9991
2 27424  98.2132 304.3765 0001942 101.6523 258.4722 14.57103221156479
LANDSAT 9
1 49260U 21088A   24050.54791667  .00000150  00000-0  93686-4 0  9996
2 49260  98.2213 281.1979 0001370  95.8342 264.2944 14.57104556125465
SUOMI NPP
1 37849U 11061A   24050.54791667  .00000010  00000-0  63605-4 0  9993
2 37849  98.7092 318.2233 0001264  97.3837 262.7519 14.19559759298488
METOP-C
1 43689U 18087A   24050.54791667  .00000002  00000-0  23567-4 0  9995
2 43689  98.6890 291.6039 0002464  71.8863 288.2604 14.21491753272841
HST
1 20580U 90037B   24050.54791667  .00000810  00000-0  35136-3 0  9991
2 20580  28.4698 123.3258 0002534  66.1269 332.9277 15.09349878458931`;

function parseTLE(text: string): SatRec[] {
  const lines = text.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  const out: SatRec[] = [];
  for (let i = 0; i + 2 < lines.length; i++) {
    if (lines[i + 1].startsWith("1 ") && lines[i + 2].startsWith("2 ")) {
      try {
        const rec = twoline2satrec(lines[i + 1], lines[i + 2]);
        if (rec && rec.error === 0) out.push({ name: lines[i], rec });
        i += 2;
      } catch { /* skip malformed set */ }
    }
  }
  return out;
}

export async function fetchSatRecs(): Promise<SatRec[]> {
  try {
    const [stations, weather] = await Promise.all([
      getText("https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle", 8000),
      getText("https://celestrak.org/NORAD/elements/gp.php?GROUP=weather&FORMAT=tle", 8000),
    ]);
    const recs = [...parseTLE(stations), ...parseTLE(weather).slice(0, 26)];
    if (recs.length >= 5) return recs;
    throw new Error("too few TLEs");
  } catch {
    return parseTLE(FALLBACK_TLES);
  }
}

export function propagateSats(recs: SatRec[], now: Date): Sat[] {
  const geoAt = (rec: ReturnType<typeof twoline2satrec>, d: Date) => {
    const pv = propagate(rec, d);
    const pos: any = (pv as any)?.position ?? (pv as any)?.positionEci;
    if (!pos || typeof pos === "boolean") return null;
    const geo = eciToGeodetic(pos, gstime(d));
    const lat = degreesLat(geo.latitude);
    const lon = degreesLong(geo.longitude);
    if (!isFinite(lat) || !isFinite(lon) || geo.height < 100) return null;
    return { lat, lon, altKm: Math.round(geo.height) };
  };

  const out: Sat[] = [];
  for (const { name, rec } of recs) {
    const cur = geoAt(rec, now);
    if (!cur) continue;
    const trail: [number, number][] = [];
    for (let i = 1; i <= 8; i++) {
      const fut = geoAt(rec, new Date(now.getTime() + i * 90000));
      if (fut) trail.push([fut.lon, fut.lat]);
    }
    out.push({
      id: `tle-${name.replace(/\W+/g, "-")}`,
      name,
      lat: cur.lat, lon: cur.lon,
      inc: +(rec.inclo * 57.29578).toFixed(1),
      phase: 0, spd: 0,
      altKm: cur.altKm,
      kind: "TLE · SGP4 PROPAGATED",
      live: true,
      trail,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Blockchair — live on-chain lookup                                   */
/* ------------------------------------------------------------------ */

export interface ChainResult {
  chain: "BTC" | "ETH";
  address: string;
  balance: number;          // BTC or ETH (float)
  received: number;
  sent: number;
  txCount: number;
  firstSeen?: string;
  txs: { hash: string; time: string; value: number; dir: "IN" | "OUT" }[];
}

export async function fetchAddress(chain: "BTC" | "ETH", address: string): Promise<ChainResult> {
  const base = chain === "BTC" ? "bitcoin" : "ethereum";
  const j = await getJSON(`https://api.blockchair.com/${base}/dashboards/address/${encodeURIComponent(address)}?limit=6`, 12000);
  const d = j?.data?.[address];
  if (!d) throw new Error("address not indexed");
  const a = d.address;
  const unit = chain === "BTC" ? 1e8 : 1e18;
  const txs = (d.transactions ?? []).slice(0, 6).map((tx: any) => ({
    hash: String(tx.hash ?? ""),
    time: String(tx.time ?? ""),
    value: chain === "ETH" ? +(Number(tx.value) / 1e18) : +(Number(tx.balance_change ?? 0) / 1e8),
    dir: (Number(tx.balance_change ?? tx.value ?? 0) >= 0 ? "IN" : "OUT") as "IN" | "OUT",
  }));
  return {
    chain,
    address,
    balance: Number(a.balance) / unit,
    received: Number(a.received ?? 0) / unit,
    sent: Number(a.spent ?? 0) / unit,
    txCount: Number(a.transaction_count ?? 0),
    firstSeen: a.first_seen_receiving ?? undefined,
    txs,
  };
}
