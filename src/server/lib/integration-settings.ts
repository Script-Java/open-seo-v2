import { z } from "zod";

// Self-host integration settings that operators can manage from Settings →
// Integrations instead of (or on top of) environment variables. Stored as one
// JSON document in the app's KV namespace, which every self-host surface has
// (miniflare on disk in Docker/Railway, a real namespace on Cloudflare). A
// stored value wins over the environment so what the operator typed in the UI
// is what the app uses; clearing it falls back to the env var, if any.
//
// runtime-env.ts is the only reader — every integration key already resolves
// through getOptionalEnvValue / getIntegrationValueSync, so consumers never
// touch this module directly.

export const INTEGRATION_SETTING_KEYS = [
  "DATAFORSEO_API_KEY",
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "BETTER_AUTH_SECRET",
] as const;

export type IntegrationSettingKey = (typeof INTEGRATION_SETTING_KEYS)[number];

// Never echoed back to the client beyond a short suffix preview.
export const SECRET_INTEGRATION_SETTING_KEYS = new Set<IntegrationSettingKey>([
  "DATAFORSEO_API_KEY",
  "OPENROUTER_API_KEY",
  "GOOGLE_CLIENT_SECRET",
  "BETTER_AUTH_SECRET",
]);

type StoredIntegrationSettings = Partial<
  Record<IntegrationSettingKey, string>
>;

// null clears a key (falls back to env); undefined leaves it untouched.
type IntegrationSettingsPatch = Partial<
  Record<IntegrationSettingKey, string | null>
>;

export const INTEGRATION_SETTINGS_STORAGE_KEY = "selfhost:integration-settings";

// Async readers refresh from KV after this; sync readers (Better Auth
// construction, the SAM Durable Object's model hook) see whatever the last
// async read cached, so a change made from the UI reaches other isolates
// within one TTL and this isolate immediately (save updates the cache).
const CACHE_TTL_MS = 15_000;

const storedSettingsSchema = z.record(z.string(), z.string());

// The slice of KVNamespace this module uses (and tests stub).
export type KvLike = {
  get(key: string, type: "json"): Promise<unknown>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
};

/** Narrows an untyped env binding (runtime-env reads env as a record). */
export function isKvLike(value: unknown): value is KvLike {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "get") === "function" &&
    typeof Reflect.get(value, "put") === "function" &&
    typeof Reflect.get(value, "delete") === "function"
  );
}

let cache: { values: StoredIntegrationSettings; expiresAt: number } | null =
  null;
let inflightLoad: Promise<StoredIntegrationSettings> | null = null;

export function isIntegrationSettingKey(
  name: string,
): name is IntegrationSettingKey {
  return (INTEGRATION_SETTING_KEYS as readonly string[]).includes(name);
}

/** Cache-only read for sync callers. Undefined until the first async load. */
export function getCachedIntegrationSetting(
  name: IntegrationSettingKey,
): string | undefined {
  return cache?.values[name];
}

export function invalidateIntegrationSettingsCache(): void {
  cache = null;
  inflightLoad = null;
}

function pickKnownKeys(raw: Record<string, string>): StoredIntegrationSettings {
  const values: StoredIntegrationSettings = {};
  for (const key of INTEGRATION_SETTING_KEYS) {
    const value = raw[key]?.trim();
    if (value) values[key] = value;
  }
  return values;
}

async function readFromKv(kv: KvLike): Promise<StoredIntegrationSettings> {
  const raw = await kv.get(INTEGRATION_SETTINGS_STORAGE_KEY, "json");
  const parsed = storedSettingsSchema.safeParse(raw);
  return parsed.success ? pickKnownKeys(parsed.data) : {};
}

export async function loadIntegrationSettings(
  kv: KvLike | undefined,
): Promise<StoredIntegrationSettings> {
  if (!kv) return {};
  if (cache && cache.expiresAt > Date.now()) return cache.values;
  if (!inflightLoad) {
    inflightLoad = readFromKv(kv)
      .then((values) => {
        cache = { values, expiresAt: Date.now() + CACHE_TTL_MS };
        return values;
      })
      .catch((error: unknown) => {
        // A KV hiccup must not take every integration down: serve the last
        // known values (or nothing) and let the next call retry.
        console.error("integration settings: KV read failed", error);
        return cache?.values ?? {};
      })
      .finally(() => {
        inflightLoad = null;
      });
  }
  return inflightLoad;
}

export async function saveIntegrationSettings(
  kv: KvLike,
  patch: IntegrationSettingsPatch,
): Promise<StoredIntegrationSettings> {
  const next: StoredIntegrationSettings = { ...(await readFromKv(kv)) };
  for (const key of INTEGRATION_SETTING_KEYS) {
    const value = patch[key];
    if (value === undefined) continue;
    const trimmed = value?.trim();
    if (trimmed) {
      next[key] = trimmed;
    } else {
      delete next[key];
    }
  }

  if (Object.keys(next).length === 0) {
    await kv.delete(INTEGRATION_SETTINGS_STORAGE_KEY);
  } else {
    await kv.put(INTEGRATION_SETTINGS_STORAGE_KEY, JSON.stringify(next));
  }
  cache = { values: next, expiresAt: Date.now() + CACHE_TTL_MS };
  return next;
}
