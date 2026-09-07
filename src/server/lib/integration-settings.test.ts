import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  INTEGRATION_SETTINGS_STORAGE_KEY,
  invalidateIntegrationSettingsCache,
  saveIntegrationSettings,
} from "./integration-settings";
import {
  getIntegrationValueSync,
  getOptionalEnvValue,
  primeIntegrationSettings,
} from "./runtime-env";

// A KV namespace stub backed by a Map; only the surface the module touches.
const store = new Map<string, string>();
const kv = {
  get: vi.fn(async (key: string, type?: string) => {
    const raw = store.get(key) ?? null;
    return type === "json" && raw !== null ? (JSON.parse(raw) as unknown) : raw;
  }),
  put: vi.fn(async (key: string, value: string) => {
    store.set(key, value);
  }),
  delete: vi.fn(async (key: string) => {
    store.delete(key);
  }),
};

const workersEnv: Record<string, unknown> = {
  KV: kv,
  AUTH_MODE: "local_noauth",
  OPENROUTER_API_KEY: "env-openrouter-key",
};

vi.mock("cloudflare:workers", () => ({ env: workersEnv }));

beforeEach(() => {
  store.clear();
  invalidateIntegrationSettingsCache();
  workersEnv.AUTH_MODE = "local_noauth";
  delete process.env.OPENROUTER_API_KEY;
});

describe("integration settings", () => {
  it("prefers an app-saved value over the environment", async () => {
    await saveIntegrationSettings(kv, { OPENROUTER_API_KEY: "  app-key  " });

    expect(await getOptionalEnvValue("OPENROUTER_API_KEY")).toBe("app-key");
    expect(getIntegrationValueSync(workersEnv, "OPENROUTER_API_KEY")).toBe(
      "app-key",
    );
  });

  it("falls back to the environment once a value is cleared", async () => {
    await saveIntegrationSettings(kv, { OPENROUTER_API_KEY: "app-key" });
    await saveIntegrationSettings(kv, { OPENROUTER_API_KEY: null });

    expect(store.has(INTEGRATION_SETTINGS_STORAGE_KEY)).toBe(false);
    expect(await getOptionalEnvValue("OPENROUTER_API_KEY")).toBe(
      "env-openrouter-key",
    );
  });

  it("ignores stored values in hosted mode", async () => {
    store.set(
      INTEGRATION_SETTINGS_STORAGE_KEY,
      JSON.stringify({ OPENROUTER_API_KEY: "app-key" }),
    );
    workersEnv.AUTH_MODE = "hosted";

    expect(await getOptionalEnvValue("OPENROUTER_API_KEY")).toBe(
      "env-openrouter-key",
    );
  });

  it("serves sync readers from the cache filled by priming", async () => {
    store.set(
      INTEGRATION_SETTINGS_STORAGE_KEY,
      JSON.stringify({ OPENROUTER_MODEL: "vendor/model" }),
    );

    expect(getIntegrationValueSync(workersEnv, "OPENROUTER_MODEL")).toBe(
      undefined,
    );
    await primeIntegrationSettings();
    expect(getIntegrationValueSync(workersEnv, "OPENROUTER_MODEL")).toBe(
      "vendor/model",
    );
  });
});
