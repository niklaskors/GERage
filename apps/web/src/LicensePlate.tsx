import { useTranslation } from "react-i18next";

/**
 * Dutch license plates: 6 letters and digits in one of the official "sidecodes",
 * written in 3 groups with dashes, e.g. HPN-81-Z or 12-AB-34.
 */
const SIDECODES = [
  "XX-99-99",
  "99-99-XX",
  "99-XX-99",
  "XX-99-XX",
  "XX-XX-99",
  "99-XX-XX",
  "99-XXX-9",
  "9-XXX-99",
  "XX-999-X",
  "X-999-XX",
  "XXX-99-X",
  "X-99-XXX",
  "9-XX-999",
  "999-XX-9",
];

/** For the input's `pattern`: any sidecode, X = letter, 9 = digit. */
const PLATE_PATTERN = SIDECODES.map((code) => code.replaceAll("X", "[A-Z]").replaceAll("9", "[0-9]")).join("|");

/**
 * Formats what's typed so far: uppercase, at most 6 letters and digits, a dash where letters
 * and digits meet, and a group of 4 split in 2 + 2 (AB1234 → AB-12-34).
 */
export function formatPlate(input: string): string {
  const chars = input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  const groups = chars.match(/[A-Z]+|[0-9]+/g) ?? [];
  return groups.flatMap((g) => (g.length === 4 ? [g.slice(0, 2), g.slice(2)] : [g])).join("-");
}

export function PlateInput({ value, onChange }: { value: string; onChange: (plate: string) => void }) {
  const { t } = useTranslation();
  return (
    <span className="plate plate-input">
      <EuStrip />
      <input
        aria-label={t("cars.plateLabel")}
        placeholder="AB-123-C"
        value={value}
        onChange={(e) => onChange(formatPlate(e.target.value))}
        pattern={PLATE_PATTERN}
        title={t("cars.plateTitle")}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
      />
    </span>
  );
}

export function Plate({ plate }: { plate: string }) {
  return (
    <span className="plate">
      <EuStrip />
      <span className="plate-text">{plate}</span>
    </span>
  );
}

function EuStrip() {
  return (
    <span className="plate-eu" aria-hidden="true">
      <svg viewBox="-10 -10 20 20">
        {Array.from({ length: 12 }, (_, i) => (
          <circle
            key={i}
            cx={6 * Math.sin((i * Math.PI) / 6)}
            cy={-6 * Math.cos((i * Math.PI) / 6)}
            r={1.1}
            fill="#ffcc00"
          />
        ))}
      </svg>
      NL
    </span>
  );
}
