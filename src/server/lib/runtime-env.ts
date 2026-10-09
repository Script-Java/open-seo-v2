import { isHostedAuthMode } from "@/lib/auth-mode";
import {
  getCachedIntegrationSetting,
  isIntegrationSettingKey,
  isKvLike,
  type KvLike,
  loadIntegrationSettings,
} from "@/server/lib/integration-settings";

let workersEnvPromise: Promise<Record<string, unknown> | null> | null = null;

/**
 * Resolution order: a value the operator saved in Settings → Integrations
 * (self-host modes only, see integration-settings.ts), then process.env, then
 * the Workers env binding. Empty strings never count as set.
 */
export async function getOptionalEnvValue(
  name: string,
): Promise<string | undefined> {
  const env = (await getWorkersEnv()) ?? {};
  if (integrationSettingsEnabled(env)) {
    // Every async read refreshes the app-managed settings (one cached KV
    // get), so the sync readers below see a value saved in Settings →
    // Integrations by the time a request or agent turn reaches them.
    const stored = await loadIntegrationSettings(getKv(env));
    if (isIntegrationSettingKey(name) && stored[name]) return stored[name];
  }
  return getEnvValueSync(env, name);
}

/**
 * Sync variant for callers that already hold an env record (e.g. a Durable
 * Object's `this.env`, needed because Think's `getModel()` hook is sync).
 * Same policy as the async form: an integration key saved in Settings →
 * Integrations (from the cache the last async read filled), then
 * process.env (where local `.env.local` secrets land in dev), skipping empty
 * strings, then the given env.
 */
export function getEnvValueSync(
  // `object` so interface-typed envs (e.g. Cloudflare.Env) are accepted
  // without a cast.
  env: object,
  name: string,
): string | undefined {
  if (isIntegrationSettingKey(name) && integrationSettingsEnabled(env)) {
    const stored = getCachedIntegrationSetting(name);
    if (stored) return stored;
  }
  const processValue =
    typeof process !== "undefined" ? process.env?.[name] : undefined;
  if (processValue) {
    return processValue;
  }
  const value: unknown = Reflect.get(env, name);
  return typeof value === "string" && value !== "" ? value : undefined;
}

/**
 * Alias of getEnvValueSync kept for sync-only spots that name the intent
 * (Better Auth construction): an integration key honours app-managed settings
 * from the cache the last async read (or `primeIntegrationSettings`) filled.
 */
export const getIntegrationValueSync = getEnvValueSync;

/** Warm the app-managed settings cache so getIntegrationValueSync is current. */
export async function primeIntegrationSettings(): Promise<void> {
  const env = await getWorkersEnv();
  if (env && integrationSettingsEnabled(env)) {
    await loadIntegrationSettings(getKv(env));
  }
}

export async function getRequiredEnvValue(name: string): Promise<string> {
  const value = await getOptionalEnvValue(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export async function isHostedServerAuthMode(): Promise<boolean> {
  return isHostedAuthMode(await getOptionalEnvValue("AUTH_MODE"));
}

// Hosted deployments provision every integration key themselves; the in-app
// settings exist for self-hosters.
function integrationSettingsEnabled(env: object): boolean {
  return !isHostedAuthMode(getEnvValueSync(env, "AUTH_MODE"));
}

function getKv(env: object): KvLike | undefined {
  const kv: unknown = Reflect.get(env, "KV");
  return isKvLike(kv) ? kv : undefined;
}

async function getWorkersEnv(): Promise<Record<string, unknown> | null> {
  if (!workersEnvPromise) {
    workersEnvPromise = loadWorkersEnv();
  }
  return workersEnvPromise;
}

async function loadWorkersEnv(): Promise<Record<string, unknown> | null> {
  try {
    const workersModule = await import("cloudflare:workers");
    return isRecord(workersModule.env) ? workersModule.env : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
