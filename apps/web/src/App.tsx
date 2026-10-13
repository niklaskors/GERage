import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "react-oidc-context";
import type { Config } from "./config";
import { newId, type GerageData } from "./data";
import { Storage, type Snapshot } from "./storage";

export function App({ config }: { config: Config }) {
  const auth = useAuth();

  if (auth.isLoading) return <p className="muted">Loading…</p>;
  if (auth.error) return <p className="error">Login failed: {auth.error.message}</p>;

  if (!auth.isAuthenticated || !auth.user) {
    return (
      <main className="center">
        <h1>GERage</h1>
        <button onClick={() => auth.signinRedirect()}>Sign in</button>
      </main>
    );
  }

  const signOut = async () => {
    await auth.removeUser();
    const params = new URLSearchParams({
      client_id: config.userPoolClientId,
      logout_uri: `${window.location.origin}/`,
    });
    window.location.href = `${config.cognitoDomain}/logout?${params}`;
  };

  return (
    <main>
      <header>
        <h1>GERage</h1>
        <span className="muted">{auth.user.profile.email}</span>
        <button className="link" onClick={signOut}>
          Sign out
        </button>
      </header>
      <Garage config={config} idToken={auth.user.id_token!} />
    </main>
  );
}

function Garage({ config, idToken }: { config: Config; idToken: string }) {
  const [storage, setStorage] = useState<Storage>();
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [selectedCarId, setSelectedCarId] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    Storage.create(config, idToken)
      .then(async (s) => {
        const loaded = await s.load();
        if (cancelled) return;
        setStorage(s);
        setSnapshot(loaded);
      })
      .catch((err: Error) => setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [config, idToken]);

  if (error) return <p className="error">{error}</p>;
  if (!storage || !snapshot) return <p className="muted">Loading your cars…</p>;

  const update = async (change: (data: GerageData) => GerageData) => {
    setSaving(true);
    setError(undefined);
    try {
      setSnapshot(await storage.update(snapshot, change));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const { cars, readings } = snapshot.data;
  const selectedCar = cars.find((c) => c.id === selectedCarId) ?? cars[0];

  return (
    <>
      <section>
        <h2>Cars</h2>
        <ul className="cars">
          {cars.map((car) => (
            <li key={car.id}>
              <button
                className={car.id === selectedCar?.id ? "car selected" : "car"}
                onClick={() => setSelectedCarId(car.id)}
              >
                {car.name}
                {car.plate && <span className="muted"> · {car.plate}</span>}
              </button>
            </li>
          ))}
        </ul>
        <AddCarForm
          disabled={saving}
          onAdd={(name, plate) => {
            const id = newId();
            setSelectedCarId(id);
            return update((d) => ({ ...d, cars: [...d.cars, { id, name, plate: plate || undefined }] }));
          }}
        />
      </section>

      {selectedCar && (
        <section>
          <h2>{selectedCar.name}</h2>
          <AddReadingForm
            disabled={saving}
            onAdd={(date, odometerKm) =>
              update((d) => ({
                ...d,
                readings: [...d.readings, { id: newId(), carId: selectedCar.id, date, odometerKm }],
              }))
            }
          />
          <ReadingsTable
            readings={readings.filter((r) => r.carId === selectedCar.id)}
            disabled={saving}
            onDelete={(id) => update((d) => ({ ...d, readings: d.readings.filter((r) => r.id !== id) }))}
          />
        </section>
      )}
    </>
  );
}

function AddCarForm({ onAdd, disabled }: { onAdd: (name: string, plate: string) => Promise<void>; disabled: boolean }) {
  const [name, setName] = useState("");
  const [plate, setPlate] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await onAdd(name.trim(), plate.trim());
    setName("");
    setPlate("");
  };

  return (
    <form onSubmit={submit}>
      <input placeholder="Name, e.g. Golf" value={name} onChange={(e) => setName(e.target.value)} required />
      <input placeholder="Plate (optional)" value={plate} onChange={(e) => setPlate(e.target.value)} />
      <button disabled={disabled}>Add car</button>
    </form>
  );
}

function AddReadingForm({
  onAdd,
  disabled,
}: {
  onAdd: (date: string, odometerKm: number) => Promise<void>;
  disabled: boolean;
}) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [km, setKm] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await onAdd(date, Number(km));
    setKm("");
  };

  return (
    <form onSubmit={submit}>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      <input
        type="number"
        inputMode="numeric"
        min={0}
        placeholder="Odometer (km)"
        value={km}
        onChange={(e) => setKm(e.target.value)}
        required
      />
      <button disabled={disabled}>Add reading</button>
    </form>
  );
}

function ReadingsTable({
  readings,
  onDelete,
  disabled,
}: {
  readings: GerageData["readings"];
  onDelete: (id: string) => void;
  disabled: boolean;
}) {
  if (readings.length === 0) return <p className="muted">No readings yet.</p>;

  const sorted = [...readings].sort((a, b) => a.date.localeCompare(b.date) || a.odometerKm - b.odometerKm);
  const total = sorted.at(-1)!.odometerKm - sorted[0].odometerKm;

  return (
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th className="num">Odometer</th>
          <th className="num">Driven</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {sorted
          .map((r, i) => ({ ...r, driven: i === 0 ? null : r.odometerKm - sorted[i - 1].odometerKm }))
          .reverse()
          .map((r) => (
            <tr key={r.id}>
              <td>{r.date}</td>
              <td className="num">{r.odometerKm.toLocaleString()} km</td>
              <td className="num">{r.driven === null ? "–" : `${r.driven.toLocaleString()} km`}</td>
              <td>
                <button className="link" disabled={disabled} onClick={() => onDelete(r.id)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
      </tbody>
      <tfoot>
        <tr>
          <td>Total</td>
          <td />
          <td className="num">{total.toLocaleString()} km</td>
          <td />
        </tr>
      </tfoot>
    </table>
  );
}
