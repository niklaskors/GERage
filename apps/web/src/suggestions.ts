import type { Purpose, Trip } from "./data";

/**
 * Helpers for the trip form, based on how the paper/Excel trip log is filled in: most trips are a
 * few fixed routes (home → work → another building → home) with nearly the same km every time,
 * and the same address gets typed in several ways ("Geb.425", "Geb 425", "Geb,425").
 */

/** Compares addresses ignoring case, spaces and punctuation, and "Gebouw 425" equals "Geb 425". */
export const addressKey = (address: string) =>
  address
    .toLowerCase()
    .replaceAll("gebouw", "geb")
    .replace(/[^\p{L}\p{N}]/gu, "");

export type Route = {
  /** The most used spelling of the destination. */
  to: string;
  count: number;
  /** The median km driven on this route. */
  km: number;
  purpose: Purpose;
};

/** Where trips from `from` usually go, most frequent first. */
export function routesFrom(trips: Trip[], from: string): Route[] {
  const fromKey = addressKey(from);
  if (!fromKey) return [];
  const byDestination = new Map<string, Trip[]>();
  for (const trip of trips) {
    const toKey = addressKey(trip.to);
    if (addressKey(trip.from) !== fromKey || !toKey || toKey === fromKey) continue;
    byDestination.set(toKey, [...(byDestination.get(toKey) ?? []), trip]);
  }
  return [...byDestination.values()]
    .map((routeTrips) => ({
      to: mostCommon(routeTrips.map((t) => t.to.trim())),
      count: routeTrips.length,
      km: median(routeTrips.map((t) => t.km)),
      purpose: mostCommon(routeTrips.map((t) => t.purpose)),
    }))
    .sort((a, b) => b.count - a.count);
}

export function findRoute(trips: Trip[], from: string, to: string): Route | undefined {
  const toKey = addressKey(to);
  return toKey ? routesFrom(trips, from).find((r) => addressKey(r.to) === toKey) : undefined;
}

/**
 * The usual spelling of `input` when it's probably a typo or another way of writing a known
 * address, e.g. "Westeroom 8" for "Westerzoom 8". Typos made before count as known addresses
 * too, so this picks the most used similar address (`addresses` is ordered most used first),
 * unless that's `input` itself. Numbers must match exactly: "Geb 120" is never "Geb 425".
 */
export function similarAddress(input: string, addresses: string[]): string | undefined {
  const trimmed = input.trim();
  const key = addressKey(trimmed);
  if (key.length < 4) return undefined;
  const digits = key.replace(/\D/g, "");
  const maxDistance = key.length >= 8 ? 2 : 1;
  const usual = addresses.find((address) => {
    const other = addressKey(address);
    if (other === key) return true;
    return other.replace(/\D/g, "") === digits && distance(key, other) <= maxDistance;
  });
  return usual === trimmed ? undefined : usual;
}

/** True for addresses like "Privé" or "prive" that stand for an unnamed private destination. */
export const isPrivatePlaceholder = (address: string) => /^priv[eé]$/i.test(address.trim());

function mostCommon<T>(values: T[]): T {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** Levenshtein distance. */
function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    row = next;
  }
  return row[b.length];
}
