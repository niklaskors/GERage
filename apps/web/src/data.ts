/** Preset car colours, in the order the colour picker shows them. */
export const CAR_COLORS = [
  "red",
  "orange",
  "yellow",
  "lime",
  "green",
  "teal",
  "sky",
  "blue",
  "purple",
  "pink",
  "brown",
  "beige",
  "white",
  "silver",
  "black",
] as const;
export type PresetColor = (typeof CAR_COLORS)[number];
/** A preset, or any other colour as #rrggbb. */
export type CarColor = PresetColor | `#${string}`;

export const isPreset = (color: CarColor): color is PresetColor => !color.startsWith("#");

/** Cars without a chosen colour take these in turn, so neighbours differ. */
const DEFAULT_COLORS: PresetColor[] = ["blue", "red", "green", "yellow", "orange", "purple", "silver", "black", "white"];

export type Car = {
  id: string;
  name: string;
  /** Optional: not every car in the spreadsheet has one. */
  plate?: string;
  /** Unset until chosen; then {@link carColor} picks one by the car's position. */
  color?: CarColor;
  /** Odometer reading when logging started. Each trip's readings follow from this plus the km before it. */
  startKm: number;
};

export type Purpose = "business" | "private";

/** One row of the trip log (rittenregistratie). */
export type Trip = {
  id: string;
  carId: string;
  /** ISO date, e.g. 2026-10-13 */
  date: string;
  km: number;
  from: string;
  to: string;
  purpose: Purpose;
  /** Deviating route (afwijkende route), e.g. "5 km detour because of roadworks" */
  detour?: string;
  note?: string;
};

export type GerageData = {
  version: 2;
  cars: Car[];
  /** Selected by default when registering trips. */
  favouriteCarId?: string;
  trips: Trip[];
};

export const emptyData = (): GerageData => ({ version: 2, cars: [], trips: [] });

type TripV1 = Omit<Trip, "km"> & { startKm: number; endKm: number };
type DataV1 = Omit<GerageData, "version" | "cars" | "trips"> & {
  version: 1;
  cars: Omit<Car, "startKm">[];
  trips: TripV1[];
};

/**
 * Brings saved data up to date. Version 1 stored a start and end reading per trip; now a car
 * has a start reading and trips only store km, so the car starts at its earliest trip's reading.
 */
export function migrate(data: GerageData | DataV1): GerageData {
  if (data.version === 2) return data;
  const cars = data.cars.map((car) => {
    const readings = data.trips.filter((t) => t.carId === car.id).map((t) => t.startKm);
    return { ...car, startKm: readings.length ? Math.min(...readings) : 0 };
  });
  const trips = data.trips.map(({ startKm, endKm, ...trip }) => ({ ...trip, km: Math.max(endKm - startKm, 0) }));
  return { ...data, version: 2, cars, trips };
}

/** The chosen colour, or a different default for each car in the list. */
export const carColor = (car: Car, index: number): CarColor => car.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length];

/** The car to register trips for: the given one, else the favourite, else the first. */
export const selectedCar = ({ cars, favouriteCarId }: GerageData, carId: string | null): Car | undefined =>
  cars.find((c) => c.id === carId) ?? cars.find((c) => c.id === favouriteCarId) ?? cars[0];

export const newId = () => crypto.randomUUID();
