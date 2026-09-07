import { type ReactNode, useState } from "react";
import { CopyButton } from "@/client/features/ai-mcp/SetupControls";
import { GoogleConnectionTest } from "@/client/features/settings/integrations/GoogleConnectionTest";
import {
  FieldStatus,
  type Patch,
  type SaveSettings,
  Section,
  TextInput,
} from "@/client/features/settings/integrations/parts";
import { ProjectGoogleConnections } from "@/client/features/settings/integrations/ProjectGoogleConnections";
import type { IntegrationSettingsStatus } from "@/serverFunctions/integrationSettings";
import { GA4_SELF_HOSTED_SETUP_DOCS_URL } from "@/shared/ga4";
import { GSC_SELF_HOSTED_SETUP_DOCS_URL } from "@/shared/gsc";

const CONSOLE = "https://console.cloud.google.com";

const API_LINKS = [
  { label: "Google Search Console API", id: "searchconsole.googleapis.com" },
  { label: "Google Analytics Admin API", id: "analyticsadmin.googleapis.com" },
  { label: "Google Analytics Data API", id: "analyticsdata.googleapis.com" },
];

// One Google OAuth client serves every project. The steps mirror
// docs/SELF_HOSTING_GOOGLE_SEARCH_CONSOLE.md with this deployment's values
// filled in; the token encryption secret is minted server-side on save.
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const dirty = Boolean(clientId.trim() || clientSecret.trim());
  const configured = Boolean(
    settings.GOOGLE_CLIENT_ID.source &&
    settings.GOOGLE_CLIENT_SECRET.source &&
    settings.BETTER_AUTH_SECRET.source,
  );
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const redirectUris = [
    `${origin}/api/gsc/oauth/callback`,
    `${origin}/api/ga4/oauth/callback`,
  ];

  async function handleSave() {
    const patch: Patch = {};
    if (clientId.trim()) patch.GOOGLE_CLIENT_ID = clientId.trim();
    if (clientSecret.trim()) patch.GOOGLE_CLIENT_SECRET = clientSecret.trim();
    await onSave(patch);
    setClientId("");
    setClientSecret("");
  }

  return (
    <Section
      title="Google Search Console & Analytics"
      description="One Google OAuth client, set up once, lets every project connect its own Search Console and Analytics properties from any Google account. Projects pick the property matching their domain automatically."
      docs={
        <>
          <ExternalLink href={GSC_SELF_HOSTED_SETUP_DOCS_URL}>
            Search Console guide
          </ExternalLink>
          {" · "}
          <ExternalLink href={GA4_SELF_HOSTED_SETUP_DOCS_URL}>
            Analytics guide
          </ExternalLink>
        </>
      }
    >
      <div className="flex items-center gap-2 text-sm">
        <span>Google OAuth client</span>
        {configured ? (
          <span className="badge badge-success badge-sm">Configured</span>
        ) : (
          <span className="badge badge-warning badge-sm">Setup needed</span>
        )}
      </div>

      <ol className="space-y-4 text-sm">
        <Step n={1} title="Create a Google Cloud project (or pick one)">
          <ExternalLink href={`${CONSOLE}/projectcreate`}>
            Create project
          </ExternalLink>
        </Step>
        <Step n={2} title="Enable the three APIs in that project">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {API_LINKS.map((api) => (
              <ExternalLink
                key={api.id}
                href={`${CONSOLE}/apis/library/${api.id}`}
              >
                {api.label}
              </ExternalLink>
            ))}
          </div>
        </Step>
        <Step n={3} title="Set up the consent screen">
          <p className="text-base-content/60">
            Choose <strong>External</strong> and fill in the app name and
            emails. While the app is in Testing, add every Google account you
            will connect as a <strong>test user</strong>, or Google answers{" "}
            <code>access_denied</code>.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <ExternalLink href={`${CONSOLE}/auth/overview`}>
              Consent screen
            </ExternalLink>
            <ExternalLink href={`${CONSOLE}/auth/audience`}>
              Test users
            </ExternalLink>
          </div>
        </Step>
        <Step n={4} title="Create an OAuth client ID (Web application)">
          <p className="text-base-content/60">
            Add both redirect URIs exactly as shown:
          </p>
          {redirectUris.map((uri) => (
            <div key={uri} className="flex items-center gap-2">
              <code className="rounded bg-base-200 px-2 py-1 text-xs">
                {uri}
              </code>
              <CopyButton
                value={uri}
                successMessage="Redirect URI copied"
                iconOnly
              />
            </div>
          ))}
          <ExternalLink href={`${CONSOLE}/auth/clients/create`}>
            Create OAuth client
          </ExternalLink>
        </Step>
        <Step n={5} title="Paste the client ID and secret here">
          <FieldStatus
            label="Client ID"
            status={settings.GOOGLE_CLIENT_ID}
            onClear={() => onSave({ GOOGLE_CLIENT_ID: null })}
            isSaving={isSaving}
            secret={false}
          />
          <TextInput
            label="GOOGLE_CLIENT_ID"
            value={clientId}
            onChange={setClientId}
            placeholder={
              settings.GOOGLE_CLIENT_ID.preview ??
              "….apps.googleusercontent.com"
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
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!dirty || isSaving}
              onClick={() => void handleSave()}
            >
              Save
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => setShowAdvanced((value) => !value)}
            >
              {showAdvanced ? "Hide advanced" : "Advanced"}
            </button>
          </div>
          {showAdvanced ? (
            <AdvancedSecret
              settings={settings}
              onSave={onSave}
              isSaving={isSaving}
            />
          ) : null}
        </Step>
        <Step n={6} title="Authorize a Google account to test it">
          <GoogleConnectionTest enabled={configured} />
        </Step>
      </ol>

      <ProjectGoogleConnections />
    </Section>
  );
}

function AdvancedSecret({
  settings,
  onSave,
  isSaving,
}: {
  settings: IntegrationSettingsStatus["settings"];
  onSave: SaveSettings;
  isSaving: boolean;
}) {
  const [authSecret, setAuthSecret] = useState("");
  return (
    <div className="space-y-2 rounded-lg border border-base-300 p-3">
      <FieldStatus
        label="Token encryption secret"
        status={settings.BETTER_AUTH_SECRET}
        onClear={() => onSave({ BETTER_AUTH_SECRET: null })}
        isSaving={isSaving}
      />
      <TextInput
        label="BETTER_AUTH_SECRET"
        hint="Generated automatically when you save a client. Only set it yourself to reuse an existing one (at least 32 characters). Changing it disconnects existing Google connections."
        value={authSecret}
        onChange={setAuthSecret}
        secret
        trailing={
          <button
            type="button"
            className="btn btn-sm"
            disabled={authSecret.trim().length < 32 || isSaving}
            onClick={() => {
              void onSave({ BETTER_AUTH_SECRET: authSecret.trim() }).then(() =>
                setAuthSecret(""),
              );
            }}
          >
            Save
          </button>
        }
      />
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-base-200 text-xs font-semibold">
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="font-medium">{title}</p>
        {children}
      </div>
    </li>
  );
}

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      className="link link-primary"
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  );
}
