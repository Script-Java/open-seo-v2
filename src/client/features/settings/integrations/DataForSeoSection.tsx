import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  FieldStatus,
  type SaveSettings,
  Section,
  TextInput,
} from "@/client/features/settings/integrations/parts";
import type { IntegrationSettingStatus } from "@/serverFunctions/integrationSettings";
import { verifyDataForSeoKey } from "@/serverFunctions/integrationSettings";
import { looksLikeDataForSeoKey } from "@/shared/selfhost-checks";

export function DataForSeoSection({
  status,
  onSave,
  isSaving,
}: {
  status: IntegrationSettingStatus;
  onSave: SaveSettings;
  isSaving: boolean;
}) {
  const [mode, setMode] = useState<"credentials" | "key">("credentials");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [key, setKey] = useState("");

  const verifyMutation = useMutation({
    mutationFn: () => verifyDataForSeoKey(),
  });

  const encodedKey =
    mode === "credentials"
      ? login.trim() && password
        ? btoa(`${login.trim()}:${password}`)
        : ""
      : key.trim();

  async function handleSave() {
    if (!encodedKey) return;
    if (!looksLikeDataForSeoKey(encodedKey)) {
      toast.error(
        "That doesn't look like a DataForSEO key: it must be the base64 of login:password.",
      );
      return;
    }
    await onSave({ DATAFORSEO_API_KEY: encodedKey });
    setLogin("");
    setPassword("");
    setKey("");
    verifyMutation.reset();
  }

  return (
    <Section
      title="DataForSEO"
      description="Powers keyword research, domain overview, backlinks, rank tracking and site audits."
      docs={
        <Link className="link link-primary" to="/help/dataforseo-api-key">
          Setup guide
        </Link>
      }
    >
      <FieldStatus
        label="API key"
        status={status}
        onClear={() => onSave({ DATAFORSEO_API_KEY: null })}
        isSaving={isSaving}
      />

      <div role="tablist" className="tabs tabs-box tabs-sm w-fit">
        <button
          type="button"
          role="tab"
          className={`tab ${mode === "credentials" ? "tab-active" : ""}`}
          onClick={() => setMode("credentials")}
        >
          Login &amp; API password
        </button>
        <button
          type="button"
          role="tab"
          className={`tab ${mode === "key" ? "tab-active" : ""}`}
          onClick={() => setMode("key")}
        >
          Base64 key
        </button>
      </div>

      {mode === "credentials" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput
            label="DataForSEO login (email)"
            value={login}
            onChange={setLogin}
            autoComplete="off"
          />
          <TextInput
            label="API password"
            hint="From DataForSEO dashboard → API Access. Not your account password."
            value={password}
            onChange={setPassword}
            secret
          />
        </div>
      ) : (
        <TextInput
          label="DATAFORSEO_API_KEY"
          hint="base64 of login:password"
          value={key}
          onChange={setKey}
          secret
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!encodedKey || isSaving}
          onClick={() => void handleSave()}
        >
          Save
        </button>
        <button
          type="button"
          className="btn btn-sm"
          disabled={!status.source || verifyMutation.isPending}
          onClick={() => verifyMutation.mutate()}
        >
          {verifyMutation.isPending ? "Verifying…" : "Verify connection"}
        </button>
        <a
          className="btn btn-ghost btn-sm"
          href="https://app.dataforseo.com/api-access"
          target="_blank"
          rel="noreferrer"
        >
          Open DataForSEO
        </a>
      </div>

      {verifyMutation.data ? (
        verifyMutation.data.ok ? (
          <div className="alert alert-success text-sm">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>
              Connected
              {verifyMutation.data.login
                ? ` as ${verifyMutation.data.login}`
                : ""}
              {verifyMutation.data.balance !== null
                ? ` · balance $${verifyMutation.data.balance.toFixed(2)}`
                : ""}
            </span>
          </div>
        ) : (
          <div className="alert alert-warning text-sm">
            <ShieldAlert className="size-4 shrink-0" />
            <span>{verifyMutation.data.message}</span>
          </div>
        )
      ) : null}
    </Section>
  );
}
