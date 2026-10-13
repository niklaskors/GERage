import { readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type * as cognito from "aws-cdk-lib/aws-cognito";

/**
 * Styling of the Cognito managed login pages, so they match the app's own sign-in card.
 * Colours mirror the tokens in apps/web/src/styles.css, as 8-digit hex (rrggbbaa) without '#'.
 * Cognito merges this with its defaults, so only what differs from them is listed.
 */
const light = {
  bg: "fafafaff",
  surface: "ffffffff",
  fg: "1a1a1aff",
  muted: "6b6b6bff",
  border: "ddddddff",
  accent: "2563ebff",
  accentHover: "1d4ed8ff",
  accentActive: "1e40afff",
  onAccent: "ffffffff",
  error: "b91c1cff",
  errorBg: "fef2f2ff",
};

const dark = {
  bg: "161616ff",
  surface: "262626ff",
  fg: "eeeeeeff",
  muted: "999999ff",
  border: "333333ff",
  accent: "60a5faff",
  accentHover: "93c5fdff",
  accentActive: "3b82f6ff",
  // Dark text on the light blue reads better than white.
  onAccent: "0b1736ff",
  error: "f87171ff",
  errorBg: "2a1414ff",
};

const both = <T>(make: (c: typeof light) => T) => ({ lightMode: make(light), darkMode: make(dark) });

export const loginBrandingSettings = {
  categories: {
    auth: {
      authMethodOrder: [[{ display: "INPUT", type: "USERNAME_PASSWORD" }]],
      federation: { interfaceStyle: "BUTTON_LIST", order: [] },
    },
    form: {
      displayGraphics: true,
      instructions: { enabled: false },
      languageSelector: { enabled: false },
      location: { horizontal: "CENTER", vertical: "CENTER" },
      sessionTimerDisplay: "NONE",
    },
    global: {
      // Follows the browser's light or dark preference, like the app.
      colorSchemeMode: "DYNAMIC",
      pageHeader: { enabled: false },
      pageFooter: { enabled: false },
      spacingDensity: "REGULAR",
    },
  },
  componentClasses: {
    buttons: { borderRadius: 10.0 },
    divider: both((c) => ({ borderColor: c.border })),
    focusState: both((c) => ({ borderColor: c.accent })),
    input: {
      borderRadius: 8.0,
      ...both((c) => ({ defaults: { backgroundColor: c.surface, borderColor: c.border }, placeholderColor: c.muted })),
    },
    inputDescription: both((c) => ({ textColor: c.muted })),
    inputLabel: both((c) => ({ textColor: c.fg })),
    link: both((c) => ({ defaults: { textColor: c.accent }, hover: { textColor: c.accentHover } })),
    optionControls: both((c) => ({
      defaults: { backgroundColor: c.surface, borderColor: c.border },
      selected: { backgroundColor: c.accent, foregroundColor: c.onAccent },
    })),
    statusIndicator: both((c) => ({
      error: { backgroundColor: c.errorBg, borderColor: c.error, indicatorColor: c.error },
    })),
  },
  components: {
    alert: {
      borderRadius: 8.0,
      ...both((c) => ({ error: { backgroundColor: c.errorBg, borderColor: c.error } })),
    },
    favicon: { enabledTypes: ["SVG"] },
    form: {
      backgroundImage: { enabled: false },
      borderRadius: 16.0,
      ...both((c) => ({ backgroundColor: c.surface, borderColor: c.border })),
      logo: { enabled: true, formInclusion: "IN", location: "CENTER", position: "TOP" },
    },
    pageBackground: {
      image: { enabled: false },
      ...both((c) => ({ color: c.bg })),
    },
    pageText: both((c) => ({ headingColor: c.fg, bodyColor: c.fg, descriptionColor: c.muted })),
    primaryButton: both((c) => ({
      defaults: { backgroundColor: c.accent, textColor: c.onAccent },
      hover: { backgroundColor: c.accentHover, textColor: c.onAccent },
      active: { backgroundColor: c.accentActive, textColor: c.onAccent },
    })),
    secondaryButton: both((c) => ({
      defaults: { backgroundColor: c.surface, borderColor: c.accent, textColor: c.accent },
      hover: { backgroundColor: c.bg, borderColor: c.accentHover, textColor: c.accentHover },
      active: { backgroundColor: c.bg, borderColor: c.accentActive, textColor: c.accentActive },
    })),
  },
};

/** The app's pixel car, as the logo above the form and as the tab icon, in both colour modes. */
export function loginBrandingAssets(): cognito.CfnManagedLoginBranding.AssetTypeProperty[] {
  const logo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../apps/web/public/logo.svg");
  const bytes = readFileSync(logo).toString("base64");
  return ["FORM_LOGO", "FAVICON_SVG"].flatMap((category) =>
    ["LIGHT", "DARK"].map((colorMode) => ({ category, colorMode, extension: "SVG", bytes })),
  );
}
