import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { resetAuthInstance } from "@/lib/auth";
import { Ga4ConnectionRepository } from "@/server/features/ga4/repositories/Ga4ConnectionRepository";
import { GscConnectionRepository } from "@/server/features/gsc/repositories/GscConnectionRepository";
import { ProjectRepository } from "@/server/features/projects/repositories/ProjectRepository";
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

    // Saving a Google client is the moment Search Console becomes possible,
    // and it needs an encryption secret for the stored tokens. Mint one
    // rather than making the operator learn what BETTER_AUTH_SECRET is.
    if (
      (data.GOOGLE_CLIENT_ID || data.GOOGLE_CLIENT_SECRET) &&
      !data.BETTER_AUTH_SECRET &&
      !(await loadIntegrationSettings(env.KV)).BETTER_AUTH_SECRET &&
      !getEnvValueSync(env, "BETTER_AUTH_SECRET")
    ) {
      data.BETTER_AUTH_SECRET = generateEncryptionSecret();
    }

    await saveIntegrationSettings(env.KV, data);
    // Better Auth bakes the Google client + secret in at construction.
    resetAuthInstance();
    return getStatus();
  });

function generateEncryptionSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(36));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

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

type ProjectGoogleConnection = {
  projectId: string;
  name: string;
  domain: string | null;
  searchConsole: { property: string; accountEmail: string | null } | null;
  analytics: { property: string; accountEmail: string | null } | null;
};

// The shared OAuth client serves every project; which Google account and
// property each project uses is chosen per project. This overview shows that
// mapping beside the shared client so the two are not mistaken for one another.
export const getProjectGoogleConnections = createServerFn({ method: "GET" })
  .middleware(requireAuthenticatedContext)
  .handler(async ({ context }): Promise<ProjectGoogleConnection[]> => {
    const [projects, gsc, ga4] = await Promise.all([
      ProjectRepository.listProjects(context.organizationId),
      GscConnectionRepository.listByOrganizationId(context.organizationId),
      Ga4ConnectionRepository.listByOrganizationId(context.organizationId),
    ]);
    const gscByProject = new Map(gsc.map((row) => [row.projectId, row]));
    const ga4ByProject = new Map(ga4.map((row) => [row.projectId, row]));
    return projects.map((project) => {
      const gscRow = gscByProject.get(project.id);
      const ga4Row = ga4ByProject.get(project.id);
      return {
        projectId: project.id,
        name: project.name,
        domain: project.domain,
        searchConsole: gscRow
          ? {
              property: gscRow.siteUrl,
              accountEmail: gscRow.connectedAccountEmail,
            }
          : null,
        analytics: ga4Row
          ? {
              property: ga4Row.propertyDisplayName,
              accountEmail: ga4Row.connectedAccountEmail,
            }
          : null,
      };
    });
  });
