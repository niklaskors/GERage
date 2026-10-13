// Writes the deployed stack's config to apps/web/public/config.json for local development.
import { readFileSync, writeFileSync } from "node:fs";

const outputs = JSON.parse(readFileSync(new URL("../cdk-outputs.json", import.meta.url), "utf8")).Gerage;

const config = Object.fromEntries(
  Object.entries(outputs)
    .filter(([key]) => key.startsWith("Config"))
    .map(([key, value]) => [key[6].toLowerCase() + key.slice(7), value]),
);

const target = new URL("../../apps/web/public/config.json", import.meta.url);
writeFileSync(target, JSON.stringify(config, null, 2) + "\n");
console.log(`Wrote ${target.pathname}`);
