export type Car = {
  id: string;
  name: string;
  plate?: string;
};

export type Reading = {
  id: string;
  carId: string;
  /** ISO date, e.g. 2026-10-13 */
  date: string;
  odometerKm: number;
  note?: string;
};

export type GerageData = {
  version: 1;
  cars: Car[];
  readings: Reading[];
};

export const emptyData = (): GerageData => ({ version: 1, cars: [], readings: [] });

export const newId = () => crypto.randomUUID();
