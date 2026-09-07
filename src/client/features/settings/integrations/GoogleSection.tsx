import { useState } from "react";
import { toast } from "sonner";
import { CopyButton } from "@/client/features/ai-mcp/SetupControls";
import {
  FieldStatus,
  type Patch,
  type SaveSettings,
  Section,
  TextInput,
} from "@/client/features/settings/integrations/parts";
import type { IntegrationSettingsStatus } from "@/serverFunctions/integrationSettings";
import { GA4_SELF_HOSTED_SETUP_DOCS_URL } from "@/shared/ga4";
import { GSC_SELF_HOSTED_SETUP_DOCS_URL } from "@/shared/gsc";
import { MIN_BETTER_AUTH_SECRET_LENGTH } from "@/shared/selfhost-checks";

export function GoogleSection({
  settings,
  onSave,
  isSaving,
}: {
  settings: IntegrationSettingsStatus["settings"];
  onSave: SaveSettings;
  isSaving: boolean;
}) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [authSecret, setAuthSecret] = useState("");
  const dirty = Boolean(
    clientId.trim() || clientSecret.trim() || authSecret.trim(),
  );
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const redirectUris = [
    `${origin}/api/gsc/oauth/callback`,
    `${origin}/api/ga4/oauth/callback`,
  ];

  async function handleSave() {
    if (
      authSecret.trim() &&
      authSecret.trim().length < MIN_BETTER_AUTH_SECRET_LENGTH
    ) {
      toast.error(
        `The encryption secret must be at least ${MIN_BETTER_AUTH_SECRET_LENGTH} characters.`,
      );
      return;
    }
    const patch: Patch = {};
    if (clientId.trim()) patch.GOOGLE_CLIENT_ID = clientId.trim();
    if (clientSecret.trim()) patch.GOOGLE_CLIENT_SECRET = clientSecret.trim();
    if (authSecret.trim()) patch.BETTER_AUTH_SECRET = authSecret.trim();
    await onSave(patch);
    setClientId("");
    setClientSecret("");
    setAuthSecret("");
  }

  function generateSecret() {
    const bytes = crypto.getRandomValues(new Uint8Array(36));
    setAuthSecret(
      btoa(String.fromCharCode(...bytes))
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replaceAll("=", ""),
    );
  }

  return (
    <Section
      title="Google Search Console & Analytics"
      description="An OAuth client from Google Cloud lets you connect Search Console and GA4 properties per project."
      docs={
        <>
          <a
            className="link link-primary"
            href={GSC_SELF_HOSTED_SETUP_DOCS_URL}
            target="_blank"
            rel="noreferrer"
          >
            Search Console guide
          </a>
          {" · "}
          <a
            className="link link-primary"
            href={GA4_SELF_HOSTED_SETUP_DOCS_URL}
            target="_blank"
            rel="noreferrer"
          >
            Analytics guide
          </a>
        </>
      }
    >
      <div className="space-y-1 text-sm">
        <p className="text-base-content/60">
          Add these as authorized redirect URIs on the Google OAuth client:
        </p>
        {redirectUris.map((uri) => (
          <div key={uri} className="flex items-center gap-2">
            <code className="rounded bg-base-200 px-2 py-1 text-xs">{uri}</code>
            <CopyButton
              value={uri}
              successMessage="Redirect URI copied"
              iconOnly
            />
          </div>
        ))}
      </div>

      <FieldStatus
        label="Client ID"
        secret={false}
        status={settings.GOOGLE_CLIENT_ID}
        onClear={() => onSave({ GOOGLE_CLIENT_ID: null })}
        isSaving={isSaving}
      />
      <TextInput
        label="GOOGLE_CLIENT_ID"
        value={clientId}
        onChange={setClientId}
        placeholder={
          settings.GOOGLE_CLIENT_ID.preview ?? "….apps.googleusercontent.com"
        }
        autoComplete="off"
      />
      <FieldStatus
        label="Client secret"
        status={settings.GOOGLE_CLIENT_SECRET}
        onClear={() => onSave({ GOOGLE_CLIENT_SECRET: null })}
        isSaving={isSaving}
      />
      <TextInput
        label="GOOGLE_CLIENT_SECRET"
        value={clientSecret}
        onChange={setClientSecret}
        secret
      />
      <FieldStatus
        label="Token encryption secret"
        status={settings.BETTER_AUTH_SECRET}
        onClear={() => onSave({ BETTER_AUTH_SECRET: null })}
        isSaving={isSaving}
      />
      <TextInput
        label="BETTER_AUTH_SECRET"
        hint={`Encrypts stored Google tokens. At least ${MIN_BETTER_AUTH_SECRET_LENGTH} characters; changing it disconnects existing Google connections.`}
        value={authSecret}
        onChange={setAuthSecret}
        secret
        trailing={
          <button type="button" className="btn btn-sm" onClick={generateSecret}>
            Generate
          </button>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!dirty || isSaving}
          onClick={() => void handleSave()}
        >
          Save
        </button>
        <a
          className="btn btn-ghost btn-sm"
          href="https://console.cloud.google.com/apis/credentials"
          target="_blank"
          rel="noreferrer"
        >
          Open Google Cloud credentials
        </a>
      </div>
    </Section>
  );
}
