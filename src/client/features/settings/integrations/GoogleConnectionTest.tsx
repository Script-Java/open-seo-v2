import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle } from "lucide-react";
import { GoogleGlyph } from "@/client/features/gsc/GoogleGlyph";
import { GoogleLinkErrorAlert } from "@/client/features/integrations/GoogleLinkErrorAlert";
import { startGoogleLink } from "@/client/features/integrations/startGoogleLink";
import { getGa4GrantStatus } from "@/serverFunctions/ga4";
import { getGscGrantStatus } from "@/serverFunctions/gsc";

// Last wizard step: run the real OAuth flow for each product from here, so a
// misconfigured client (redirect URI, consent screen, missing API) fails now
// with Google's own error instead of later on a project page. Authorizing
// here also stores the grant, so projects can pick properties right away.
export function GoogleConnectionTest({ enabled }: { enabled: boolean }) {
  const gsc = useQuery({
    queryKey: ["gscGrantStatus"],
    queryFn: () => getGscGrantStatus(),
    enabled,
  });
  const ga4 = useQuery({
    queryKey: ["ga4GrantStatus"],
    queryFn: () => getGa4GrantStatus(),
    enabled,
  });

  const rows = [
    { provider: "gsc" as const, label: "Search Console", query: gsc },
    { provider: "ga4" as const, label: "Google Analytics", query: ga4 },
  ];

  return (
    <div className="space-y-3">
      <GoogleLinkErrorAlert provider="gsc" />
      <GoogleLinkErrorAlert provider="ga4" />
      {rows.map(({ provider, label, query }) => {
        const authorized = query.data?.connected === true;
        return (
          <div
            key={provider}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-base-300 px-3 py-2"
          >
            <div className="flex items-center gap-2 text-sm">
              {authorized ? (
                <CheckCircle2 className="size-4 text-success" />
              ) : (
                <Circle className="size-4 text-base-content/30" />
              )}
              <span>{label}</span>
              <span className="text-xs text-base-content/50">
                {!enabled
                  ? "Save the client first"
                  : authorized
                    ? "A Google account is authorized"
                    : "Not authorized yet"}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-sm"
              disabled={!enabled}
              onClick={() =>
                void startGoogleLink(provider, window.location.href)
              }
            >
              <GoogleGlyph className="size-4" />
              {authorized
                ? "Authorize another account"
                : "Authorize with Google"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
