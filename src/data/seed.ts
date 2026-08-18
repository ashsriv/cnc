import type {
  Flight, Ship, Sat, Cam, Quake, Conflict, Fire, NewsItem, Uav, Wallet,
  SdnEntry, TgChannel, WatchRule, Alert,
} from "../lib/types";
import { lerpPos, rnd, hexId } from "../lib/geo";

export const CITIES: { n: string; p: [number, number] }[] = [
  { n: "NEW YORK", p: [40.71, -74.01] }, { n: "LONDON", p: [51.51, -0.13] },
  { n: "TOKYO", p: [35.68, 139.69] }, { n: "DUBAI", p: [25.2, 55.27] },
  { n: "SINGAPORE", p: [1.35, 103.82] }, { n: "SÃO PAULO", p: [-23.55, -46.63] },
  { n: "JOHANNESBURG", p: [-26.2, 28.05] }, { n: "MOSCOW", p: [55.76, 37.62] },
  { n: "BEIJING", p: [39.9, 116.41] }, { n: "LOS ANGELES", p: [34.05, -118.24] },
  { n: "FRANKFURT", p: [50.11, 8.68] }, { n: "ISTANBUL", p: [41.01, 28.98] },
  { n: "CAIRO", p: [30.04, 31.24] }, { n: "MUMBAI", p: [19.08, 72.88] },
  { n: "SYDNEY", p: [-33.87, 151.21] }, { n: "LAGOS", p: [6.52, 3.38] },
  { n: "SEOUL", p: [37.57, 126.98] }, { n: "PARIS", p: [48.86, 2.35] },
  { n: "NAIROBI", p: [-1.29, 36.82] }, { n: "ANCHORAGE", p: [61.22, -149.9] },
  { n: "SANTIAGO", p: [-33.45, -70.67] }, { n: "REYKJAVIK", p: [64.15, -21.94] },
  { n: "DELHI", p: [28.61, 77.21] }, { n: "BENGALURU", p: [12.97, 77.59] },
  { n: "KOLKATA", p: [22.57, 88.36] }, { n: "CHENNAI", p: [13.08, 80.27] },
  { n: "HYDERABAD", p: [17.38, 78.49] }, { n: "KATHMANDU", p: [27.72, 85.32] },
  { n: "COLOMBO", p: [6.93, 79.85] }, { n: "KARACHI", p: [24.86, 67.01] },
  { n: "DHAKA", p: [23.81, 90.41] },
];

const AC_TYPES = ["A350-900", "B77W", "B788", "A320neo", "C-130J", "G650ER", "A400M", "B738", "KC-46A", "E-145"];

export const INDIA_PAIRS: [string, string][] = [
  ["DELHI", "MUMBAI"], ["BENGALURU", "DELHI"], ["KOLKATA", "CHENNAI"],
  ["DUBAI", "DELHI"], ["SINGAPORE", "BENGALURU"], ["LONDON", "DELHI"],
  ["MUMBAI", "KOLKATA"], ["HYDERABAD", "SINGAPORE"], ["TOKYO", "DELHI"],
  ["DELHI", "CHENNAI"], ["KATHMANDU", "DELHI"], ["COLOMBO", "MUMBAI"],
  ["DHAKA", "KOLKATA"], ["KARACHI", "DUBAI"],
];

function mkFlight(i: number, pair?: [string, string]): Flight {
  let a = CITIES[Math.floor(rnd(0, CITIES.length))];
  let b = CITIES[Math.floor(rnd(0, CITIES.length))];
  if (pair) {
    a = CITIES.find((c) => c.n === pair[0]) ?? a;
    b = CITIES.find((c) => c.n === pair[1]) ?? b;
  }
  while (b.n === a.n) b = CITIES[Math.floor(rnd(0, CITIES.length))];
  const india = pair !== undefined;
  const mil = !india && i % 4 === 0;
  const t = rnd(0.05, 0.9);
  const [lat, lon] = lerpPos(a.p, b.p, t);
  const intl = india && ["DUBAI", "SINGAPORE", "LONDON", "TOKYO", "DUBAI"].includes(pair[0]);
  return {
    id: `FL${100 + i}`,
    cs: mil ? `RCH${720 + i}` : india
      ? `${["AIC", "IGO", "VTI", "AIX"][i % 4]}${140 + i * 13}`
      : `${["DLH", "UAE", "BAW", "SIA", "AFR", "QTR"][i % 6]}${100 + i * 7}`,
    type: mil ? ["C-130J", "A400M", "KC-46A"][i % 3]
      : india ? (intl ? ["B788", "B77W", "A350-900"][i % 3] : ["A320neo", "A321neo", "B738"][i % 3])
      : AC_TYPES[i % AC_TYPES.length],
    from: a.n, to: b.n, lat, lon, alt: mil ? rnd(28, 34) * 1000 : india ? rnd(29, 40) * 1000 : rnd(32, 41) * 1000,
    spd: rnd(430, 520), hdg: 0, t, a: a.p, b: b.p, mil,
  };
}

export function seedFlights(): Flight[] {
  const base = Array.from({ length: 14 }, (_, i) => mkFlight(i));
  const india = INDIA_PAIRS.map((p, i) => mkFlight(40 + i, p));
  return [...base, ...india];
}
export { mkFlight };

export const seedShips: Ship[] = [
  { id: "SH01", name: "USS CARNEY · DDG-64", cls: "Destroyer", lat: 15.1, lon: 43.4, spd: 19, hdg: 318, flag: "USA" },
  { id: "SH02", name: "YUAN WANG 5", cls: "Research/Tracking", lat: -8.6, lon: 103.9, spd: 12, hdg: 275, flag: "PRC" },
  { id: "SH03", name: "MV NORDIC AURORA", cls: "Container", lat: 51.9, lon: 0.9, spd: 14, hdg: 42, flag: "DNK" },
  { id: "SH04", name: "KALYMNOS STAR", cls: "Crude Tanker", lat: 26.6, lon: 56.3, spd: 13, hdg: 64, flag: "GRC" },
  { id: "SH05", name: "MSC LEVANTE", cls: "Container", lat: 36.1, lon: 15.2, spd: 17, hdg: 88, flag: "PAN" },
  { id: "SH06", name: "ADMIRAL GORSHKOV", cls: "Frigate", lat: 69.4, lon: 33.2, spd: 16, hdg: 5, flag: "RUS" },
  { id: "SH07", name: "HAIJING 3502", cls: "Coast Guard", lat: 16.4, lon: 112.2, spd: 10, hdg: 140, flag: "PRC" },
  { id: "SH08", name: "EVER GIVEN II", cls: "Container", lat: 30.4, lon: 32.4, spd: 11, hdg: 175, flag: "SGP" },
  { id: "SH09", name: "HMS TRENT · P224", cls: "Patrol", lat: 50.8, lon: -6.3, spd: 18, hdg: 250, flag: "GBR" },
  { id: "SH10", name: "SEA CORAL (AIS DARK)", cls: "Tanker · Sanctions", lat: 34.8, lon: 21.6, spd: 9, hdg: 110, flag: "CMR" },
];

export const seedSats: Sat[] = [
  { id: "SA01", name: "KEYHOLE-12 (CRYSTAL)", lat: 30, lon: -20, inc: 97, phase: 0.4, spd: 1.5, altKm: 270, kind: "IMINT" },
  { id: "SA02", name: "LACROSSE-5", lat: -12, lon: 88, inc: 57, phase: 2.1, spd: 1.4, altKm: 705, kind: "RADAR" },
  { id: "SA03", name: "SENTINEL-2B", lat: 44, lon: 12, inc: 98.6, phase: 4.0, spd: 1.5, altKm: 786, kind: "OPTICAL" },
  { id: "SA04", name: "STARLINK-3142", lat: 53, lon: -101, inc: 53.2, phase: 1.2, spd: 1.7, altKm: 550, kind: "COMMS" },
  { id: "SA05", name: "GAOFEN-11 04", lat: -30, lon: 140, inc: 97.3, phase: 3.3, spd: 1.5, altKm: 505, kind: "IMINT" },
  { id: "SA06", name: "NROL-44 (MENTOR)", lat: 8, lon: 44, inc: 6.5, phase: 5.1, spd: 1.3, altKm: 35900, kind: "SIGINT" },
  { id: "SA07", name: "TERRASAR-X", lat: 57, lon: -77, inc: 97.4, phase: 0.9, spd: 1.6, altKm: 514, kind: "RADAR" },
  { id: "SA08", name: "ICESAT-2", lat: -66, lon: -150, inc: 92, phase: 2.7, spd: 1.5, altKm: 496, kind: "LIDAR" },
  { id: "SA09", name: "YAKHTA-KOSMOS 2558", lat: 41, lon: 60, inc: 97.7, phase: 4.6, spd: 1.5, altKm: 447, kind: "INSPECTOR" },
  { id: "SA10", name: "HAWK-36 (AEGIS RELAY)", lat: -20, lon: -30, inc: 42, phase: 1.8, spd: 1.6, altKm: 1200, kind: "COMMS" },
];

export const seedCams: Cam[] = [
  { id: "CM01", name: "LHR · TERMINAL 5 APRON", lat: 51.47, lon: -0.49, online: true, viewers: 4182, fps: 25, region: "EUROPE" },
  { id: "CM02", name: "ROTTERDAM · QUAY 7", lat: 51.95, lon: 4.13, online: true, viewers: 987, fps: 20, region: "EUROPE" },
  { id: "CM03", name: "GIBRALTAR STRAIT · TRAFFIC", lat: 36.13, lon: -5.35, online: true, viewers: 2210, fps: 30, region: "EUROPE" },
  { id: "CM04", name: "TIMES SQUARE · 47TH", lat: 40.76, lon: -73.98, online: true, viewers: 8841, fps: 30, region: "AMERICAS" },
  { id: "CM05", name: "SHIBUYA CROSSING", lat: 35.66, lon: 139.7, online: true, viewers: 12440, fps: 30, region: "ASIA-PAC" },
  { id: "CM06", name: "PANAMA CANAL · MIRAFLORES", lat: 8.99, lon: -79.58, online: false, viewers: 0, fps: 0, region: "AMERICAS" },
  { id: "CM07", name: "BOSPHORUS · ORTAKÖY", lat: 41.06, lon: 29.03, online: true, viewers: 3327, fps: 25, region: "MENA" },
  { id: "CM08", name: "SUEZ CANAL · ISMAILIA", lat: 30.6, lon: 32.27, online: true, viewers: 1502, fps: 20, region: "MENA" },
  { id: "CM09", name: "DOVER STRAIT · SOUTH FORELAND", lat: 51.14, lon: 1.37, online: true, viewers: 764, fps: 20, region: "EUROPE" },
  { id: "CM10", name: "MALACCA · PORT KLANG", lat: 3.0, lon: 101.39, online: true, viewers: 1108, fps: 25, region: "ASIA-PAC" },
  { id: "CM11", name: "PEARL HARBOR · GATE 3", lat: 21.35, lon: -157.97, online: false, viewers: 0, fps: 0, region: "ASIA-PAC" },
  { id: "CM12", name: "VENICE · GRAND CANAL", lat: 45.44, lon: 12.32, online: true, viewers: 5230, fps: 30, region: "EUROPE" },
  { id: "CM13", name: "REYKJAVÍK · HARBOR", lat: 64.15, lon: -21.94, online: true, viewers: 342, fps: 15, region: "EUROPE" },
  { id: "CM14", name: "SYDNEY · HARBOUR BRIDGE", lat: -33.85, lon: 151.21, online: true, viewers: 6721, fps: 30, region: "ASIA-PAC" },
];

export const seedQuakes: Quake[] = [
  { id: "EQ01", lat: 38.3, lon: 142.4, mag: 5.1, depth: 32, age: 14, place: "OFF MIYAGI, JAPAN" },
  { id: "EQ02", lat: -33.1, lon: -71.5, mag: 4.6, depth: 45, age: 61, place: "VALPARAÍSO, CHILE" },
  { id: "EQ03", lat: -6.2, lon: 130.4, mag: 4.9, depth: 153, age: 102, place: "BANDA SEA, INDONESIA" },
];

export const SEISMIC_ZONES: { place: string; lat: number; lon: number }[] = [
  { place: "JAPAN TRENCH", lat: 38.5, lon: 142.5 }, { place: "SAN ANDREAS, CA", lat: 35.1, lon: -119.6 },
  { place: "RING OF FIRE · CHILE", lat: -30.0, lon: -71.4 }, { place: "ANATOLIAN FAULT", lat: 39.1, lon: 38.4 },
  { place: "HINDU KUSH", lat: 36.5, lon: 71.1 }, { place: "MARIANA TRENCH", lat: 14.2, lon: 145.2 },
  { place: "ICELAND · REYKJANES", lat: 63.9, lon: -22.4 }, { place: "PHILIPPINE TRENCH", lat: 10.6, lon: 126.2 },
  { place: "ALEUTIAN ARC", lat: 52.5, lon: -168.0 }, { place: "SUNDA ARC", lat: -8.5, lon: 118.5 },
];

export const seedConflicts: Conflict[] = [
  { id: "CF01", name: "EASTERN UKRAINE", lat: 48.4, lon: 37.9, rKm: 380, intensity: 86, trend: 1 },
  { id: "CF02", name: "SUDAN · KHARTOUM AXIS", lat: 15.6, lon: 32.5, rKm: 420, intensity: 74, trend: 1 },
  { id: "CF03", name: "GAZA STRIP", lat: 31.45, lon: 34.45, rKm: 80, intensity: 91, trend: -1 },
  { id: "CF04", name: "NORTHERN MYANMAR", lat: 25.6, lon: 97.6, rKm: 260, intensity: 57, trend: 1 },
  { id: "CF05", name: "SAHEL · CENTRAL MALI", lat: 14.9, lon: -2.3, rKm: 340, intensity: 64, trend: 1 },
  { id: "CF06", name: "RED SEA · HOUTHI CORRIDOR", lat: 15.2, lon: 42.6, rKm: 300, intensity: 78, trend: 1 },
  { id: "CF07", name: "KASHMIR · LOC SECTOR", lat: 34.8, lon: 75.3, rKm: 190, intensity: 41, trend: -1 },
];

export const seedFires: Fire[] = [
  { id: "FI01", name: "AMAZONAS · APUI MOSAIC", lat: -7.4, lon: -59.5, mw: 1480, areaKm: 612 },
  { id: "FI02", name: "SAKHA · SIBERIAN TAIGA", lat: 62.6, lon: 129.3, mw: 940, areaKm: 1130 },
  { id: "FI03", name: "SIERRA NEVADA · CA", lat: 38.9, lon: -120.1, mw: 615, areaKm: 84 },
  { id: "FI04", name: "VICTORIA · AUSTRALIA", lat: -36.9, lon: 147.4, mw: 452, areaKm: 130 },
  { id: "FI05", name: "KALIMANTAN PEATLANDS", lat: -1.6, lon: 113.6, mw: 728, areaKm: 340 },
];

export const NEWS_POOL: Omit<NewsItem, "id" | "t">[] = [
  { source: "REUTERS", region: "MENA", priority: "FLASH", sentiment: -2, coords: [15.2, 42.6], title: "Two commercial tankers report drone intercepts over Red Sea corridor", body: "UKMTO issued advisories after coordinated one-way drone activity near the Bab el-Mandeb. Escort destroyers tracked 6 contacts; no vessel damage confirmed." },
  { source: "ADS-B FEED", region: "EUROPE", priority: "PRIORITY", sentiment: -1, coords: [51.5, 24.0], title: "NATO AEW&C sortie pattern shifts east — 3 AWACS on station simultaneously", body: "Rotational E-3A presence over Poland and Romania doubled within 24h, correlating with large Russian air exercise NOTAM over the Black Sea." },
  { source: "CISA BULLETIN", region: "CYBER", priority: "FLASH", sentiment: -2, title: "Exploitation-in-the-wild: zero-day in edge router firmware (CVSS 9.8)", body: "AEGIS recon modules should pivot SSL and WHOIS lookups against listed C2 infrastructure. Patches available; assume compromise for unpatched fleets." },
  { source: "MARITIME EXEC", region: "MARITIME", priority: "PRIORITY", sentiment: -1, coords: [34.8, 21.6], title: "Dark fleet tanker 'SEA CORAL' went AIS-silent for 19 hours south of Crete", body: "STS transfer suspected with a sanctioned shuttle tanker. Flag registry Cameroon shows no valid P&I cover." },
  { source: "AFP", region: "AFRICA", priority: "ROUTINE", sentiment: 0, coords: [15.6, 32.5], title: "UN: displacement from Khartoum axis crosses 2.4M as shelling continues", body: "Humanitarian corridors remain intermittent. Satellite-derived fire detections consistent with artillery exchanges in Omdurman." },
  { source: "FLIGHTRADAR", region: "ASIA-PAC", priority: "PRIORITY", sentiment: -1, coords: [25.2, 122.0], title: "Civil air traffic rerouted around live-fire drill zone east of Taipei FIR", body: "72 NOTAMs active. Military transport tempo from eastern PLA airbases +38% week-over-week per AEGIS flight layer." },
  { source: "OSINT DEF-MON", region: "EUROPE", priority: "PRIORITY", sentiment: -1, coords: [54.4, 20.5], title: "Rail-mounted missile brigade movement detected via CCTV network, Kaliningrad node", body: "Frame grab 04:12 UTC matches 9K720 transporter-erector signature. Confidence: moderate, cross-check with SAR pass at 11:40 UTC." },
  { source: "BBC MONITORING", region: "MENA", priority: "ROUTINE", sentiment: 0, title: "State media signals policy shift on uranium enrichment levels", body: "Sentiment model flags 3σ deviation in official channel language vs. 30-day baseline. Diplomats read the wording as an opening, not escalation." },
  { source: "USGS / EMSC", region: "ASIA-PAC", priority: "PRIORITY", sentiment: -2, coords: [38.3, 142.4], title: "M5.1 aftershock sequence continues off Miyagi — tsunami advisory not expected", body: "Depth 32 km, consistent with mainshock stress transfer. AEGIS seismic layer tracking 14 events in the last 6h." },
  { source: "CHAINALYSIS-LIKE", region: "CYBER", priority: "FLASH", sentiment: -2, title: "Sanctioned mixer wallet cluster reactivated — $41M moved in 90 minutes", body: "Hop analysis links to DPRK-linked laundering. OFAC cross-check in AEGIS entity module returns 3 SDN hits above 85% similarity." },
  { source: "REUTERS", region: "AMERICAS", priority: "ROUTINE", sentiment: 1, title: "Cease-fire monitors report third consecutive week of declining violations", body: "Cross-border shelling incidents down 62%. Confidence in the pause remains low; sensor posture unchanged." },
  { source: "TELEGRAM INTEL", region: "EUROPE", priority: "PRIORITY", sentiment: -1, coords: [48.4, 37.9], title: "Channel volume spike: 4 RU milblogger channels post grid references within 90 seconds", body: "Pattern historically precedes kinetic activity by 20–40 minutes. AEGIS watch rule TG-VOLUME-SPIKE armed." },
  { source: "NASA FIRMS", region: "ASIA-PAC", priority: "ROUTINE", sentiment: -1, coords: [-7.4, -59.5], title: "Amazon fire radiative power up 210% week-over-week across Apui mosaic", body: "Active fire front estimated at 14 km. Smoke plume drifting SE, degrading EO coverage over Rondônia for 48h." },
  { source: "SATELLITE DESK", region: "GLOBAL", priority: "PRIORITY", sentiment: 0, coords: [51.9, 102.5], title: "Unusual SAR satellite tasking surge over Lake Baikal — possible ICBM test prep", body: "Three radar birds tasked within 2h over Plesetsk-Kura corridor. AEGIS suggests watching for NOTAM corridor activation." },
  { source: "AP", region: "AFRICA", priority: "ROUTINE", sentiment: 0, coords: [14.9, -2.3], title: "Sahel junta states announce joint 'counter-terror' corridor patrol", body: "Analysts note corridor overlaps gold smuggling routes previously mapped in AEGIS entity dossiers." },
  { source: "FLIGHT INTEL", region: "ASIA-PAC", priority: "PRIORITY", sentiment: -1, coords: [13.6, 144.9], title: "RQ-4 Global Hawk sortie from Andersen correlates with carrier strike group transit", body: "22h ISR orbit east of the Philippine Sea. Transponder dark beyond 60 nm from Guam, re-acquired on descent." },
];

export const seedUavs: Uav[] = [
  {
    id: "UA01", cs: "KESTREL-1", frame: "MALE ISR · turbofan", home: [37.0, 35.42], lat: 37.0, lon: 35.42,
    alt: 0, gs: 0, vs: 0, hdg: 90, batt: 100, link: 99, mode: "STANDBY", wpIndex: 0,
    wps: [
      { lat: 36.6, lon: 36.2, alt: 22000, spd: 150, action: "TRANSIT" },
      { lat: 36.5, lon: 36.9, alt: 24000, spd: 130, action: "SURVEY" },
      { lat: 36.0, lon: 36.7, alt: 24000, spd: 130, action: "ORBIT" },
      { lat: 35.6, lon: 35.9, alt: 20000, spd: 140, action: "RELAY" },
      { lat: 36.2, lon: 35.6, alt: 18000, spd: 150, action: "TRANSIT" },
    ],
    rally: [{ id: "RP-1", lat: 36.3, lon: 35.5, alt: 8000 }, { id: "RP-2", lat: 36.8, lon: 35.9, alt: 12000 }],
    bank: 0, pitch: 0, breach: false, lowB: false,
  },
  {
    id: "UA02", cs: "ORCA-2", frame: "STOL SURVEY · twin prop", home: [13.58, 144.93], lat: 14.9, lon: 143.2,
    alt: 16000, gs: 128, vs: 0, hdg: 45, batt: 71, link: 88, mode: "AUTO", wpIndex: 2,
    wps: [
      { lat: 14.4, lon: 144.2, alt: 14000, spd: 125, action: "TRANSIT" },
      { lat: 15.1, lon: 143.6, alt: 16000, spd: 118, action: "SURVEY" },
      { lat: 15.8, lon: 144.6, alt: 16000, spd: 118, action: "SURVEY" },
      { lat: 15.2, lon: 145.6, alt: 18000, spd: 125, action: "RELAY" },
      { lat: 14.1, lon: 145.2, alt: 12000, spd: 130, action: "TRANSIT" },
    ],
    rally: [{ id: "RP-3", lat: 13.9, lon: 144.9, alt: 6000 }],
    bank: 2, pitch: 0.5, breach: false, lowB: false,
  },
  {
    id: "UA03", cs: "MANTIS-3", frame: "QUAD VTOL · EO/IR", home: [52.5, 13.4], lat: 52.52, lon: 13.45,
    alt: 1200, gs: 42, vs: -2, hdg: 200, batt: 44, link: 95, mode: "LOITER", wpIndex: 0,
    wps: [
      { lat: 52.51, lon: 13.38, alt: 1200, spd: 45, action: "SURVEY" },
      { lat: 52.49, lon: 13.42, alt: 1200, spd: 45, action: "PHOTO" },
      { lat: 52.53, lon: 13.47, alt: 1500, spd: 50, action: "ORBIT" },
    ],
    rally: [{ id: "RP-4", lat: 52.5, lon: 13.41, alt: 500 }],
    bank: -3, pitch: -1, breach: false, lowB: false,
  },
];

export const seedWallets: Wallet[] = [
  {
    id: "WL01", label: "MIXER EGRESS · cluster 88-A", chain: "BTC", address: "bc1q9d4ywgfnd8h43da5tpcxcn6ajv590cg6d3tg6x",
    balance: 128.44, usd: 8.4e6, risk: 91, txCount: 4182,
    spark: [12, 18, 14, 26, 44, 38, 61, 54, 72, 68, 83, 91],
    tags: ["OFAC-HIT", "MIXER", "HIGH-VELOCITY"],
    txs: [
      { hash: "8f3a…c21d", dir: "IN", amount: 42.1, cpty: "bc1q·unknown (peel)", time: "04:12:44Z", flag: "STRUCTURING" },
      { hash: "12be…90fa", dir: "OUT", amount: 11.8, cpty: "1A1z…DivfNa", time: "04:13:02Z" },
      { hash: "cc71…44ab", dir: "OUT", amount: 30.2, cpty: "EXCHANGE · KYC-GAP", time: "04:13:19Z", flag: "CEX OTC" },
      { hash: "7d02…e918", dir: "IN", amount: 6.4, cpty: "RANSOMWARE VICTIM TAG", time: "05:01:12Z", flag: "RANSOM" },
    ],
  },
  {
    id: "WL02", label: "GENESIS COIN · dormant watch", chain: "BTC", address: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    balance: 68.11, usd: 4.5e6, risk: 34, txCount: 1312,
    spark: [60, 58, 61, 59, 60, 62, 58, 60, 59, 61, 60, 60],
    tags: ["DORMANT", "HISTORIC"],
    txs: [
      { hash: "4a5e…1e0b", dir: "IN", amount: 0.02, cpty: "DONATION PATTERN", time: "22:51:07Z" },
      { hash: "0b31…77cc", dir: "IN", amount: 0.05, cpty: "DONATION PATTERN", time: "19:22:41Z" },
    ],
  },
  {
    id: "WL03", label: "DPRK LAUNDERING · hop 3", chain: "ETH", address: "0x7f36a5a4f2ce4f7c0b1de8d1aa3a2f0b7e213c9d",
    balance: 9412.7, usd: 22.1e6, risk: 97, txCount: 18233,
    spark: [5, 8, 22, 18, 34, 55, 48, 76, 69, 88, 95, 97],
    tags: ["OFAC-HIT", "BRIDGE-HOP", "DPRK-LINKED"],
    txs: [
      { hash: "0x91aa…4c02", dir: "IN", amount: 1450, cpty: "CROSS-CHAIN BRIDGE", time: "03:44:18Z", flag: "BRIDGE" },
      { hash: "0x3e10…b7f1", dir: "OUT", amount: 980, cpty: "0x000…dEaD (burn?)", time: "03:45:02Z", flag: "OBFUSCATION" },
      { hash: "0xf8c2…91d3", dir: "OUT", amount: 470, cpty: "DEX · 4-HOP SPLIT", time: "03:45:40Z", flag: "PEEL CHAIN" },
    ],
  },
  {
    id: "WL04", label: "ETH FOUNDATION · baseline", chain: "ETH", address: "0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe",
    balance: 1103.2, usd: 2.6e6, risk: 8, txCount: 98211,
    spark: [40, 42, 41, 43, 42, 44, 43, 45, 44, 46, 45, 44],
    tags: ["EXCHANGE-GRADE", "BASELINE"],
    txs: [
      { hash: "0x11cc…ab19", dir: "OUT", amount: 250, cpty: "MULTISIG TREASURY", time: "12:10:55Z" },
    ],
  },
];

export const seedSdn: SdnEntry[] = [
  { id: "SDN1", name: "VOSTOK DIGITAL OOO", aliases: ["VOSTOK DIGITAL", "V-DIGITAL RU"], program: "CYBER2", country: "RU", doc: "ID 41287" },
  { id: "SDN2", name: "KIM SONG-CHOL", aliases: ["KIM SONG CHOL", "PAK SONG-CHOL"], program: "DPRK2", country: "KP", doc: "ID 38812" },
  { id: "SDN3", name: "AL-BARAKA EXCHANGE LLC", aliases: ["ALBARAKA EXCH", "AB EXCHANGE FZE"], program: "SDGT", country: "AE", doc: "ID 52201" },
  { id: "SDN4", name: "NORDSTREAM LOGISTICS SIA", aliases: ["NORDSTREAM LOG", "NS LOGISTICS"], program: "RUSSIA-EO14024", country: "LV", doc: "ID 47730" },
  { id: "SDN5", name: "REYES MARITIME GROUP", aliases: ["REYES SHIPPING", "RMG PANAMA"], program: "ILLEGAL-PETRO", country: "PA", doc: "ID 55118" },
  { id: "SDN6", name: "TEHRAN MICRO ELECTRONICS", aliases: ["TME-IR", "TEHRAN MICRO"], program: "NPWMD", country: "IR", doc: "ID 36654" },
  { id: "SDN7", name: "CASA BLANCA TRADING", aliases: ["CB TRADING CARACAS"], program: "VENEZUELA", country: "VE", doc: "ID 49902" },
  { id: "SDN8", name: "ZHAO WEIMIN", aliases: ["ZHAO WEI MIN", "MICHAEL ZHAO"], program: "FENTANYL", country: "CN", doc: "ID 53077" },
];

export const seedTg: TgChannel[] = [
  {
    id: "TG01", handle: "RVOSINT_BALTIC", lang: "RU", subs: 248310, spike: true,
    growth: [220, 240, 250, 280, 310, 305, 340, 380, 410, 470, 520, 610],
    posts: [
      { time: "04:31Z", text: "Гриды 36VQD — работа кассетных по позициям у линии. Видео через 10 мин.", sent: -2, reach: 41000, kw: ["GRID", "ARTY"] },
      { time: "04:18Z", text: "Подтверждаем: колонна 40+ единиц на трассе, направление запад.", sent: -1, reach: 38200, kw: ["CONVOY"] },
      { time: "03:57Z", text: "Ночная работа БПЛА — слушаем эфир, активность выше обычной.", sent: -1, reach: 29400, kw: ["UAV", "RF"] },
    ],
  },
  {
    id: "TG02", handle: "MilAviationWatch", lang: "EN", subs: 112884, spike: false,
    growth: [80, 84, 81, 88, 92, 90, 95, 101, 99, 104, 108, 112],
    posts: [
      { time: "04:22Z", text: "RCH720 (C-17) departed Ramstein, squawking 4511, routing east low-level. Pattern matches last week's airlift.", sent: -1, reach: 18200, kw: ["ADS-B"] },
      { time: "03:40Z", text: "Two A-50U airborne from Ivanovo simultaneously — rare posture. Track logs attached.", sent: -2, reach: 24100, kw: ["AEW"] },
    ],
  },
  {
    id: "TG03", handle: "Frontline_MENA", lang: "AR", subs: 402551, spike: true,
    growth: [300, 310, 340, 335, 360, 390, 410, 450, 460, 500, 540, 590],
    posts: [
      { time: "04:27Z", text: "اعتراض مسيّرتين فوق الممر البحري — مصادر محلية تؤكد سماع انفجارات", sent: -2, reach: 66000, kw: ["DRONE", "MARITIME"] },
      { time: "04:02Z", text: "ناقلة النفط غير المعروفة لا تزال صامتة منذ ١٩ ساعة", sent: -1, reach: 51200, kw: ["AIS-DARK"] },
    ],
  },
  {
    id: "TG04", handle: "CyberThreatWire", lang: "EN", subs: 88120, spike: false,
    growth: [50, 52, 51, 55, 54, 58, 60, 59, 63, 62, 66, 68],
    posts: [
      { time: "04:11Z", text: "Sample of the router 0-day circulating in invite-only forums. Sandbox detonation results in 2h.", sent: -2, reach: 12400, kw: ["0-DAY"] },
      { time: "02:58Z", text: "Phish kit 'ATOMICVAPER' updated — now targets MFA push fatigue.", sent: -1, reach: 9800, kw: ["PHISH"] },
    ],
  },
];

export const seedRules: WatchRule[] = [
  { id: "WR01", entity: "SEISMIC", metric: "MAGNITUDE", op: "≥", threshold: 6.0, active: true, triggered: true, last: "T-02:41 · EQ M6.4 MARIANA" },
  { id: "WR02", entity: "AIS", metric: "DARK PERIOD (H)", op: "≥", threshold: 12, active: true, triggered: true, last: "T-04:10 · SEA CORAL" },
  { id: "WR03", entity: "OFAC", metric: "MATCH SCORE (%)", op: "≥", threshold: 85, active: true, triggered: false },
  { id: "WR04", entity: "UAS", metric: "BATTERY (%)", op: "≤", threshold: 25, active: true, triggered: false },
  { id: "WR05", entity: "GEOFENCE", metric: "BREACH", op: "==", threshold: 1, active: true, triggered: false },
  { id: "WR06", entity: "TELEGRAM", metric: "VOLUME Δ (%)", op: "≥", threshold: 180, active: true, triggered: true, last: "T-00:18 · RVOSINT_BALTIC" },
  { id: "WR07", entity: "FIRMS", metric: "FRP (MW)", op: "≥", threshold: 1200, active: false, triggered: false },
];

export const seedAlerts: Alert[] = [
  { id: "AL03", t: -40, sev: "CRIT", msg: "TELEGRAM VOLUME SPIKE +214% — RVOSINT_BALTIC (RU)" },
  { id: "AL02", t: -310, sev: "WARN", msg: "AIS DARK — SEA CORAL silent 19h, grid 34.8N 21.6E" },
  { id: "AL01", t: -510, sev: "CRIT", msg: "SEISMIC M6.4 — MARIANA TRENCH, depth 210km" },
];

export const LOG_POOL: ((t: number) => string)[] = [
  () => `[LINK] AES-256 relay FRA-02 · jitter ${Math.floor(rnd(8, 40))}ms · OK`,
  (t) => `[ADS-B] frame burst ${Math.floor(rnd(280, 520))} msg/s · ${16 + (t % 3)} tracks fused`,
  () => `[SAT] next pass KEYHOLE-12 · +${Math.floor(rnd(4, 18))}m · elev ${Math.floor(rnd(22, 74))}°`,
  () => `[AIS] dark-vessel sweep grid ${Math.floor(rnd(10, 60))}Q${["PD", "ND", "PF", "MG"][Math.floor(rnd(0, 4))]} · 0 new contacts`,
  () => `[NLP] telegram corpus ingest +${Math.floor(rnd(120, 900))} msgs · ${Math.floor(rnd(2, 9))} entities extracted`,
  () => `[CCTV] mesh heartbeat ${Math.floor(rnd(1380, 1410))}/1408 cams · ${Math.floor(rnd(0, 3))} re-buffering`,
  () => `[WALLET] mempool scan ${Math.floor(rnd(1800, 2600))} tx · ${Math.floor(rnd(0, 4))} risk-hits tagged`,
  () => `[FIRMS] thermal revision pass · ${Math.floor(rnd(2, 11))} hotspots re-rated`,
  (t) => `[FUSE] correlation engine cycle ${t} · ${Math.floor(rnd(3, 12))} cross-layer links formed`,
  () => `[OFAC] SDN delta sync · list rev ${Math.floor(rnd(700, 760))} · 0 new entries`,
];
