import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  FieldStatus,
  type Patch,
  type SaveSettings,
  Section,
  TextInput,
} from "@/client/features/settings/integrations/parts";
import type { IntegrationSettingStatus } from "@/serverFunctions/integrationSettings";

export function OpenRouterSection({
  keyStatus,
  modelStatus,
  onSave,
  isSaving,
}: {
  keyStatus: IntegrationSettingStatus;
  modelStatus: IntegrationSettingStatus;
  onSave: SaveSettings;
  isSaving: boolean;
}) {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const dirty = Boolean(apiKey.trim() || model.trim());

  async function handleSave() {
    const patch: Patch = {};
    if (apiKey.trim()) patch.OPENROUTER_API_KEY = apiKey.trim();
    if (model.trim()) patch.OPENROUTER_MODEL = model.trim();
    await onSave(patch);
    setApiKey("");
    setModel("");
  }

  return (
    <Section
      title="OpenRouter (AI features)"
      description="Enables SAM, the in-app SEO agent, and the onboarding chat."
      docs={
        <Link className="link link-primary" to="/help/openrouter-api-key">
          Setup guide
        </Link>
      }
    >
      <FieldStatus
        label="API key"
        status={keyStatus}
        onClear={() => onSave({ OPENROUTER_API_KEY: null })}
        isSaving={isSaving}
      />
      <TextInput
        label="OPENROUTER_API_KEY"
        value={apiKey}
        onChange={setApiKey}
        secret
        placeholder="sk-or-…"
      />
      <FieldStatus
        label="Model"
        status={modelStatus}
        onClear={() => onSave({ OPENROUTER_MODEL: null })}
        isSaving={isSaving}
      />
      <TextInput
        label="OPENROUTER_MODEL (optional)"
        hint="OpenRouter model slug. Leave empty for the default."
        value={model}
        onChange={setModel}
        placeholder={modelStatus.preview ?? "openai/gpt-5.6-luna"}
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
          href="https://openrouter.ai/settings/keys"
          target="_blank"
          rel="noreferrer"
        >
          Open OpenRouter keys
        </a>
      </div>
    </Section>
  );
}
