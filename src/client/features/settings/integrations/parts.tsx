import type { ReactNode } from "react";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import type { IntegrationSettingKey } from "@/server/lib/integration-settings";
import type {
  IntegrationSettingsStatus,
  IntegrationSettingStatus,
} from "@/serverFunctions/integrationSettings";

// Shared building blocks for the Settings → Integrations sections.

export type Patch = Partial<Record<IntegrationSettingKey, string | null>>;
export type SaveSettings = (patch: Patch) => Promise<IntegrationSettingsStatus>;

export const LINK_CLASS =
  "font-medium text-primary underline underline-offset-2 hover:no-underline";

export function Section({
  title,
  description,
  docs,
  children,
}: {
  title: string;
  description: string;
  docs: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
        <p className="text-sm">{docs}</p>
      </div>
      {children}
    </section>
  );
}

export function FieldStatus({
  label,
  status,
  onClear,
  isSaving,
  secret = true,
}: {
  label: string;
  status: IntegrationSettingStatus;
  onClear: () => Promise<unknown>;
  isSaving: boolean;
  // Secrets preview as a "…abcd" suffix; non-secrets show the full value.
  secret?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span>{label}</span>
      {status.source === "app" ? (
        <>
          <Badge variant="success">Set in app</Badge>
          {status.preview ? (
            <span
              className="font-mono text-xs text-muted-foreground"
              data-ph-mask
            >
              {secret ? "…" : ""}
              {status.preview}
            </span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="text-destructive"
            disabled={isSaving}
            onClick={() => {
              if (
                window.confirm(
                  `Clear the ${label.toLowerCase()} saved in the app?`,
                )
              ) {
                void onClear();
              }
            }}
          >
            Clear
          </Button>
        </>
      ) : status.source === "env" ? (
        <Badge variant="info">Set by environment variable</Badge>
      ) : (
        <Badge variant="outline">Not set</Badge>
      )}
    </div>
  );
}

export function TextInput({
  label,
  hint,
  value,
  onChange,
  secret = false,
  placeholder,
  autoComplete = "new-password",
  trailing,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  secret?: boolean;
  placeholder?: string;
  autoComplete?: string;
  trailing?: ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <Input
          type={secret ? "password" : "text"}
          className="h-8 font-mono text-sm"
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          spellCheck={false}
          data-ph-mask
          onChange={(event) => onChange(event.currentTarget.value)}
        />
        {trailing}
      </div>
      {hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}
