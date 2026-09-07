import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { SafeExternalLink } from "@/client/components/SafeExternalLink";

export function GoogleOAuthSetupWarning({
  integrationName,
  docsUrl,
}: {
  integrationName: string;
  docsUrl: string;
}) {
  return (
    <div className="alert alert-warning items-start text-sm">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div className="space-y-1">
        <p className="font-medium">Google OAuth client not configured</p>
        <p className="text-base-content/70">
          Add your Google client ID and secret to this OpenSEO deployment before
          connecting {integrationName}.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <Link
            to="/settings/integrations"
            className="font-medium underline underline-offset-2"
          >
            Add credentials in Settings
          </Link>
          <SafeExternalLink
            url={docsUrl}
            label="Open setup guide"
            className="inline-flex items-center gap-1 font-medium underline underline-offset-2"
          />
        </div>
      </div>
    </div>
  );
}
