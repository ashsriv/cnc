const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function distKm(a: [number, number], b: [number, number]): number {
  const [la1, lo1] = a, [la2, lo2] = b;
  const dLa = rad(la2 - la1), dLo = rad(lo2 - lo1);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(rad(la1)) * Math.cos(rad(la2)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function bearing(a: [number, number], b: [number, number]): number {
  const [la1, lo1] = a, [la2, lo2] = b;
  const y = Math.sin(rad(lo2 - lo1)) * Math.cos(rad(la2));
  const x = Math.cos(rad(la1)) * Math.sin(rad(la2)) - Math.sin(rad(la1)) * Math.cos(rad(la2)) * Math.cos(rad(lo2 - lo1));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

export function lerpPos(a: [number, number], b: [number, number], t: number): [number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** move from pos toward target by a fraction f (visual speed) */
export function stepToward(pos: [number, number], target: [number, number], f: number): [number, number] {
  return [pos[0] + (target[0] - pos[0]) * f, pos[1] + (target[1] - pos[1]) * f];
}

export function wrapLon(lon: number): number {
  while (lon > 180) lon -= 360;
  while (lon < -180) lon += 360;
  return lon;
}

export function fmtCoord(lat: number, lon: number): string {
  const la = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}`;
  const lo = `${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}`;
  return `${la} ${lo}`;
}

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** deterministic PRNG from a seed */
export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rnd = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export function hexId(bytes: number): string {
  let s = "";
  const chars = "0123456789abcdef";
  for (let i = 0; i < bytes; i++) s += chars[Math.floor(Math.random() * 16)];
  return s;
}

export function fmtTickClock(t: number): string {
  const d = new Date();
  d.setSeconds(d.getSeconds());
  return d.toISOString().slice(11, 19);
}

export function agoLabel(tick: number, now: number): string {
  const s = (now - tick) * 2; // 1 tick == 2s of sim time
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ago`;
}
