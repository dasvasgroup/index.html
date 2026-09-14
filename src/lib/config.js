import { readFileSync, existsSync } from "node:fs";

// Load .env for local runs; in CI (GitHub Actions) the values come from
// repository secrets exposed as real environment variables, so this is a no-op there.
function loadDotEnv() {
  if (!existsSync(".env")) return;
  const lines = readFileSync(".env", "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv();

function required(name) {
  const value = process.env[name];
  if (!value) return null;
  return value;
}

export const config = {
  quickbooks: {
    clientId: required("QBO_CLIENT_ID"),
    clientSecret: required("QBO_CLIENT_SECRET"),
    refreshToken: required("QBO_REFRESH_TOKEN"),
    realmId: required("QBO_REALM_ID"),
    environment: process.env.QBO_ENVIRONMENT || "sandbox",
  },
  servicem8: {
    apiKey: required("SM8_API_KEY"),
  },
  outlook: {
    tenantId: required("MS_TENANT_ID"),
    clientId: required("MS_CLIENT_ID"),
    clientSecret: required("MS_CLIENT_SECRET"),
    refreshToken: required("MS_REFRESH_TOKEN"),
  },
};

export function isConfigured(section) {
  return Object.values(config[section]).every((v) => v !== null && v !== undefined && v !== "");
}
