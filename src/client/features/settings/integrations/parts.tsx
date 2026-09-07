import type { ReactNode } from "react";
import type { IntegrationSettingKey } from "@/server/lib/integration-settings";
import type {
  IntegrationSettingsStatus,
  IntegrationSettingStatus,
} from "@/serverFunctions/integrationSettings";

// Shared building blocks for the Settings → Integrations sections.

export type Patch = Partial<Record<IntegrationSettingKey, string | null>>;
export type SaveSettings = (patch: Patch) => Promise<IntegrationSettingsStatus>;

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
      <div>
        <h2 className="text-sm font-medium text-base-content/50">{title}</h2>
        <p className="mt-1 text-sm text-base-content/60">{description}</p>
        <p className="mt-1 text-sm">{docs}</p>
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
}: {
  label: string;
  status: IntegrationSettingStatus;
  onClear: () => Promise<unknown>;
  isSaving: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span>{label}</span>
      {status.source === "app" ? (
        <>
          <span className="badge badge-success badge-sm">Set in app</span>
          {status.preview ? (
            <span
              className="font-mono text-xs text-base-content/60"
              data-ph-mask
            >
              …{status.preview}
            </span>
          ) : null}
          <button
            type="button"
            className="btn btn-ghost btn-xs text-error"
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
          </button>
        </>
      ) : status.source === "env" ? (
        <span className="badge badge-info badge-sm">
          Set by environment variable
        </span>
      ) : (
        <span className="badge badge-ghost badge-sm">Not set</span>
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
      <span className="text-xs font-medium text-base-content/70">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type={secret ? "password" : "text"}
          className="input input-sm w-full font-mono"
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
        <span className="text-xs text-base-content/50">{hint}</span>
      ) : null}
    </label>
  );
}
