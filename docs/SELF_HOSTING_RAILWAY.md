# Railway Self-Hosting

Run OpenSEO on [Railway](https://railway.com) from this repository. Railway builds the same image as Docker self-hosting (`Dockerfile.selfhost`) because the checked-in `railway.json` points its builder at that file. Without it, Railway auto-detects a Node project, runs `pnpm run build` for a Cloudflare Worker target, and then fails to start because there is no `start` script.

Like Docker mode, this runs with `AUTH_MODE=local_noauth` (no auth checks, local admin user `admin@localhost`). Railway gives the service a public URL, so put it behind your own auth (a private network, Cloudflare Access, or Railway's own access controls) before sharing it.

## Prerequisites

- A Railway account with enough memory for the boot-time build (see [Memory](#memory))
- A DataForSEO API key (see [`DATAFORSEO_API_KEY.md`](./DATAFORSEO_API_KEY.md))

## Deploy

1. In Railway, create a new project from this GitHub repository (or your fork). `railway.json` selects the Dockerfile build and the `/api/health` healthcheck automatically.
2. Open the service's **Variables** tab and add:

   | Variable             | Value                                                                                                                  |
   | -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
   | `AUTH_MODE`          | `local_noauth` (required; the default `cloudflare_access` mode fails preflight without `TEAM_DOMAIN` and `POLICY_AUD`) |
   | `DATAFORSEO_API_KEY` | base64 of `email:password`, per [`DATAFORSEO_API_KEY.md`](./DATAFORSEO_API_KEY.md)                                     |
   | `OPENROUTER_API_KEY` | optional, enables AI features such as SAM                                                                              |
   | `VITE_SHOW_DEVTOOLS` | `false`                                                                                                                |

3. Add a **Volume** to the service mounted at `/app/.wrangler`. This holds the SQLite database, KV, and R2 state. Without it every redeploy starts from an empty database.
4. Under **Settings → Networking**, generate a public domain. The app allows Railway's generated hostname and its healthcheck hostname (`healthcheck.railway.app`) automatically. If you attach a custom domain, also set `ALLOWED_HOST` to that hostname.
5. Deploy. The first start runs preflight, applies migrations, and builds the app inside the container, which takes several minutes. `railway.json` extends the healthcheck timeout to 15 minutes to cover this. Follow progress with `railway logs` or the deployment log in the dashboard.

## Memory

The container builds the app at start with a 4 GB Node heap ceiling (see `.npmrc`). If the deploy log stops during `Building client + server...` and the container restarts, the service ran out of memory. Raise the service's memory limit in **Settings → Resources**; plans that cap a service below roughly 4 GB cannot run this image.

## Troubleshooting

- **Preflight fails with `cloudflare_access requires TEAM_DOMAIN and POLICY_AUD`**: set `AUTH_MODE=local_noauth` as above and redeploy.
- **`Blocked request. This host ("...") is not allowed`**: the request came through a hostname that is neither Railway's generated domain nor `ALLOWED_HOST`. Set `ALLOWED_HOST` to that hostname.
- **Healthcheck fails**: `/api/health` returns 200 once the app is serving, even with warnings. If it never becomes healthy, read the deployment log for the preflight report or an out-of-memory restart.
- **Data disappears after a redeploy**: the volume is missing or mounted somewhere other than `/app/.wrangler`.

Telemetry controls are the same as Docker mode; see [`SELF_HOSTING_DOCKER.md#telemetry`](./SELF_HOSTING_DOCKER.md#telemetry).
