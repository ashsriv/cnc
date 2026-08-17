import type { SimState, Flight, NewsItem, Uav, Alert } from "./types";
import {
  seedFlights, mkFlight, seedShips, seedSats, seedCams, seedQuakes, seedConflicts,
  seedFires, seedUavs, seedRules, seedAlerts, NEWS_POOL, SEISMIC_ZONES, LOG_POOL, CITIES,
} from "../data/seed";
import { distKm, bearing, lerpPos, stepToward, wrapLon, clamp, rnd, pick, hexId, hashStr, mulberry } from "./geo";

export function initSim(): SimState {
  return {
    t: 0,
    flights: seedFlights(), ships: seedShips.map((s) => ({ ...s })),
    sats: seedSats.map((s) => ({ ...s })), cams: seedCams.map((c) => ({ ...c })),
    quakes: seedQuakes.map((q) => ({ ...q })), conflicts: seedConflicts.map((c) => ({ ...c })),
    fires: seedFires.map((f) => ({ ...f })),
    news: NEWS_POOL.slice(0, 7).map((n, i) => ({ ...n, id: `NW${i}`, t: -(i + 1) * 26 })),
    newsIdx: 7,
    logs: [
      "[BOOT] AEGIS C2 core online · sensor mesh 14/14 relays",
      "[FUSE] cross-layer correlation engine armed",
      "[LINK] satlink uplink established · AES-256",
    ],
    uavs: seedUavs.map((u) => ({ ...u, wps: u.wps.map((w) => ({ ...w })), rally: u.rally.map((r) => ({ ...r })) })),
    geofenceR: 650,
    rules: seedRules.map((r) => ({ ...r })),
    alerts: seedAlerts.map((a) => ({ ...a })),
    tension: Array.from({ length: 48 }, (_, i) => 58 + Math.sin(i / 5) * 6 + rnd(-2, 2)),
  };
}

function pushAlert(alerts: Alert[], t: number, sev: Alert["sev"], msg: string): Alert[] {
  return [{ id: `AL${t}${hexId(2)}`, t, sev, msg }, ...alerts].slice(0, 40);
}

export function stepSim(s: SimState): SimState {
  const t = s.t + 1;
  let alerts = s.alerts;
  const logs = [...s.logs];

  // ---- flights ----
  const flights: Flight[] = s.flights.map((f) => {
    const nf = { ...f };
    nf.t += 0.0045 + Math.random() * 0.0025;
    if (nf.t >= 1) {
      const fresh = mkFlight(Math.floor(Math.random() * 1000));
      fresh.a = nf.b;
      let nb = CITIES[Math.floor(Math.random() * CITIES.length)];
      while (nb.n === fresh.a.map((v) => v).join(",")) {
        nb = CITIES[Math.floor(Math.random() * CITIES.length)];
        if (Math.random() < 0.3) break;
      }
      fresh.b = nb.p;
      nf.a = fresh.a; nf.b = fresh.b; nf.t = 0;
      nf.from = fresh.from; nf.to = nb.n;
      nf.cs = fresh.cs; nf.type = fresh.type; nf.mil = fresh.mil;
      nf.alt = rnd(30, 41) * 1000; nf.spd = rnd(430, 520);
    }
    const [lat, lon] = lerpPos(nf.a, nf.b, nf.t);
    nf.lat = lat; nf.lon = lon;
    nf.hdg = bearing(nf.a, nf.b);
    return nf;
  });

  // ---- ships ----
  const ships = s.ships.map((sh) => {
    const n = { ...sh };
    n.lon = wrapLon(n.lon + (n.hdg < 180 ? 1 : -1) * 0.05 * (n.spd / 14));
    n.lat = clamp(n.lat + Math.sin((t + hashStr(n.id)) / 11) * 0.02, -60, 72);
    n.spd = clamp(n.spd + rnd(-0.4, 0.4), 6, 24);
    return n;
  });

  // ---- sats ----
  const sats = s.sats.map((sa) => {
    const n = { ...sa };
    n.phase += n.spd * 0.02;
    n.lon = wrapLon(n.lon + 1.15);
    n.lat = n.inc > 90 ? n.inc - 180 + (180 - n.inc) * 2 * Math.sin(n.phase) : n.inc * Math.sin(n.phase);
    n.lat = clamp(n.lat, -85, 85);
    return n;
  });

  // ---- cams ----
  const cams = s.cams.map((c) => {
    const n = { ...c };
    if (Math.random() < 0.02) { n.online = !n.online; n.viewers = 0; }
    if (n.online) { n.viewers = Math.max(40, Math.round(n.viewers + rnd(-60, 70))); n.fps = [15, 20, 25, 30][hashStr(n.id + t) % 4]; }
    return n;
  });

  // ---- quakes ----
  let quakes = s.quakes.map((q) => ({ ...q, age: q.age + 1 })).filter((q) => q.age < 140);
  let newsIdx = s.newsIdx;
  let news = s.news;
  if (Math.random() < 0.032) {
    const z = pick(SEISMIC_ZONES);
    const mag = Math.round((4.1 + Math.pow(Math.random(), 2.2) * 3.4) * 10) / 10;
    const q = {
      id: `EQ${t}`, lat: z.lat + rnd(-1.6, 1.6), lon: z.lon + rnd(-1.6, 1.6),
      mag, depth: Math.round(rnd(8, 560)), age: 0, place: z.place,
    };
    quakes = [q, ...quakes].slice(0, 9);
    if (mag >= 5.5) {
      alerts = pushAlert(alerts, t, mag >= 6.5 ? "CRIT" : "WARN", `SEISMIC M${mag} — ${z.place} · depth ${q.depth}km`);
      logs.push(`[USGS] M${mag} event ingested · ${z.place} · ring buffer notified`);
    }
    if (mag >= 6.2) {
      const flash: NewsItem = {
        id: `NW${t}`, t, source: "USGS / EMSC", region: "GLOBAL", priority: "FLASH", sentiment: -2,
        coords: [q.lat, q.lon], title: `M${mag} earthquake — ${z.place.toLowerCase()} · depth ${q.depth} km`,
        body: "Automated ingest from seismic network. AEGIS layer updated; downstream PAGER estimate pending.",
      };
      news = [flash, ...news].slice(0, 60);
    }
  }

  // ---- conflicts & fires drift ----
  const conflicts = s.conflicts.map((c) => ({
    ...c,
    intensity: clamp(Math.round(c.intensity + c.trend * rnd(-1.4, 1.6) + rnd(-1, 1)), 20, 99),
    trend: Math.random() < 0.05 ? -c.trend : c.trend,
  }));
  const fires = s.fires.map((f) => ({
    ...f,
    mw: Math.max(80, Math.round(f.mw + rnd(-38, 42))),
    areaKm: Math.round(f.areaKm + rnd(-2, 6)),
  }));

  // ---- news stream ----
  if (t % 9 === 4) {
    const item = NEWS_POOL[newsIdx % NEWS_POOL.length];
    news = [{ ...item, id: `NW${t}`, t }, ...news].slice(0, 60);
    newsIdx++;
  }

  // ---- console logs ----
  logs.push(LOG_POOL[t % LOG_POOL.length](t));
  if (Math.random() < 0.45) logs.push(LOG_POOL[(t * 3 + 2) % LOG_POOL.length](t));
  const logsTrim = logs.slice(-70);

  // ---- UAVs ----
  const geofenceR = s.geofenceR;
  const uavs: Uav[] = s.uavs.map((u) => {
    const n: Uav = { ...u };
    const home = n.home;
    if (n.mode === "AUTO") {
      const wp = n.wps[Math.min(n.wpIndex, n.wps.length - 1)];
      const pos: [number, number] = [n.lat, n.lon];
      const d = distKm(pos, [wp.lat, wp.lon]);
      if (d < 10) {
        n.wpIndex += 1;
        logsTrim.push(`[UAS] ${n.cs} waypoint ${n.wpIndex}/${n.wps.length} · action ${wp.action} complete`);
        if (n.wpIndex >= n.wps.length) {
          n.mode = "LOITER"; n.wpIndex = n.wps.length - 1;
          alerts = pushAlert(alerts, t, "INFO", `${n.cs} mission track complete — holding LOITER`);
        }
      } else {
        const [la, lo] = stepToward(pos, [wp.lat, wp.lon], clamp(9 / d, 0.02, 0.5));
        n.lat = la; n.lon = lo;
        n.hdg = bearing(pos, [wp.lat, wp.lon]);
        n.alt += (wp.alt - n.alt) * 0.08;
        n.gs = wp.spd + rnd(-4, 4);
        n.bank = clamp(((n.hdg - u.hdg + 540) % 360 - 180) * 2.2, -28, 28);
      }
      n.batt = Math.max(0, n.batt - 0.055);
    } else if (n.mode === "LOITER") {
      n.hdg = (n.hdg + 3.5) % 360;
      n.lat += Math.sin(t / 9 + hashStr(n.id)) * 0.004;
      n.lon += Math.cos(t / 9 + hashStr(n.id)) * 0.004;
      n.gs = rnd(38, 52);
      n.batt = Math.max(0, n.batt - 0.02);
      n.bank += ((-12) - n.bank) * 0.15;
    } else if (n.mode === "RTL") {
      const rally = n.rally[0];
      const pos: [number, number] = [n.lat, n.lon];
      const d = distKm(pos, [rally.lat, rally.lon]);
      if (d < 8) {
        n.mode = "STANDBY"; n.wpIndex = 0;
        alerts = pushAlert(alerts, t, "INFO", `${n.cs} recovered at rally ${rally.id}`);
        logsTrim.push(`[UAS] ${n.cs} touchdown · battery ${n.batt.toFixed(0)}%`);
      } else {
        const [la, lo] = stepToward(pos, [rally.lat, rally.lon], clamp(12 / d, 0.03, 0.6));
        n.lat = la; n.lon = lo;
        n.hdg = bearing(pos, [rally.lat, rally.lon]);
        n.alt = Math.max(0, n.alt * 0.985);
        n.gs = rnd(55, 70);
      }
      n.batt = Math.max(0, n.batt - 0.045);
    } else if (n.mode === "ARMED") {
      n.batt = Math.max(0, n.batt - 0.006);
      n.link = clamp(n.link + rnd(-1, 1), 90, 100);
    } else {
      n.link = clamp(96 + rnd(-1.5, 1.5), 90, 100);
    }
    n.vs = n.mode === "AUTO" ? rnd(-3, 3) : n.mode === "LOITER" ? rnd(-1, 1) : 0;
    n.pitch = clamp(n.vs * 0.8 + rnd(-0.4, 0.4), -9, 9);
    if (n.mode === "STANDBY") { n.alt = 0; n.gs = 0; n.bank = 0; n.pitch = 0; n.lat = home[0]; n.lon = home[1]; }

    // geofence + battery guards
    const dHome = distKm([n.lat, n.lon], home);
    if (dHome > geofenceR && n.mode !== "STANDBY" && n.mode !== "RTL") {
      if (!n.breach) {
        alerts = pushAlert(alerts, t, "CRIT", `GEOFENCE BREACH — ${n.cs} at ${Math.round(dHome)}km · auto-RTL engaged`);
        logsTrim.push(`[UAS] ${n.cs} geofence violated · failover RTL`);
        n.mode = "RTL";
      }
      n.breach = true;
    } else n.breach = false;

    if (n.batt <= 25 && !n.lowB && n.mode !== "STANDBY") {
      n.lowB = true;
      alerts = pushAlert(alerts, t, "WARN", `${n.cs} battery ${n.batt.toFixed(0)}% — below 25% threshold`);
      if (n.mode === "AUTO") n.mode = "RTL";
    }
    if (n.batt > 30) n.lowB = false;
    return n;
  });

  // ---- tension index ----
  const conflictAvg = conflicts.reduce((a, c) => a + c.intensity, 0) / conflicts.length;
  const tension = [...s.tension, clamp(conflictAvg * 0.72 + quakes.length * 1.4 + rnd(-1.5, 1.5), 20, 98)].slice(-90);

  return {
    ...s, t, flights, ships, sats, cams, quakes, conflicts, fires, news, newsIdx,
    logs: logsTrim.slice(-70), uavs, alerts, tension, geofenceR,
  };
}

/* ------------------------------------------------------------------ */
/* RECON output generators — deterministic per query string           */
/* ------------------------------------------------------------------ */
export function genRecon(tool: "dns" | "whois" | "ip" | "ssl", input: string): string[] {
  const h = hashStr(input.toLowerCase().trim());
  const R = mulberry(h);
  const ip = () => `${Math.floor(R() * 223) + 8}.${Math.floor(R() * 255)}.${Math.floor(R() * 255)}.${Math.floor(R() * 254) + 1}`;
  const host = input.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim() || "example.com";
  const L: string[] = [`$ aegis-recon ${tool} ${host}`, `▸ resolving via relay FRA-02 …`, ""];
  if (tool === "dns") {
    const a1 = ip(), a2 = ip();
    L.push(
      `A      ${host}.            299   IN  A     ${a1}`,
      `A      ${host}.            299   IN  A     ${a2}`,
      `AAAA   ${host}.            299   IN  AAAA  2a06:98c0:3600::${Math.floor(R() * 900) + 100}`,
      `NS     ${host}.            86400 IN  NS    ns1.${["cloudns", "edgecast", "quad9x", "darkrelay"][h % 4]}.net`,
      `NS     ${host}.            86400 IN  NS    ns2.${["cloudns", "edgecast", "quad9x", "darkrelay"][h % 4]}.net`,
      `MX     ${host}.            3600  IN  MX    10 mail.${host}`,
      `TXT    ${host}.            3600  IN  TXT   "v=spf1 include:_spf.${host} ~all"`,
      "",
      `[ok] 7 records · ${Math.floor(R() * 60) + 18}ms · no SERVFAIL`,
      R() > 0.55 ? `[!] passive-DNS history: 3 rotations in 30d — fast-flux heuristic ${R() > 0.5 ? "POSITIVE" : "neg"}` : `[ok] zone stable over 30d passive-DNS window`,
    );
  } else if (tool === "whois") {
    const yr = 2013 + (h % 10);
    L.push(
      `Domain Name: ${host.toUpperCase()}`,
      `Registry Domain ID: D${Math.floor(R() * 8e9)}`,
      `Registrar: ${["NameSilo Technologies", "Tucows Domains", "Regtime Ltd.", "Internet Domain Service BS"][h % 4]}`,
      `Registrar WHOIS Server: whois.${["namesilo", "tucows", "regtime", "internetbs"][h % 4]}.com`,
      `Creation Date: ${yr}-0${(h % 8) + 1}-1${h % 9}T08:14:00Z`,
      `Registry Expiry: ${yr + 2}-0${(h % 8) + 1}-1${h % 9}T08:14:00Z`,
      `Domain Status: clientTransferProhibited`,
      `Registrant: REDACTED FOR PRIVACY (GDPR Art. 6(1)(f))`,
      `Name Server: NS1.${host.toUpperCase().slice(0, 12)}.COM`,
      `Name Server: NS2.${host.toUpperCase().slice(0, 12)}.COM`,
      "",
      R() < 0.4 ? "[!] registrar pattern clusters with 41 other tracked domains (graph link formed)" : "[ok] registrar profile: benign baseline",
    );
  } else if (tool === "ip") {
    const target = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ? host : ip();
    const ports = [22, 80, 443, 3306, 8080, 8443, 4444, 2222].filter(() => R() > 0.55);
    L.push(
      `TARGET     ${target}`,
      `ASN        AS${Math.floor(R() * 60000) + 1000} · ${["DigitalOcean LLC", "OVH SAS", "Choopa LLC", "Hetzner Online", "M247 Europe SRL"][h % 5]}`,
      `GEO        ${["NL · Amsterdam", "DE · Falkenstein", "US · Ashburn", "SG · Singapore", "RO · Bucharest"][h % 5]}`,
      `COORDS     ${(R() * 90).toFixed(4)}, ${(R() * 300 - 150).toFixed(4)}`,
      `OPEN PORTS ${ports.length ? ports.join(", ") : "none observed"}`,
      `REPUTATION ${Math.floor(R() * 100)}/100  ${R() > 0.6 ? "· TOR-EXIT: no · PROXY: no" : "· TOR-EXIT: YES · PROXY: YES"}`,
      `FIRST SEEN ${2019 + (h % 6)}-${String((h % 12) + 1).padStart(2, "0")}-${String((h % 27) + 1).padStart(2, "0")}`,
      `TLS CERTS  ${Math.floor(R() * 8)} historical (crt.sh mirror)`,
      "",
      R() > 0.5 ? "[!] host appears in 2 incident datasets · pivots queued in entity graph" : "[ok] no incident dataset membership",
    );
  } else {
    L.push(
      `SUBJECT    CN=${host}`,
      `ISSUER     ${["Let's Encrypt R3", "Sectigo RSA DV", "ZeroSSL ECC", "GoGetSSL RSA DV"][h % 4]}`,
      `SERIAL     ${hexStr(R)}${hexStr(R)}`,
      `VALID      ${2025}-${String((h % 12) + 1).padStart(2, "0")}-11 → ${2026}-${String((h % 12) + 1).padStart(2, "0")}-09`,
      `KEY        ${R() > 0.5 ? "RSA 2048 · SHA-256" : "EC P-256 · SHA-384"}`,
      `SAN        ${host}, www.${host}, api.${host}`,
      `CT LOGS    ${Math.floor(R() * 4) + 1} submissions · transparency OK`,
      `GRADE      ${["A+", "A", "B"][h % 3]}   ${h % 3 === 2 ? "· weak cipher (3DES) offered" : "· strong profile"}`,
      "",
      R() > 0.7 ? "[!] cert re-issued 3× in 14d — possible infrastructure churn" : "[ok] issuance cadence normal",
    );
  }
  return L;
}
const hexStr = (R: () => number) => Math.floor(R() * 0xffff).toString(16).padStart(4, "0");
