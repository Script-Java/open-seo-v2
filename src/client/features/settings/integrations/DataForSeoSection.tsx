import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/client/components/ui/tabs";
import {
  FieldStatus,
  LINK_CLASS,
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
        <Link className={LINK_CLASS} to="/help/dataforseo-api-key">
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

      <Tabs
        value={mode}
        onValueChange={(value) =>
          setMode(value === "key" ? "key" : "credentials")
        }
      >
        <TabsList>
          <TabsTrigger value="credentials">
            Login &amp; API password
          </TabsTrigger>
          <TabsTrigger value="key">Base64 key</TabsTrigger>
        </TabsList>
      </Tabs>

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
        <Button
          type="button"
          size="sm"
          disabled={!encodedKey || isSaving}
          onClick={() => void handleSave()}
        >
          Save
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!status.source || verifyMutation.isPending}
          onClick={() => verifyMutation.mutate()}
        >
          {verifyMutation.isPending ? "Verifying…" : "Verify connection"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          nativeButton={false}
          render={
            <a
              href="https://app.dataforseo.com/api-access"
              target="_blank"
              rel="noreferrer"
            />
          }
        >
          Open DataForSEO
        </Button>
      </div>

      {verifyMutation.data ? (
        verifyMutation.data.ok ? (
          <Alert variant="success">
            <CheckCircle2 className="size-4" />
            <AlertDescription>
              Connected
              {verifyMutation.data.login
                ? ` as ${verifyMutation.data.login}`
                : ""}
              {verifyMutation.data.balance !== null
                ? ` · balance $${verifyMutation.data.balance.toFixed(2)}`
                : ""}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="warning">
            <ShieldAlert className="size-4" />
            <AlertDescription>{verifyMutation.data.message}</AlertDescription>
          </Alert>
        )
      ) : null}
    </Section>
  );
}
