# Railway Self-Hosting

Run OpenSEO on [Railway](https://railway.com) from this repo. It is the Docker
self-host runtime (`vite preview` on workerd, SQLite-backed D1/KV/R2/Durable
Objects on disk) packaged so Railway can build and run it:

- `railway.json` — points Railway at `Dockerfile.railway`, sets the
  `/api/health` healthcheck and restart policy.
- `Dockerfile.railway` — like `Dockerfile.selfhost`, but the vite build runs at
  image build time (Railway forwards service variables as build args), so the
  container boots in seconds instead of rebuilding on every start.
- `scripts/build-env-fingerprint.sh` — the build-env hash shared by the
  Dockerfile and `docker-entrypoint.sh`; if runtime env that affects the client
  bundle differs from what the image was built with, the entrypoint rebuilds at
  boot (slow but correct).

Like Docker mode, this runs `AUTH_MODE=local_noauth`: **no authentication, one
admin user**. A Railway public domain is reachable by anyone who has the URL.
Keep the domain private, put your own auth proxy in front, or switch to
`AUTH_MODE=hosted` (see `.env.example`) before sharing it.

## Setup

1. Create a service from this repo (or `railway up` from a checkout).
2. Add a volume mounted at `/app/.wrangler`. Without it every deploy wipes the
   database.
3. Generate a public domain, then set service variables:

   | Variable                         | Value                                                                        |
   | -------------------------------- | ---------------------------------------------------------------------------- |
   | `AUTH_MODE`                      | `local_noauth`                                                               |
   | `CLOUDFLARE_INCLUDE_PROCESS_ENV` | `true`                                                                       |
   | `VITE_SHOW_DEVTOOLS`             | `false`                                                                      |
   | `PORT`                           | `3001`                                                                       |
   | `ALLOWED_HOST`                   | your Railway domain, e.g. `x.up.railway.app` (no scheme)                     |
   | `OPENSEO_ACCESS_PASSWORD`        | strongly recommended: gates the UI (browser login) and `/mcp` (bearer token) |
   | `DATAFORSEO_API_KEY`             | see `docs/DATAFORSEO_API_KEY.md`                                             |
   | `OPENROUTER_API_KEY`             | optional, enables SAM                                                        |

   `ALLOWED_HOST` accepts a single hostname. A custom domain replaces it.

   The provider keys (`DATAFORSEO_API_KEY`, `OPENROUTER_API_KEY`,
   `OPENROUTER_MODEL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `BETTER_AUTH_SECRET`) can instead be entered in the app under
   **Settings → Integrations** once it is running. Values saved there live in
   the app's own storage on the volume, take effect immediately, and override
   the environment variable of the same name.

4. Deploy. The first build takes several minutes (full SSR build inside the
   image). `/api/health` reports per-feature configuration status.

Changing `AUTH_MODE`, `VITE_*`, `POSTHOG_*`, `TURNSTILE_SITE_KEY`, or
`BYPASS_EMAIL_VERIFICATION` requires a redeploy so the image is rebuilt with
the new values; otherwise the entrypoint rebuilds at boot instead.

Rank-tracking schedules (cron triggers) do not fire in this mode, same as
Docker self-hosting. Telemetry opt-out: `OPENSEO_TELEMETRY_DISABLED=1`.
