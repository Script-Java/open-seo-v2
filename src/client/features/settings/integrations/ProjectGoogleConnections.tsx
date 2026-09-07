import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { getProjectGoogleConnections } from "@/serverFunctions/integrationSettings";

// Which Google account + property each project uses, beside the shared OAuth
// client, so the shared client isn't mistaken for "the" connection. Changes
// happen on each project's own Integrations page.
export function ProjectGoogleConnections() {
  const query = useQuery({
    queryKey: ["projectGoogleConnections"],
    queryFn: () => getProjectGoogleConnections(),
  });

  return (
    <div className="space-y-2">
      <p className="text-sm">Per-project connections</p>
      {query.isError ? (
        <p className="text-sm text-error">
          We couldn't load the project connections.
        </p>
      ) : !query.data ? (
        <div className="skeleton h-16 w-full" />
      ) : query.data.length === 0 ? (
        <p className="text-sm text-base-content/60">
          No projects yet. Create one, then connect its Google properties from
          the project's settings.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-base-300">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Project</th>
                <th>Search Console</th>
                <th>Analytics</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {query.data.map((project) => (
                <tr key={project.projectId} className="hover">
                  <td className="max-w-[200px]">
                    <p className="truncate font-medium">{project.name}</p>
                    {project.domain ? (
                      <p className="truncate text-xs text-base-content/60">
                        {project.domain}
                      </p>
                    ) : null}
                  </td>
                  <td>
                    <ConnectionCell connection={project.searchConsole} />
                  </td>
                  <td>
                    <ConnectionCell connection={project.analytics} />
                  </td>
                  <td>
                    <Link
                      to="/p/$projectId/settings/integrations"
                      params={{ projectId: project.projectId }}
                      className="btn btn-ghost btn-xs"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-base-content/50">
        Each project picks its own Google account and property. Use "Connect
        another Google account" on a project's Integrations page to add more
        accounts; existing connections are unaffected.
      </p>
    </div>
  );
}

function ConnectionCell({
  connection,
}: {
  connection: { property: string; accountEmail: string | null } | null;
}) {
  if (!connection) {
    return <span className="text-xs text-base-content/50">Not connected</span>;
  }
  return (
    <div className="max-w-[260px]">
      <p className="truncate font-mono text-xs">{connection.property}</p>
      {connection.accountEmail ? (
        <p className="truncate text-xs text-base-content/60" data-ph-mask>
          {connection.accountEmail}
        </p>
      ) : null}
    </div>
  );
}
