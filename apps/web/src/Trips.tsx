import { useId, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { Purpose, Trip } from "./data";
import { findRoute, isPrivatePlaceholder, routesFrom, similarAddress } from "./suggestions";
import type { EditImpact, LoggedTrip, YearTotals } from "./tripLog";

/** The 'verklaring geen privégebruik' allows at most this many private km per calendar year. */
const PRIVATE_KM_LIMIT = 500;

export type TripFields = Omit<Trip, "id" | "carId">;

const today = () => new Date().toISOString().slice(0, 10);

/** Whether the km field takes the km driven or the odometer reading after the trip. */
type KmMode = "driven" | "reading";

const KM_MODE_KEY = "gerage.kmMode";

function storedKmMode(): KmMode {
  try {
    return localStorage.getItem(KM_MODE_KEY) === "reading" ? "reading" : "driven";
  } catch {
    return "driven";
  }
}

/**
 * Adds a trip, or edits `editing`. Either the km driven or the odometer reading after the trip is
 * entered; only the km driven is stored, and the readings follow from `startKm`, where the
 * previous trip ended. Like the spreadsheet, a new trip starts at the
 * previous trip's destination. `history` (all trips, of all cars) is used to suggest destinations
 * and the km for a route driven before, and to warn about likely mistakes.
 */
export function TripForm({
  previous,
  editing,
  startKm,
  addresses,
  history,
  disabled,
  onSave,
  onCancel,
  onDelete,
  impactOf,
}: {
  previous?: LoggedTrip;
  editing?: LoggedTrip;
  startKm: number;
  addresses: string[];
  history: Trip[];
  disabled: boolean;
  /** `returnTrip` is the way back, when "with return trip" is ticked (only for new trips). */
  onSave: (trip: TripFields, returnTrip?: TripFields) => Promise<void>;
  onCancel: () => void;
  /** Only when editing: shows a delete button. */
  onDelete?: () => void;
  /** Only when editing: what the changed date and km do to the readings of other trips. */
  impactOf?: (change: { date: string; km: number }) => EditImpact;
}) {
  const [date, setDate] = useState(editing?.date ?? today());
  const [from, setFrom] = useState(editing?.from ?? previous?.to ?? "");
  const [to, setTo] = useState(editing?.to ?? "");
  const [kmMode, setKmMode] = useState(storedKmMode);
  /** What's typed in the km field: km driven or the reading after the trip, depending on `kmMode`. */
  const [km, setKm] = useState(editing ? String(kmMode === "reading" ? editing.endKm : editing.km) : "");
  /** Until km is typed, it follows the usual km for the route. */
  const [kmTyped, setKmTyped] = useState(Boolean(editing));
  const [purpose, setPurpose] = useState<Purpose>(editing?.purpose ?? previous?.purpose ?? "business");
  const [detour, setDetour] = useState(editing?.detour ?? "");
  const [note, setNote] = useState(editing?.note ?? "");
  const [showMore, setShowMore] = useState(Boolean(editing?.detour || editing?.note));
  const [withReturn, setWithReturn] = useState(false);
  const toInput = useRef<HTMLInputElement>(null);
  const detourInput = useRef<HTMLInputElement>(null);
  const { t, i18n } = useTranslation();
  // Unique, since the edit drawer has a second form on the page.
  const addressList = useId();

  const kmText = (value: number) => t("units.km", { value });
  const dateText = (iso: string) => new Date(iso).toLocaleDateString(i18n.language);

  const otherTrips = history.filter((trip) => trip.id !== editing?.id);
  const destinations = routesFrom(otherTrips, from).slice(0, 4);
  const route = findRoute(otherTrips, from, to);
  // Where this trip starts depends on its date (when editing), not on its own km.
  const tripStartKm = impactOf && date ? impactOf({ date, km: 0 }).startKm : startKm;
  const kmSuggested = !kmTyped && route !== undefined;
  const kmValue = kmSuggested ? String(kmMode === "reading" ? tripStartKm + route.km : route.km) : km;
  const driven = kmMode === "reading" ? Number(kmValue) - tripStartKm : Number(kmValue);
  const fromTypo = similarAddress(from, addresses);
  const toTypo = similarAddress(to, addresses);
  const impact = impactOf && kmValue !== "" && date ? impactOf({ date, km: driven }) : undefined;

  /** Switches what the km field takes, converting what's typed so the trip stays the same. */
  const switchKmMode = () => {
    const next: KmMode = kmMode === "driven" ? "reading" : "driven";
    if (kmTyped && km !== "") setKm(String(next === "reading" ? tripStartKm + driven : driven));
    setKmMode(next);
    try {
      localStorage.setItem(KM_MODE_KEY, next);
    } catch {
      // Not remembered then; the switch still works.
    }
  };
  // A trip normally starts where the previous one ended; shown under "Van" since that's what it's about.
  const previousEnd = !editing && previous?.to && from.trim() !== previous.to && !fromTypo ? previous.to : undefined;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trip = {
      date,
      km: driven,
      from: from.trim(),
      to: to.trim(),
      purpose,
      detour: detour.trim() || undefined,
      note: note.trim() || undefined,
    };
    // The way back: same day, km and type; a detour or note was about the way there.
    const back = withReturn ? { date, km: driven, from: trip.to, to: trip.from, purpose } : undefined;
    await onSave(trip, back);
    if (editing) return;
    // The next trip usually starts where this one ended.
    setFrom(back ? back.to : trip.to);
    setWithReturn(false);
    setTo("");
    setKm("");
    setKmTyped(false);
    setDetour("");
    setNote("");
    setShowMore(false);
    toInput.current?.focus();
  };

  const warnings: { text: string; action?: { label: string; run: () => void } }[] = [];
  if (!editing && previous && date < previous.date) {
    warnings.push({ text: t("trips.hints.dateBeforePrevious", { date: dateText(previous.date) }) });
  }
  if (date > today()) warnings.push({ text: t("trips.hints.dateInFuture") });
  if (route && route.count >= 3 && kmValue !== "" && !detour.trim()) {
    const extra = driven - route.km;
    if (extra >= Math.max(3, route.km * 0.15)) {
      warnings.push({
        text: t("trips.hints.longerThanUsual", { extra: kmText(extra), usual: kmText(route.km) }),
        action: {
          label: t("trips.hints.addDetour"),
          run: () => {
            setShowMore(true);
            setDetour(t("trips.hints.detourKm", { km: kmText(extra) }));
            requestAnimationFrame(() => detourInput.current?.focus());
          },
        },
      });
    }
  }
  if (purpose === "business" && (isPrivatePlaceholder(from) || isPrivatePlaceholder(to))) {
    warnings.push({
      text: t("trips.hints.businessToPrivate"),
      action: { label: t("trips.hints.makePrivate"), run: () => setPurpose("private") },
    });
  }

  return (
    <form className="trip-form" onSubmit={submit}>
      <datalist id={addressList}>
        {addresses.map((a) => (
          <option key={a} value={a} />
        ))}
      </datalist>

      <div className="trip-form-head">
        {/* When editing, the drawer has the title. */}
        {!editing && <h3>{t("trips.form.newTitle")}</h3>}
        <div className="segmented" role="radiogroup" aria-label={t("trips.form.type")}>
          {(["business", "private"] as const).map((p) => (
            <label key={p}>
              <input type="radio" name="purpose" value={p} checked={purpose === p} onChange={() => setPurpose(p)} />
              <span>{t(`purpose.${p}`)}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="trip-form-row route">
        <label>
          {t("trips.form.from")}
          <input list={addressList} value={from} onChange={(e) => setFrom(e.target.value)} />
          {fromTypo && (
            <button type="button" className="hint-button" onClick={() => setFrom(fromTypo)}>
              {t("trips.hints.didYouMean", { address: fromTypo })}
            </button>
          )}
          {previousEnd && (
            <span className="field-note">
              {t("trips.hints.fromNotPreviousTo", { address: previousEnd })}{" "}
              <button type="button" className="hint-button" onClick={() => setFrom(previousEnd)}>
                {t("trips.hints.usePreviousTo")}
              </button>
            </span>
          )}
        </label>
        <button
          type="button"
          className="swap"
          aria-label={t("trips.form.swap")}
          title={t("trips.form.swap")}
          onClick={() => {
            setFrom(to);
            setTo(from);
          }}
        >
          ⇄
        </button>
        <label>
          {t("trips.form.to")}
          <input ref={toInput} list={addressList} value={to} onChange={(e) => setTo(e.target.value)} />
          {toTypo && (
            <button type="button" className="hint-button" onClick={() => setTo(toTypo)}>
              {t("trips.hints.didYouMean", { address: toTypo })}
            </button>
          )}
          {/* Under "Naar", since that's the field they fill in. */}
          {destinations.length > 0 && (
            <span className="destinations" role="group" aria-label={t("trips.hints.frequent", { from: from.trim() })}>
              {destinations.map((d) => (
                <button
                  key={d.to}
                  type="button"
                  aria-pressed={d.to === to.trim()}
                  onClick={() => {
                    setTo(d.to);
                    setPurpose(d.purpose);
                  }}
                >
                  {d.to} <small>{kmText(d.km)}</small>
                </button>
              ))}
            </span>
          )}
        </label>
      </div>

      <div className="trip-form-row odometer">
        <label>
          {t("trips.form.date")}
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          {kmMode === "reading" ? t("trips.form.reading") : t("trips.form.km")}
          <input
            className={kmSuggested ? "suggested" : undefined}
            type="number"
            inputMode="numeric"
            min={kmMode === "reading" ? tripStartKm : 0}
            step={1}
            value={kmValue}
            onChange={(e) => {
              setKm(e.target.value);
              setKmTyped(true);
            }}
            required
          />
          {kmMode === "reading" && kmValue !== "" && driven >= 0 && (
            <small className="hint">{t("trips.hints.drivenFromReading", { km: kmText(driven) })}</small>
          )}
          {kmSuggested && <small className="hint">{t("trips.hints.kmFromRoute")}</small>}
          {kmTyped && route && driven !== route.km && (
            <button type="button" className="hint-button" onClick={() => setKmTyped(false)}>
              {t("trips.hints.usualKm", { km: kmText(route.km) })}
            </button>
          )}
          <button type="button" className="hint-button" onClick={switchKmMode}>
            {kmMode === "reading" ? t("trips.form.enterKm") : t("trips.form.enterReading")}
          </button>
        </label>
      </div>

      <details open={showMore} onToggle={(e) => setShowMore(e.currentTarget.open)}>
        <summary>{t("trips.form.more")}</summary>
        <div className="trip-form-row">
          <label>
            {t("trips.form.detour")}
            <input
              ref={detourInput}
              placeholder={t("trips.form.detourPlaceholder")}
              value={detour}
              onChange={(e) => setDetour(e.target.value)}
            />
          </label>
          <label>
            {t("trips.form.note")}
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>
      </details>

      {impact && (impact.shifted > 0 || impact.currentKm.after !== impact.currentKm.before) && (
        <div className="impact" aria-live="polite">
          {impact.shifted > 0 && (
            <p>
              {impact.shiftKm === undefined
                ? t("trips.impact.reordered", { count: impact.shifted })
                : t(impact.shiftKm > 0 ? "trips.impact.shiftUp" : "trips.impact.shiftDown", {
                    count: impact.shifted,
                    km: kmText(Math.abs(impact.shiftKm)),
                  })}
            </p>
          )}
          {impact.currentKm.after !== impact.currentKm.before && (
            <p>
              {t("trips.impact.current", {
                before: t("units.number", { value: impact.currentKm.before }),
                after: t("units.number", { value: impact.currentKm.after }),
              })}
            </p>
          )}
        </div>
      )}

      {warnings.length > 0 && (
        <ul className="warnings">
          {warnings.map((w) => (
            <li key={w.text}>
              {w.text}
              {w.action && (
                <button type="button" className="link" onClick={w.action.run}>
                  {w.action.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="actions">
        <span className="driven" aria-live="polite">
          {withReturn
            ? t("trips.form.odometerWithReturn", {
                start: t("units.number", { value: tripStartKm }),
                end: kmValue === "" ? "…" : t("units.number", { value: tripStartKm + driven }),
                back: kmValue === "" ? "…" : t("units.number", { value: tripStartKm + 2 * driven }),
              })
            : t("trips.form.odometer", {
                start: t("units.number", { value: tripStartKm }),
                end: kmValue === "" ? "…" : t("units.number", { value: tripStartKm + driven }),
              })}
        </span>
        {!editing && (
          <label className="check">
            <input type="checkbox" checked={withReturn} onChange={(e) => setWithReturn(e.target.checked)} />
            {t("trips.form.withReturn")}
          </label>
        )}
        {onDelete && (
          <button type="button" className="danger" disabled={disabled} onClick={onDelete}>
            {t("trips.table.delete")}
          </button>
        )}
        {editing && (
          <button type="button" className="secondary" onClick={onCancel}>
            {t("trips.form.cancel")}
          </button>
        )}
        <button className="primary" disabled={disabled}>
          {editing ? t("trips.form.save") : withReturn ? t("trips.form.addWithReturn") : t("trips.form.add")}
        </button>
      </div>
    </form>
  );
}

export function TripTable({
  trips,
  disabled,
  onEdit,
  onDelete,
}: {
  trips: LoggedTrip[];
  disabled: boolean;
  onEdit: (trip: Trip) => void;
  onDelete: (trip: Trip) => void;
}) {
  const { t } = useTranslation();
  if (trips.length === 0) return <p className="muted">{t("trips.table.empty")}</p>;

  return (
    <div className="scroll">
      <table className="trip-table">
        <thead>
          <tr>
            <th>{t("trips.table.date")}</th>
            <th className="num">{t("trips.table.number")}</th>
            <th className="num">{t("trips.table.odometer")}</th>
            <th className="num">{t("trips.table.km")}</th>
            <th>{t("trips.table.route")}</th>
            <th>{t("trips.table.type")}</th>
            <th>{t("trips.table.notes")}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {[...trips].reverse().map((t) => (
            <TripRows key={t.id} trip={t} disabled={disabled} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TripRows({
  trip,
  disabled,
  onEdit,
  onDelete,
}: {
  trip: LoggedTrip;
  disabled: boolean;
  onEdit: (trip: Trip) => void;
  onDelete: (trip: Trip) => void;
}) {
  const { t } = useTranslation();
  const km = (value: number) => t("units.km", { value });
  return (
    <>
      <tr>
        <td className="date nowrap">{trip.date}</td>
        <td className="number num">{trip.number}</td>
        <td className="odometer num nowrap">
          {t("units.number", { value: trip.startKm })} – {t("units.number", { value: trip.endKm })}
        </td>
        <td className="km num nowrap">{km(trip.km)}</td>
        <td className="route">
          {/* Van and Naar are optional; a dash marks the one left empty. */}
          {(trip.from || trip.to) && `${trip.from || "–"} → ${trip.to || "–"}`}
          {trip.detour && <div className="muted">{t("trips.table.detour", { detour: trip.detour })}</div>}
        </td>
        <td className="purpose">{t(`purpose.${trip.purpose}`)}</td>
        <td className="note">{trip.note}</td>
        <td className="row-actions">
          <button
            className="icon"
            aria-label={t("trips.table.edit")}
            title={t("trips.table.edit")}
            disabled={disabled}
            onClick={() => onEdit(trip)}
          >
            <PencilIcon />
          </button>
          <button
            className="icon danger"
            aria-label={t("trips.table.delete")}
            title={t("trips.table.delete")}
            disabled={disabled}
            onClick={() => onDelete(trip)}
          >
            <TrashIcon />
          </button>
        </td>
      </tr>
    </>
  );
}

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

export function PencilIcon() {
  return (
    <svg {...iconProps}>
      <path d="M17 3a2.85 2.85 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function YearTotalsTable({ totals }: { totals: YearTotals[] }) {
  const { t } = useTranslation();
  const km = (value: number) => t("units.km", { value });
  if (totals.length === 0) return null;

  return (
    <div className="scroll">
      <table>
        <thead>
          <tr>
            <th>{t("years.year")}</th>
            <th className="num">{t("years.business")}</th>
            <th className="num">{t("years.private")}</th>
          </tr>
        </thead>
        <tbody>
          {totals.map((y) => (
            <tr key={y.year}>
              <td>{y.year}</td>
              <td className="num">{km(y.business)}</td>
              <td className={y.private > PRIVATE_KM_LIMIT ? "num error" : "num"}>{km(y.private)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">{t("years.privateLimit", { limit: PRIVATE_KM_LIMIT })}</p>
    </div>
  );
}
