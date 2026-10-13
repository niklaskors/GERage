import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Update } from "./CarsPage";
import { newId, type Car, type GerageData } from "./data";
import { readWorkbook, writeWorkbook, type ImportedCar } from "./excel";
import { Plate } from "./LicensePlate";
import { download, type LoggedTrip } from "./tripLog";

/** Import from and export to the rittenregistratie Excel file, all cars at once. */
export function ExcelPanel({
  data,
  tripsByCar,
  saving,
  update,
}: {
  data: GerageData;
  tripsByCar: Map<string, LoggedTrip[]>;
  saving: boolean;
  update: Update;
}) {
  const { t, i18n } = useTranslation();
  const dateText = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(i18n.language, { day: "2-digit", month: "2-digit", year: "numeric" });
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();
  const [preview, setPreview] = useState<{ file: string; cars: ImportedCar[]; selected: Set<string> }>();

  const read = async (file: File) => {
    setBusy(true);
    setError(undefined);
    setDone(undefined);
    try {
      const cars = await readWorkbook(file);
      if (cars.length === 0) setError(t("excel.nothingFound"));
      // Tabs with a single trip are usually copies or tryouts.
      else setPreview({ file: file.name, cars, selected: new Set(cars.filter((c) => c.trips.length > 1).map((c) => c.sheet)) });
    } catch (err) {
      setError(t("excel.readFailed", { message: (err as Error).message }));
    } finally {
      setBusy(false);
    }
  };

  const importSelected = async () => {
    if (!preview) return;
    const chosen = preview.cars.filter((c) => preview.selected.has(c.sheet));
    await update((d) => chosen.reduce(importCar, d));
    setDone(t("excel.done", { cars: chosen.length, trips: chosen.reduce((n, c) => n + c.trips.length, 0) }));
    setPreview(undefined);
  };

  const exportAll = async () => {
    setBusy(true);
    try {
      const cars = data.cars.map((car) => ({ car, trips: tripsByCar.get(car.id) ?? [] }));
      download("rittenregistratie.xlsx", await writeWorkbook(cars));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (sheet: string) =>
    setPreview((p) => {
      if (!p) return p;
      const selected = new Set(p.selected);
      if (!selected.delete(sheet)) selected.add(sheet);
      return { ...p, selected };
    });

  return (
    <section>
      <h2>{t("excel.heading")}</h2>
      <p className="muted">{t("excel.intro")}</p>
      <div className="excel-actions">
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void read(file);
          }}
        />
        <button className="secondary" disabled={busy || saving} onClick={() => fileInput.current?.click()}>
          {t("excel.import")}
        </button>
        {data.cars.length > 0 && (
          <button className="secondary" disabled={busy} onClick={exportAll}>
            {t("excel.export")}
          </button>
        )}
        {busy && <span className="muted">{t("excel.busy")}</span>}
      </div>
      {error && <p className="error">{error}</p>}
      {done && <p className="success">{done}</p>}

      {preview && (
        <div className="import-preview">
          <h3>{t("excel.previewTitle", { file: preview.file })}</h3>
          <ul>
            {preview.cars.map((c) => {
              const existing = findExisting(data.cars, c);
              const selected = preview.selected.has(c.sheet);
              return (
                <li key={c.sheet} className={selected ? undefined : "off"}>
                  <label className="import-car">
                    <input type="checkbox" checked={selected} onChange={() => toggle(c.sheet)} />
                    <span className="import-car-title">
                      <strong>{c.name}</strong>
                      {c.plate && <Plate plate={c.plate} />}
                      <span className="chip">{t("excel.tab", { sheet: c.sheet })}</span>
                    </span>
                    <span className="import-car-meta">
                      {t("cars.tripCount", { count: c.trips.length })} · {dateText(c.trips[0].date)} –{" "}
                      {dateText(c.trips.at(-1)!.date)} · {t("cars.startKmShort", { km: t("units.km", { value: c.startKm }) })}
                    </span>
                    {existing && (
                      <span className="import-car-replaces">{t("excel.replaces", { car: existing.name })}</span>
                    )}
                  </label>
                  {c.fixes.length > 0 && (
                    <details className="import-fixes">
                      <summary>{t("excel.fixes", { count: c.fixes.length })}</summary>
                      <ul>
                        {c.fixes.map((f) => (
                          <li key={`${f.kind}-${f.row}`}>
                            {f.kind === "date"
                              ? t("excel.fixDate", { row: f.row, from: dateText(f.from), to: dateText(f.to) })
                              : t("excel.fixGap", { row: f.row, km: t("units.km", { value: f.km }) })}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="excel-actions">
            <button disabled={saving || preview.selected.size === 0} onClick={importSelected}>
              {t("excel.confirm", { count: preview.selected.size })}
            </button>
            <button className="secondary" onClick={() => setPreview(undefined)}>
              {t("trips.form.cancel")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/** The same car: same plate, or same name when the sheet has no plate. */
function findExisting(cars: Car[], imported: ImportedCar): Car | undefined {
  return imported.plate
    ? cars.find((c) => c.plate === imported.plate)
    : cars.find((c) => c.name.toLowerCase() === imported.name.toLowerCase());
}

/** Adds the car, or replaces the trips and start reading of the car it matches. */
function importCar(data: GerageData, imported: ImportedCar): GerageData {
  const existing = findExisting(data.cars, imported);
  const car: Car = existing
    ? { ...existing, plate: existing.plate || imported.plate, startKm: imported.startKm }
    : { id: newId(), name: imported.name, plate: imported.plate || undefined, startKm: imported.startKm };
  const trips = imported.trips.map((trip) => ({ ...trip, id: newId(), carId: car.id }));
  return {
    ...data,
    cars: existing ? data.cars.map((c) => (c.id === car.id ? car : c)) : [...data.cars, car],
    trips: [...data.trips.filter((trip) => trip.carId !== car.id), ...trips],
  };
}
