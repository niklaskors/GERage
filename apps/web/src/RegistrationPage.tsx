import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { PageProps, Update } from "./CarsPage";
import { Drawer } from "./Drawer";
import { newId, selectedCar, type Car, type GerageData, type Trip } from "./data";
import { Plate } from "./LicensePlate";
import { Link, navigate, useLocation } from "./router";
import { writeWorkbook } from "./excel";
import { download, editImpact, knownAddresses, type LoggedTrip } from "./tripLog";
import { TripForm, TripTable, type TripFields } from "./Trips";

/** Registering trips for one car: the one in the URL, else the favourite, else the first. */
export function RegistrationPage({ data, tripsByCar, saving, update }: PageProps) {
  const { t } = useTranslation();
  const { query } = useLocation();
  const { cars, favouriteCarId } = data;
  const car = selectedCar(data, query.get("car"));

  if (!car) {
    return (
      <section>
        <h2>{t("registration.heading")}</h2>
        <p className="muted">{t("registration.noCars")}</p>
        <Link to="/cars">{t("registration.toCars")}</Link>
      </section>
    );
  }

  return (
    <section>
      <h2>{t("registration.heading")}</h2>
      <div className="car-picker">
        <label>
          {t("registration.car")}
          <select value={car.id} onChange={(e) => navigate(`/?car=${e.target.value}`, { replace: true })}>
            {cars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id === favouriteCarId ? "★ " : ""}
                {c.name}
                {c.plate && ` · ${c.plate}`}
              </option>
            ))}
          </select>
        </label>
        {car.plate && <Plate plate={car.plate} />}
        <Link to="/cars">{t("registration.manageCars")}</Link>
      </div>
      <CarTrips
        key={car.id}
        car={car}
        trips={tripsByCar.get(car.id) ?? []}
        allTrips={data.trips}
        saving={saving}
        update={update}
      />
    </section>
  );
}

function CarTrips({
  car,
  trips,
  allTrips,
  saving,
  update,
}: {
  car: Car;
  trips: LoggedTrip[];
  allTrips: GerageData["trips"];
  saving: boolean;
  update: Update;
}) {
  const { t, i18n } = useTranslation();
  const [editingTripId, setEditingTripId] = useState<string>();
  const editing = trips.find((trip) => trip.id === editingTripId);
  const addresses = knownAddresses(allTrips);

  /** The return trip comes after the trip there: trips on the same day keep the order they were added in. */
  const addTrip = (fields: TripFields, returnTrip?: TripFields) =>
    update((d) => ({
      ...d,
      trips: [
        ...d.trips,
        ...[fields, returnTrip].filter((f) => f !== undefined).map((f) => ({ id: newId(), carId: car.id, ...f })),
      ],
    }));

  const saveEdit = async (fields: TripFields) => {
    if (!editing) return;
    await update((d) => ({ ...d, trips: d.trips.map((trip) => (trip.id === editing.id ? { ...trip, ...fields } : trip)) }));
    setEditingTripId(undefined);
  };

  const deleteTrip = async (trip: Trip) => {
    if (!confirm(t("trips.confirmDelete", { date: trip.date, from: trip.from || "–", to: trip.to || "–" }))) return;
    await update((d) => ({ ...d, trips: d.trips.filter((other) => other.id !== trip.id) }));
    if (trip.id === editingTripId) setEditingTripId(undefined);
  };

  return (
    <>
      <TripForm
        previous={trips.at(-1)}
        startKm={trips.at(-1)?.endKm ?? car.startKm}
        addresses={addresses}
        history={allTrips}
        disabled={saving}
        onSave={addTrip}
        onCancel={() => {}}
      />
      {editing && (
        <Drawer
          title={t("trips.edit")}
          subtitle={t("trips.editSubtitle", {
            number: editing.number,
            date: new Date(`${editing.date}T00:00:00`).toLocaleDateString(i18n.language),
          })}
          onClose={() => setEditingTripId(undefined)}
        >
          <TripForm
            key={editing.id}
            editing={editing}
            startKm={editing.startKm}
            addresses={addresses}
            history={allTrips}
            disabled={saving}
            onSave={saveEdit}
            onCancel={() => setEditingTripId(undefined)}
            onDelete={() => deleteTrip(editing)}
            impactOf={(change) => editImpact(car, trips, editing.id, change)}
          />
        </Drawer>
      )}
      {trips.length > 0 && (
        <button
          className="link export"
          onClick={async () =>
            download(`rittenregistratie-${car.plate || car.name}.xlsx`, await writeWorkbook([{ car, trips }]))
          }
        >
          {t("trips.exportExcel")}
        </button>
      )}
      <TripTable
        trips={trips}
        disabled={saving}
        onEdit={(trip) => setEditingTripId(trip.id)}
        onDelete={deleteTrip}
      />
    </>
  );
}
