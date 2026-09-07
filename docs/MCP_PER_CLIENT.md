# Using a self-hosted OpenSEO as a per-client MCP server

A single self-hosted OpenSEO can serve many client sites to one consumer, such
as your own application. The unit of isolation is the **project**: one project
per client, each connected to that client's own Search Console property and
Google Analytics property, and every MCP tool call names the project it acts
on. The DataForSEO, OpenRouter, and Google OAuth client keys are shared by the
deployment and never leave it.

## One-time setup

1. Settings → Integrations: enter the DataForSEO key, the OpenRouter key, and
   the Google OAuth client (client ID, secret, and a generated encryption
   secret).
2. Set `OPENSEO_ACCESS_PASSWORD` on the deployment (Railway → Variables). Your
   browser then asks for it once (any username), and `/mcp` requires it as a
   bearer token. Without it, anyone with the URL has admin access.

## Per client

1. Create a project for the client (UI, or the `create_project` MCP tool).
2. Open the project → Settings → Integrations. Connect Search Console and
   Analytics: sign in with whichever Google account has access to that client's
   properties and pick the property. Each project can use a different Google
   account; connecting a new account never affects other projects.
3. Note the project id (`list_projects` returns it, and it is in the project
   URL: `/p/<projectId>/...`).

## Calling from your application

Endpoint: `https://<your-deployment>/mcp` (Streamable HTTP transport).

Headers on every request:

```
Authorization: Bearer <OPENSEO_ACCESS_PASSWORD>
```

Map a client to its project once, then pass `projectId` to every tool:

| Need                       | Tool                                                          |
| -------------------------- | ------------------------------------------------------------- |
| Find or create the project | `list_projects`, `create_project`                             |
| Search Console data        | `get_search_console_performance`, `inspect_urls`              |
| Analytics data             | `get_google_analytics_*`, `get_search_opportunities`          |
| Keyword, domain, backlinks | `research_keywords`, `get_domain_overview`, `get_backlinks_*` |
| Rank tracking              | `create_rank_tracker`, `run_rank_tracker`, `get_rank_tracker` |

Full tool list with schemas: send `tools/list`, or open AI & MCP in the app.

Example with the TypeScript MCP SDK:

```ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const transport = new StreamableHTTPClientTransport(
  new URL("https://<your-deployment>/mcp"),
  {
    requestInit: {
      headers: {
        Authorization: `Bearer ${process.env.OPENSEO_ACCESS_PASSWORD}`,
      },
    },
  },
);
const client = new Client({ name: "my-app", version: "1.0.0" });
await client.connect(transport);

const projects = await client.callTool({
  name: "list_projects",
  arguments: {},
});
const performance = await client.callTool({
  name: "get_search_console_performance",
  arguments: { projectId: "<client project id>" },
});
```

Every tool that spends DataForSEO credits says so in its description; Search
Console and Analytics tools are free.
