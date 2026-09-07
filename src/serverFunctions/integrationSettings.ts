import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { resetAuthInstance } from "@/lib/auth";
import { fetchUserData } from "@/server/lib/dataforseo/appendix";
import { asAppError, AppError } from "@/server/lib/errors";
import {
  type IntegrationSettingKey,
  invalidateIntegrationSettingsCache,
  loadIntegrationSettings,
  saveIntegrationSettings,
  SECRET_INTEGRATION_SETTING_KEYS,
} from "@/server/lib/integration-settings";
import {
  getEnvValueSync,
  isHostedServerAuthMode,
} from "@/server/lib/runtime-env";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";
import {
  looksLikeDataForSeoKey,
  MIN_BETTER_AUTH_SECRET_LENGTH,
} from "@/shared/selfhost-checks";

// Self-host operators manage integration keys from Settings → Integrations.
// Hosted deployments provision them out of band, so the page is read-only
// there (and never reached: the tab is hidden in hosted builds).

type IntegrationSettingSource = "app" | "env";

export type IntegrationSettingStatus = {
  source: IntegrationSettingSource | null;
  // Secrets: last 4 characters of the app-stored value, for "which key is
  // this?" without exposing it. Non-secrets: the full app-stored value so the
  // form can show/edit it. Env-sourced values are never returned.
  preview: string | null;
};

export type IntegrationSettingsStatus = {
  manageable: boolean;
  settings: Record<IntegrationSettingKey, IntegrationSettingStatus>;
};

const settingValueSchema = z.string().trim().max(4096).nullable().optional();

const patchSchema = z.object({
  DATAFORSEO_API_KEY: settingValueSchema,
  OPENROUTER_API_KEY: settingValueSchema,
  OPENROUTER_MODEL: settingValueSchema,
  GOOGLE_CLIENT_ID: settingValueSchema,
  GOOGLE_CLIENT_SECRET: settingValueSchema,
  BETTER_AUTH_SECRET: settingValueSchema,
});

async function getStatus(): Promise<IntegrationSettingsStatus> {
  const manageable = !(await isHostedServerAuthMode());
  const stored = manageable ? await loadIntegrationSettings(env.KV) : {};

  const statusFor = (key: IntegrationSettingKey): IntegrationSettingStatus => {
    const appValue = stored[key];
    if (appValue) {
      return {
        source: "app",
        preview: SECRET_INTEGRATION_SETTING_KEYS.has(key)
          ? appValue.slice(-4)
          : appValue,
      };
    }
    return {
      source: getEnvValueSync(env, key) ? "env" : null,
      preview: null,
    };
  };
  return {
    manageable,
    settings: {
      DATAFORSEO_API_KEY: statusFor("DATAFORSEO_API_KEY"),
      OPENROUTER_API_KEY: statusFor("OPENROUTER_API_KEY"),
      OPENROUTER_MODEL: statusFor("OPENROUTER_MODEL"),
      GOOGLE_CLIENT_ID: statusFor("GOOGLE_CLIENT_ID"),
      GOOGLE_CLIENT_SECRET: statusFor("GOOGLE_CLIENT_SECRET"),
      BETTER_AUTH_SECRET: statusFor("BETTER_AUTH_SECRET"),
    },
  };
}

export const getIntegrationSettings = createServerFn({ method: "GET" })
  .middleware(requireAuthenticatedContext)
  .handler(() => getStatus());

export const updateIntegrationSettings = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .validator(patchSchema)
  .handler(async ({ data }) => {
    if (await isHostedServerAuthMode()) {
      throw new AppError(
        "FORBIDDEN",
        "Integration settings are managed by the hosting provider.",
      );
    }
    // The form validates these too; this is the trust boundary.
    if (
      data.DATAFORSEO_API_KEY &&
      !looksLikeDataForSeoKey(data.DATAFORSEO_API_KEY)
    ) {
      throw new AppError(
        "VALIDATION_ERROR",
        "DATAFORSEO_API_KEY must be the base64 of login:password.",
      );
    }
    if (
      data.BETTER_AUTH_SECRET &&
      data.BETTER_AUTH_SECRET.length < MIN_BETTER_AUTH_SECRET_LENGTH
    ) {
      throw new AppError(
        "VALIDATION_ERROR",
        `BETTER_AUTH_SECRET must be at least ${MIN_BETTER_AUTH_SECRET_LENGTH} characters.`,
      );
    }

    await saveIntegrationSettings(env.KV, data);
    // Better Auth bakes the Google client + secret in at construction.
    resetAuthInstance();
    return getStatus();
  });

type DataForSeoVerification =
  | { ok: true; login: string | null; balance: number | null }
  | { ok: false; message: string };

// Free, non-billable account read — the cheapest way to prove the key works.
export const verifyDataForSeoKey = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .handler(async (): Promise<DataForSeoVerification> => {
    invalidateIntegrationSettingsCache();
    try {
      const user = await fetchUserData();
      return {
        ok: true,
        login: user?.login ?? null,
        balance: user?.money?.balance ?? null,
      };
    } catch (error) {
      const code = asAppError(error)?.code;
      if (code === "DATAFORSEO_AUTH_FAILED") {
        return {
          ok: false,
          message:
            "DataForSEO rejected the key. Check the login and API password — the API password is different from your account password.",
        };
      }
      if (
        error instanceof Error &&
        error.message.startsWith("Missing required")
      ) {
        return { ok: false, message: "No DataForSEO key is configured yet." };
      }
      console.error("DataForSEO key verification failed", error);
      return {
        ok: false,
        message: "Could not reach DataForSEO. Try again in a moment.",
      };
    }
  });
