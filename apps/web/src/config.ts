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
  if (!res.ok) throw new Error("Missing config.json. Deploy the infra or run `pnpm run deploy`.");
  return res.json();
}
