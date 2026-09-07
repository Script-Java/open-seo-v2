import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { DataForSeoSection } from "@/client/features/settings/integrations/DataForSeoSection";
import { GoogleSection } from "@/client/features/settings/integrations/GoogleSection";
import { OpenRouterSection } from "@/client/features/settings/integrations/OpenRouterSection";
import type { Patch } from "@/client/features/settings/integrations/parts";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { isHostedClientAuthMode } from "@/lib/auth-mode";
import {
  getIntegrationSettings,
  updateIntegrationSettings,
} from "@/serverFunctions/integrationSettings";

export const Route = createFileRoute("/_app/settings/integrations")({
  component: IntegrationSettingsPage,
});

const QUERY_KEY = ["integrationSettings"];

// Self-host operators paste their provider keys here instead of (or on top
// of) environment variables. Each section saves independently; a blank input
// leaves the stored value alone, "Clear" removes it and falls back to env.
function IntegrationSettingsPage() {
  const queryClient = useQueryClient();
  const statusQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => getIntegrationSettings(),
    enabled: !isHostedClientAuthMode(),
  });

  const saveMutation = useMutation({
    mutationFn: (patch: Patch) => updateIntegrationSettings({ data: patch }),
    onSuccess: (status) => {
      queryClient.setQueryData(QUERY_KEY, status);
      // Setup gates (DataForSEO banner, SAM, Search Console) cache their own
      // status checks; a saved key should lift them without a reload.
      void queryClient.invalidateQueries();
      toast.success("Integration settings saved");
    },
    onError: (error) => {
      toast.error(
        getStandardErrorMessage(error, "We couldn't save these settings."),
      );
    },
  });

  if (isHostedClientAuthMode() || statusQuery.data?.manageable === false) {
    return (
      <p className="text-sm text-base-content/60">
        Integration keys are managed by the hosting provider on this deployment.
      </p>
    );
  }

  if (statusQuery.isError) {
    return (
      <p className="text-sm text-error">
        We couldn't load the integration settings.
      </p>
    );
  }

  if (!statusQuery.data) {
    return <div className="skeleton h-40 w-full" />;
  }

  const { settings } = statusQuery.data;
  const save = (patch: Patch) => saveMutation.mutateAsync(patch);

  return (
    <div className="space-y-10">
      <p className="text-sm text-base-content/60">
        Keys saved here are stored in this deployment's own database and take
        effect immediately. They override the matching environment variable;
        clearing one falls back to the environment.
      </p>

      <DataForSeoSection
        status={settings.DATAFORSEO_API_KEY}
        onSave={save}
        isSaving={saveMutation.isPending}
      />
      <OpenRouterSection
        keyStatus={settings.OPENROUTER_API_KEY}
        modelStatus={settings.OPENROUTER_MODEL}
        onSave={save}
        isSaving={saveMutation.isPending}
      />
      <GoogleSection
        settings={settings}
        onSave={save}
        isSaving={saveMutation.isPending}
      />
    </div>
  );
}
