import type { Car, Trip } from "./data";

export type LoggedTrip = Trip & {
  /** Trip number within its day, starting at 1 (rit-nr). */
  number: number;
  startKm: number;
  endKm: number;
};

/**
 * Sorts a car's trips by date and adds what the spreadsheet calculated: trip number and the
 * odometer readings, counted on from the car's start reading. Trips on the same day keep the
 * order they were added in.
 */
export function logTrips(car: Car, trips: Trip[]): LoggedTrip[] {
  const sorted = [...trips].sort((a, b) => a.date.localeCompare(b.date));
  let number = 0;
  let odometer = car.startKm;
  return sorted.map((trip, i) => {
    number = sorted[i - 1]?.date === trip.date ? number + 1 : 1;
    const startKm = odometer;
    odometer += trip.km;
    return { ...trip, number, startKm, endKm: odometer };
  });
}

/** What saving an edit does to the odometer readings, shown before saving. */
export type EditImpact = {
  /** The edited trip's start reading after the change; moving it to another date changes it. */
  startKm: number;
  /** Other trips whose readings change. */
  shifted: number;
  /** How far they move, when they all move the same distance (a km change, not a date change). */
  shiftKm?: number;
  currentKm: { before: number; after: number };
};

export function editImpact(car: Car, trips: LoggedTrip[], id: string, change: { date: string; km: number }): EditImpact {
  const after = logTrips(car, trips.map((trip) => (trip.id === id ? { ...trip, ...change } : trip)));
  const before = new Map(trips.map((trip) => [trip.id, trip.startKm]));
  const moves = after.filter((trip) => trip.id !== id).map((trip) => trip.startKm - before.get(trip.id)!).filter(Boolean);
  return {
    startKm: after.find((trip) => trip.id === id)!.startKm,
    shifted: moves.length,
    shiftKm: moves.length > 0 && moves.every((m) => m === moves[0]) ? moves[0] : undefined,
    currentKm: { before: trips.at(-1)?.endKm ?? car.startKm, after: after.at(-1)?.endKm ?? car.startKm },
  };
}

export type YearTotals = { year: string; business: number; private: number };

/** Km per year, split into business and private. */
export function totalsByYear(trips: LoggedTrip[]): YearTotals[] {
  const years = new Map<string, YearTotals>();
  for (const trip of trips) {
    const year = trip.date.slice(0, 4);
    const totals = years.get(year) ?? { year, business: 0, private: 0 };
    totals[trip.purpose] += trip.km;
    years.set(year, totals);
  }
  return [...years.values()].sort((a, b) => b.year.localeCompare(a.year));
}

/** Addresses used before, most used first, for autocompletion. */
export function knownAddresses(trips: Trip[]): string[] {
  const counts = new Map<string, number>();
  for (const address of trips.flatMap((t) => [t.from, t.to])) {
    counts.set(address, (counts.get(address) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([address]) => address);
}

export function download(filename: string, content: Blob) {
  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
