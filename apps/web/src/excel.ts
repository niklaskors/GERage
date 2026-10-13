import type { CellValue, Workbook, Worksheet } from "exceljs";
import type { Car, Purpose, Trip } from "./data";
import { formatPlate } from "./LicensePlate";
import type { LoggedTrip } from "./tripLog";

/**
 * Import and export in the layout of the Dutch rittenregistratie spreadsheet: one tab per car,
 * the car's make, type and plate in rows 3–4, column headers in row 5 and a trip per row below.
 * exceljs is large, so it's only loaded when a file is read or written.
 */

const loadExcel = async () => (await import("exceljs")).default;

const HEADERS = [
  "Datum",
  "Rit-nr",
  "Beginstand kilometerteller",
  "Eindstand kilometerteller",
  "Aantal kilometers",
  "Beginadres rit",
  "Eindadres rit",
  "Afwijkende route",
  "Karakter van de rit",
  "Bijzonderheden",
];

export type ImportedTrip = Omit<Trip, "id" | "carId">;

/** Something in the sheet that didn't fit and was changed or should be checked. */
export type ImportFix =
  | { kind: "date"; row: number; from: string; to: string }
  | { kind: "gap"; row: number; km: number };

export type ImportedCar = {
  sheet: string;
  name: string;
  plate: string;
  startKm: number;
  trips: ImportedTrip[];
  fixes: ImportFix[];
};

export async function readWorkbook(file: File): Promise<ImportedCar[]> {
  const Excel = await loadExcel();
  const workbook = new Excel.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  return workbook.worksheets.map(readSheet).filter((car): car is ImportedCar => car !== undefined);
}

function readSheet(sheet: Worksheet): ImportedCar | undefined {
  const headerRow = findRow(sheet, 30, (texts) => texts[0]?.startsWith("datum") && texts.some((t) => t.includes("kilometer")));
  if (!headerRow) return undefined;

  const headers = rowTexts(sheet, headerRow);
  const column = (test: (header: string) => boolean, fallback: number) => {
    const index = headers.findIndex((h) => h && test(h));
    return (index === -1 ? fallback : index) + 1;
  };
  const cols = {
    date: 1,
    start: column((h) => h.startsWith("begin") && h.includes("stand"), 2),
    // The template says "Einstand".
    end: column((h) => /^ein(d)?stand/.test(h), 3),
    from: column((h) => h.startsWith("beginadres"), 5),
    to: column((h) => h.startsWith("eindadres"), 6),
    detour: column((h) => h.startsWith("afwijkend"), 7),
    purpose: column((h) => h.startsWith("karakter"), 8),
    note: column((h) => h.startsWith("bijzonderheden"), 9),
  };

  // "Merk auto", "Type auto" and "Kenteken" are labels with the value in the cell below.
  const below = (label: string) => {
    for (let r = 1; r < headerRow; r++) {
      const texts = rowTexts(sheet, r);
      const c = texts.findIndex((t) => t?.startsWith(label));
      if (c !== -1) return text(sheet.getCell(r + 1, c + 1).value);
    }
    return "";
  };
  const name = [below("merk"), below("type")].filter(Boolean).join(" ") || sheet.name;
  const plate = formatPlate(below("kenteken"));

  const raw: { row: number; date: string; start?: number; end: number; trip: Omit<ImportedTrip, "date" | "km"> }[] = [];
  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const date = isoDate(sheet.getCell(r, cols.date).value);
    const end = number(sheet.getCell(r, cols.end).value);
    if (!date || end === undefined) continue;
    raw.push({
      row: r,
      date,
      start: number(sheet.getCell(r, cols.start).value),
      end,
      trip: {
        from: text(sheet.getCell(r, cols.from).value),
        to: text(sheet.getCell(r, cols.to).value),
        purpose: purpose(text(sheet.getCell(r, cols.purpose).value)),
        detour: text(sheet.getCell(r, cols.detour).value) || undefined,
        note: text(sheet.getCell(r, cols.note).value) || undefined,
      },
    });
  }
  if (raw.length === 0) return undefined;

  const fixes: ImportFix[] = [];
  const trips: ImportedTrip[] = [];
  let previousEnd: number | undefined;
  for (const [i, { row, date, start = previousEnd ?? raw[i].end, end, trip }] of raw.entries()) {
    if (previousEnd !== undefined && start !== previousEnd) fixes.push({ kind: "gap", row, km: start - previousEnd });
    const fixedDate = fixDate(date, trips.at(-1)?.date, raw[i + 1]?.date);
    if (fixedDate !== date) fixes.push({ kind: "date", row, from: date, to: fixedDate });
    trips.push({ ...trip, date: fixedDate, km: Math.max(end - start, 0) });
    previousEnd = end;
  }
  const startKm = raw[0].start ?? raw[0].end;
  return { sheet: sheet.name, name, plate, startKm, trips, fixes };
}

/**
 * Trips are in driving order, so a date before the previous trip's is a typo (2016 or 2025 for
 * 2026, or an empty date that Excel shows as 1900). The readings are counted in date order, so
 * it has to be fixed: first try the previous trip's year, else use the previous trip's date.
 */
function fixDate(date: string, previous?: string, next?: string): string {
  if (!previous || date >= previous) return date;
  const sameYear = previous.slice(0, 4) + date.slice(4);
  const fits = sameYear >= previous && (!next || next < previous || sameYear <= next);
  return fits ? sameYear : previous;
}

export async function writeWorkbook(cars: { car: Car; trips: LoggedTrip[] }[]): Promise<Blob> {
  const Excel = await loadExcel();
  const workbook = new Excel.Workbook();
  const sheetNames = new Set<string>();
  for (const { car, trips } of cars) addSheet(workbook, uniqueSheetName(car.name, sheetNames), car, trips);
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function addSheet(workbook: Workbook, name: string, car: Car, trips: LoggedTrip[]) {
  const sheet = workbook.addWorksheet(name);
  sheet.getCell("A1").value = "Naam";
  sheet.getCell("E1").value = "Burgerservicenummer";
  sheet.getCell("A3").value = "Merk auto";
  sheet.getCell("C3").value = "Type auto";
  sheet.getCell("D3").value = "Kenteken";
  sheet.getCell("A4").value = car.name;
  sheet.getCell("D4").value = car.plate ?? "";
  for (const r of [1, 3, 5]) sheet.getRow(r).font = { bold: true };

  sheet.getRow(5).values = HEADERS;
  for (const trip of trips) {
    sheet.addRow([
      new Date(`${trip.date}T00:00:00Z`),
      trip.number,
      trip.startKm,
      trip.endKm,
      trip.km,
      trip.from,
      trip.to,
      trip.detour ?? "",
      trip.purpose === "business" ? "Zakelijk" : "Privé",
      trip.note ?? "",
    ]);
  }
  sheet.getColumn(1).numFmt = "dd-mm-yyyy";
  [12, 8, 14, 14, 10, 30, 30, 22, 12, 30].forEach((width, i) => (sheet.getColumn(i + 1).width = width));
  sheet.views = [{ state: "frozen", ySplit: 5 }];
}

/** Excel tab names: at most 31 characters, none of \ / ? * [ ] :, and unique. */
function uniqueSheetName(name: string, used: Set<string>): string {
  const base = name.replace(/[\\/?*[\]:]/g, "").trim().slice(0, 27) || "Auto";
  let candidate = base;
  for (let i = 2; used.has(candidate.toLowerCase()); i++) candidate = `${base} (${i})`;
  used.add(candidate.toLowerCase());
  return candidate;
}

function findRow(sheet: Worksheet, maxRow: number, test: (texts: string[]) => boolean | undefined) {
  for (let r = 1; r <= Math.min(maxRow, sheet.rowCount); r++) if (test(rowTexts(sheet, r))) return r;
  return undefined;
}

/** The row's cells as lowercase text, indexed from 0 for column A. */
function rowTexts(sheet: Worksheet, r: number): string[] {
  const texts: string[] = [];
  sheet.getRow(r).eachCell((cell, c) => (texts[c - 1] = text(cell.value).toLowerCase()));
  return texts;
}

/** A formula's cached result, rich text joined, or the value itself. */
function plain(value: CellValue): unknown {
  if (value && typeof value === "object" && !(value instanceof Date)) {
    if ("result" in value) return value.result;
    if ("richText" in value) return value.richText.map((part) => part.text).join("");
    if ("text" in value) return value.text;
  }
  return value;
}

function text(value: CellValue): string {
  const v = plain(value);
  return v === null || v === undefined ? "" : String(v).trim();
}

function number(value: CellValue): number | undefined {
  const v = plain(value);
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return undefined;
}

function isoDate(value: CellValue): string | undefined {
  const v = plain(value);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  // Typed as text: 14-01-2026 or 14-1-2026.
  const match = typeof v === "string" && v.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : undefined;
}

function purpose(value: string): Purpose {
  return /^p/i.test(value) ? "private" : "business";
}
