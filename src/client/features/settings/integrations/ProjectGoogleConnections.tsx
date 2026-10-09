import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button } from "@/client/components/ui/button";
import { Skeleton } from "@/client/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
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
        <p className="text-sm text-destructive">
          We couldn't load the project connections.
        </p>
      ) : !query.data ? (
        <Skeleton className="h-16 w-full" />
      ) : query.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No projects yet. Create one, then connect its Google properties from
          the project's settings.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Search Console</TableHead>
                <TableHead>Analytics</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.map((project) => (
                <TableRow key={project.projectId}>
                  <TableCell className="max-w-[200px]">
                    <p className="truncate font-medium">{project.name}</p>
                    {project.domain ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {project.domain}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <ConnectionCell connection={project.searchConsole} />
                  </TableCell>
                  <TableCell>
                    <ConnectionCell connection={project.analytics} />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="xs"
                      nativeButton={false}
                      render={
                        <Link
                          to="/p/$projectId/settings/integrations"
                          params={{ projectId: project.projectId }}
                        />
                      }
                    >
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
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
    return <span className="text-xs text-muted-foreground">Not connected</span>;
  }
  return (
    <div className="max-w-[260px]">
      <p className="truncate font-mono text-xs">{connection.property}</p>
      {connection.accountEmail ? (
        <p className="truncate text-xs text-muted-foreground" data-ph-mask>
          {connection.accountEmail}
        </p>
      ) : null}
    </div>
  );
}
