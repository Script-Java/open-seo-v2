import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { SafeExternalLink } from "@/client/components/SafeExternalLink";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/client/components/ui/alert";

export function GoogleOAuthSetupWarning({
  integrationName,
  docsUrl,
}: {
  integrationName: string;
  docsUrl: string;
}) {
  return (
    <Alert variant="warning">
      <AlertTriangle className="size-4" />
      <AlertTitle>Google OAuth client not configured</AlertTitle>
      <AlertDescription>
        <p>
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
      </AlertDescription>
    </Alert>
  );
}
