import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { CAR_COLORS, carColor, isPreset, newId, type Car, type CarColor, type GerageData } from "./data";
import { ConfirmDialog } from "./ConfirmDialog";
import { ExcelPanel } from "./ExcelPanel";
import { Plate, PlateInput } from "./LicensePlate";
import { paintOf, PixelCar } from "./PixelCar";
import { Link } from "./router";
import { totalsByYear, type LoggedTrip } from "./tripLog";
import { PencilIcon, TrashIcon, YearTotalsTable } from "./Trips";

export type Update = (change: (data: GerageData) => GerageData) => Promise<void>;

/** What every page gets from the loaded data. */
export type PageProps = {
  data: GerageData;
  tripsByCar: Map<string, LoggedTrip[]>;
  saving: boolean;
  update: Update;
};

/** All cars, with the favourite and totals per year. */
export function CarsPage({ data, tripsByCar, saving, update }: PageProps) {
  const { t } = useTranslation();
  const { cars, favouriteCarId } = data;

  const toggleFavourite = (carId: string) =>
    update((d) => ({ ...d, favouriteCarId: d.favouriteCarId === carId ? undefined : carId }));

  const [editingCarId, setEditingCarId] = useState<string>();

  /** Every trip's readings follow from the start reading, so fixing it fixes them all. */
  const saveCar = async (carId: string, details: CarDetails) => {
    await update((d) => ({ ...d, cars: d.cars.map((c) => (c.id === carId ? { ...c, ...details } : c)) }));
    setEditingCarId(undefined);
  };

  const [deletingCarId, setDeletingCarId] = useState<string>();
  const deleting = cars.find((c) => c.id === deletingCarId);

  /** Removes the car with its trips; if it was the favourite, there's no favourite anymore. */
  const deleteCar = async (carId: string) => {
    await update((d) => ({
      ...d,
      cars: d.cars.filter((c) => c.id !== carId),
      trips: d.trips.filter((trip) => trip.carId !== carId),
      favouriteCarId: d.favouriteCarId === carId ? undefined : d.favouriteCarId,
    }));
    setDeletingCarId(undefined);
  };

  const setColor = (carId: string, color: CarColor) =>
    update((d) => ({ ...d, cars: d.cars.map((c) => (c.id === carId ? { ...c, color } : c)) }));

  return (
    <>
      <section>
        <h2>{t("cars.heading")}</h2>
        {cars.length === 0 ? (
          <p className="muted">{t("cars.empty")}</p>
        ) : (
          <>
            <ul className="car-list">
              {cars.map((car, index) => {
                const trips = tripsByCar.get(car.id) ?? [];
                const odometer = trips.at(-1)?.endKm ?? car.startKm;
                const favourite = car.id === favouriteCarId;
                return (
                  <li key={car.id}>
                    <button
                      className={favourite ? "star on" : "star"}
                      aria-pressed={favourite}
                      aria-label={t("cars.favourite")}
                      title={favourite ? t("cars.favourite") : t("cars.makeFavourite")}
                      disabled={saving}
                      onClick={() => toggleFavourite(car.id)}
                    >
                      {favourite ? "★" : "☆"}
                    </button>
                    <ColorPicker
                      color={carColor(car, index)}
                      disabled={saving}
                      onChange={(color) => setColor(car.id, color)}
                    />
                    {car.id === editingCarId ? (
                      <CarForm
                        car={car}
                        disabled={saving}
                        onSave={(details) => saveCar(car.id, details)}
                        onCancel={() => setEditingCarId(undefined)}
                      />
                    ) : (
                      <>
                        <div className="car-info">
                          <div>
                            <strong>{car.name}</strong>
                            {car.plate && <Plate plate={car.plate} />}
                          </div>
                          <div className="muted">
                            {t("cars.tripCount", { count: trips.length })} ·{" "}
                            {t("cars.lastOdometer", { km: t("units.km", { value: odometer }) })} (
                            {t("cars.startKmShort", { km: t("units.km", { value: car.startKm }) })})
                          </div>
                        </div>
                        <button
                          className="icon"
                          aria-label={t("cars.edit")}
                          title={t("cars.edit")}
                          disabled={saving}
                          onClick={() => setEditingCarId(car.id)}
                        >
                          <PencilIcon />
                        </button>
                        <button
                          className="icon danger"
                          aria-label={t("cars.delete")}
                          title={t("cars.delete")}
                          disabled={saving}
                          onClick={() => setDeletingCarId(car.id)}
                        >
                          <TrashIcon />
                        </button>
                        <Link to={`/?car=${car.id}`}>{t("cars.register")}</Link>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="muted">{t("cars.favouriteHint")}</p>
          </>
        )}
        <CarForm
          disabled={saving}
          onSave={(details) => update((d) => ({ ...d, cars: [...d.cars, { id: newId(), ...details }] }))}
        />
      </section>

      {deleting && (
        <ConfirmDialog
          title={t("cars.deleteTitle", { car: deleting.name })}
          confirmLabel={t("cars.deleteConfirm")}
          cancelLabel={t("cars.cancel")}
          disabled={saving}
          onConfirm={() => deleteCar(deleting.id)}
          onCancel={() => setDeletingCarId(undefined)}
        >
          <p className="confirm-subject">
            <strong>{deleting.name}</strong>
            {deleting.plate && <Plate plate={deleting.plate} />}
          </p>
          {(tripsByCar.get(deleting.id)?.length ?? 0) > 0 && (
            <>
              <p className="confirm-warning">
                {t("cars.deleteTrips", { count: tripsByCar.get(deleting.id)!.length })}
              </p>
              <p>{t("cars.deleteExportHint")}</p>
            </>
          )}
          <p className="muted">{t("cars.deleteUndo")}</p>
        </ConfirmDialog>
      )}

      <ExcelPanel data={data} tripsByCar={tripsByCar} saving={saving} update={update} />

      {data.trips.length > 0 && (
        <section>
          <h2>{t("years.heading")}</h2>
          <YearTotalsTable totals={totalsByYear([...tripsByCar.values()].flat())} />
        </section>
      )}
    </>
  );
}

/** The car in its colour; clicking it opens the preset colours plus a picker for any other. */
function ColorPicker({
  color,
  disabled,
  onChange,
}: {
  color: CarColor;
  disabled: boolean;
  onChange: (color: CarColor) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // While dragging in the browser's colour picker the car follows along; it's saved on release.
  const [preview, setPreview] = useState<CarColor>();
  const ref = useRef<HTMLDivElement>(null);
  const customRef = useRef<HTMLInputElement>(null);

  const choose = (c: CarColor) => {
    setOpen(false);
    setPreview(undefined);
    if (c !== color) onChange(c);
  };

  // React's onChange fires on every move; the native change event only once the colour is picked.
  useEffect(() => {
    const input = customRef.current;
    if (!input) return;
    const commit = () => choose(input.value as CarColor);
    input.addEventListener("change", commit);
    return () => input.removeEventListener("change", commit);
  });

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div className="color-picker" ref={ref}>
      <button
        className="car-avatar"
        aria-expanded={open}
        aria-label={t("cars.changeColor")}
        title={t("cars.changeColor")}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        <PixelCar color={preview ?? color} />
      </button>
      {open && (
        <div className="swatches" role="group" aria-label={t("cars.changeColor")}>
          {CAR_COLORS.map((c) => (
            <button
              key={c}
              className="swatch"
              style={{ background: paintOf(c).S }}
              aria-pressed={c === color}
              aria-label={t(`colors.${c}`)}
              title={t(`colors.${c}`)}
              onClick={() => choose(c)}
            />
          ))}
          <label className={isPreset(color) ? "swatch" : "swatch on"} title={t("colors.custom")}>
            <input
              ref={customRef}
              type="color"
              aria-label={t("colors.custom")}
              defaultValue={isPreset(color) ? paintOf(color).S : color}
              onChange={(e) => setPreview(e.target.value as CarColor)}
            />
          </label>
        </div>
      )}
    </div>
  );
}

type CarDetails = Pick<Car, "name" | "plate" | "startKm">;

/** Adds a car, or edits the details of `car`. */
function CarForm({
  car,
  disabled,
  onSave,
  onCancel,
}: {
  car?: Car;
  disabled: boolean;
  onSave: (details: CarDetails) => Promise<void>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(car?.name ?? "");
  const [plate, setPlate] = useState(car?.plate ?? "");
  const [startKm, setStartKm] = useState(car ? String(car.startKm) : "");
  const { t } = useTranslation();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await onSave({ name: name.trim(), plate: plate.trim() || undefined, startKm: Number(startKm) });
    if (car) return;
    setName("");
    setPlate("");
    setStartKm("");
  };

  return (
    <form className={car ? "car-form editing" : "car-form"} onSubmit={submit}>
      <label>
        {t("cars.name")}
        <input
          placeholder={t("cars.namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus={Boolean(car)}
          required
        />
      </label>
      <label>
        {t("cars.plateLabel")}
        <PlateInput value={plate} onChange={setPlate} />
      </label>
      <label title={t("cars.startKmHint")}>
        {t("cars.startKm")}
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={startKm}
          onChange={(e) => setStartKm(e.target.value)}
          required
        />
      </label>
      <div className="actions">
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            {t("cars.cancel")}
          </button>
        )}
        <button className="primary" disabled={disabled}>
          {car ? t("cars.save") : t("cars.add")}
        </button>
      </div>
    </form>
  );
}
