import { isPreset, type CarColor, type PresetColor } from "./data";

/**
 * The logo car as a grid of roles, so it can be painted in any colour.
 * O outline · T top · S side · L side stripe · F front · D lower side · K grille,
 * G/g glass · Y/y headlight · R tail light · W tyre · H hub · . transparent.
 */
const GRID = [
  ".............OOOOOO.............",
  "............OTTTTTTO............",
  "...........OTTTTTTFFO...........",
  "..........OTTTTTTGGFFO..........",
  ".........OTTTTTTGGGGFFO.........",
  "........OTTTTTTGGGGGGFFOOOOOO...",
  ".......OSSSSSSTGgGgGgGFFTTTTTO..",
  "......OSgGGSSGSTgGgGgGgFTTTTOFO.",
  ".....OTSGgGSSGGSTGGGGGGTTTTOFFO.",
  "....OTSGGGgSSGGGSTGGGGTTTTOFYFO.",
  "...OTTSGGGGSSGGGGSTGGTTTTOFFyFO.",
  "..OTTSSSSSSSSSSSSSSTTTTTOFFFFFO.",
  ".OSSSSSSSSSSSSSSSSSSSSSOFFFKFKO.",
  "ORSSSSSSSSSSSSSSSSSSSSSSYFKFKO..",
  "ORSSSSSSSSSSSSSSSSSSSSSSyKFKO...",
  "OSSLLLLLLLLLLLLLLLLLLLSSFFKO....",
  "OSSSSSWWSSSSSSSSSSSWWSSSFKO.....",
  "OSSSSWWWWSSSSSSSSSWWWWSSKO......",
  "ODDDWWHHWWDDDDDDDWWHHWWDO.......",
  ".OOOWWHHWWOOOOOOOWWHHWWO........",
  "....OWWWWO.......OWWWWO.........",
  ".....OOOO.........OOOO..........",
];

type Paint = Record<"T" | "L" | "S" | "F" | "D" | "K" | "O", string>;

/** Light to dark: top, stripe, side, front, lower side, grille, outline. */
const paint = (...[T, L, S, F, D, K, O]: string[]): Paint => ({ T, L, S, F, D, K, O });

const PRESETS: Record<PresetColor, Paint> = {
  blue: paint("#7cb8fb", "#3b82f6", "#2563eb", "#1d4ed8", "#1e3a8a", "#172554", "#0b1736"),
  red: paint("#f87171", "#ef4444", "#dc2626", "#b91c1c", "#7f1d1d", "#450a0a", "#2a0606"),
  green: paint("#34d399", "#10b981", "#059669", "#047857", "#064e3b", "#022c22", "#01170f"),
  yellow: paint("#fde68a", "#facc15", "#eab308", "#ca8a04", "#a16207", "#713f12", "#2b1a05"),
  orange: paint("#fdba74", "#fb923c", "#f97316", "#ea580c", "#9a3412", "#431407", "#2a0d04"),
  purple: paint("#a78bfa", "#8b5cf6", "#7c3aed", "#6d28d9", "#4c1d95", "#2e1065", "#1a0a3d"),
  silver: paint("#e5e7eb", "#b6bcc6", "#9ca3af", "#6b7280", "#4b5563", "#1f2937", "#111827"),
  black: paint("#6b7280", "#4b5563", "#374151", "#1f2937", "#111827", "#030712", "#000000"),
  white: paint("#ffffff", "#f3f4f6", "#e5e7eb", "#d1d5db", "#9ca3af", "#4b5563", "#1f2937"),
  teal: paint("#5eead4", "#14b8a6", "#0d9488", "#0f766e", "#134e4a", "#042f2e", "#021a19"),
  sky: paint("#bae6fd", "#7dd3fc", "#38bdf8", "#0ea5e9", "#0369a1", "#0c4a6e", "#082f49"),
  pink: paint("#f9a8d4", "#f472b6", "#ec4899", "#db2777", "#9d174d", "#500724", "#2e0415"),
  lime: paint("#d9f99d", "#a3e635", "#84cc16", "#65a30d", "#3f6212", "#1a2e05", "#111d03"),
  brown: paint("#c08457", "#a16a3e", "#8b5a2b", "#74481f", "#4e2f14", "#2b190a", "#1a0f05"),
  beige: paint("#f5ecd7", "#e8dcc0", "#d6c7a1", "#bfae84", "#8f7f5a", "#4a412c", "#2a2418"),
};

/** Lightness offsets of each part relative to the side, for colours without a preset. */
const SHADES: Record<keyof Paint, number> = { T: 0.2, L: 0.08, S: 0, F: -0.08, D: -0.22, K: -0.35, O: -0.45 };

/** Shades a #rrggbb colour into a paint by moving its lightness, keeping hue and saturation. */
function shadesOf(hex: string): Paint {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const h =
    d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const shade = (offset: number) => {
    const light = Math.min(0.97, Math.max(0.03, l + offset));
    return `hsl(${h * 60} ${s * 100}% ${light * 100}%)`;
  };
  return Object.fromEntries(Object.entries(SHADES).map(([part, offset]) => [part, shade(offset)])) as Paint;
}

export const paintOf = (color: CarColor): Paint => (isPreset(color) ? PRESETS[color] : shadesOf(color));

const FIXED: Record<string, string> = {
  G: "#a5d0fb",
  g: "#dbeafe",
  Y: "#fde047",
  y: "#facc15",
  R: "#ef4444",
  W: "#1f2937",
  H: "#9ca3af",
};

/** One rect per run of the same role in a row. */
function runs(color: CarColor) {
  const fill = { ...FIXED, ...paintOf(color) } as Record<string, string>;
  return GRID.flatMap((row, y) =>
    [...row.matchAll(/([^.])\1*/g)].map((run) => ({ x: run.index, y, width: run[0].length, fill: fill[run[1]] })),
  );
}

const VIEW_BOX = `0 0 ${GRID[0].length} ${GRID.length}`;

export function PixelCar({ color, className }: { color: CarColor; className?: string }) {
  return (
    <svg className={className} viewBox={VIEW_BOX} shapeRendering="crispEdges" aria-hidden="true">
      {runs(color).map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.width} height={1} fill={r.fill} />
      ))}
    </svg>
  );
}

/** Points the browser-tab icon at the car in this colour. */
export function setFavicon(color: CarColor) {
  const rects = runs(color).map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="1" fill="${r.fill}"/>`);
  // Square viewBox so the icon isn't stretched; the car sits in the middle.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -5 32 32" shape-rendering="crispEdges">${rects.join("")}</svg>`;
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (link) link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
