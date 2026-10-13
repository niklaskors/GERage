import i18n from "./i18n";

/** Runtime config, served as /config.json (written by the infra deploy). */
export type Config = {
  region: string;
  userPoolId: string;
  userPoolClientId: string;
  identityPoolId: string;
  cognitoDomain: string;
  dataBucket: string;
};

export async function loadConfig(): Promise<Config> {
  const res = await fetch("/config.json", { cache: "no-store" });
  // Without the file, the Vite dev server answers with index.html instead of a 404.
  if (!res.ok || !res.headers.get("content-type")?.includes("json")) throw new Error(i18n.t("errors.missingConfig"));
  return res.json();
}
