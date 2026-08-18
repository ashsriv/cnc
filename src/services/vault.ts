import type { WatchRule, Alert } from "../lib/types";

/* ------------------------------------------------------------------ */
/* Local persistence vault — the durable tier of the in-browser       */
/* backend. Rules, alert history and operator configuration survive   */
/* reloads; exports produce real evidence files.                      */
/* ------------------------------------------------------------------ */

const KEY = "aegis_vault_v1";

export interface VaultData {
  rules: WatchRule[];
  alerts: Alert[];
  geofenceR: number;
  threat: number;
}

export function loadVault(): Partial<VaultData> | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Partial<VaultData>) : null;
  } catch {
    return null;
  }
}

export function saveVault(d: VaultData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch { /* quota / private mode — non-fatal */ }
}

export function exportCsv(name: string, header: string[], rows: (string | number)[][]): void {
  const esc = (c: string | number) => `"${String(c).replace(/"/g, '""')}"`;
  const csv = [header.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 800);
}
