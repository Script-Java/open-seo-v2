import { getEnvValueSync } from "@/server/lib/runtime-env";
import { MCP_ROUTE } from "@/server/mcp/context";

// Opt-in shared password for local_noauth deployments that are reachable from
// the internet (Railway, a VPS, a tunnel). Without it, that mode hands every
// visitor the admin identity — fine on localhost, not on a public URL.
//
// One secret, two doors: browsers get an HTTP Basic prompt (any username, the
// password), headless callers of /mcp send it as a bearer token or x-api-key.
// The health endpoint stays open so platform healthchecks keep working.
// Cloudflare Access mode has its own login; hosted mode has Better Auth.

const ACCESS_PASSWORD_ENV = "OPENSEO_ACCESS_PASSWORD";

const OPEN_PATHS = new Set(["/api/health"]);

function presentedSecret(request: Request): string | null {
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) return apiKey;

  const authorization = request.headers.get("Authorization");
  if (!authorization) return null;

  const [scheme, value] = authorization.split(/\s+/, 2);
  if (!value) return null;
  if (scheme.toLowerCase() === "bearer") return value;
  if (scheme.toLowerCase() === "basic") {
    try {
      const decoded = atob(value);
      const separator = decoded.indexOf(":");
      return separator === -1 ? decoded : decoded.slice(separator + 1);
    } catch {
      return null;
    }
  }
  return null;
}

function secretsMatch(presented: string, expected: string): boolean {
  const a = new TextEncoder().encode(presented);
  const b = new TextEncoder().encode(expected);
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Returns a 401 when the deployment has an access password and the request
 * did not present it; null lets the request through (also when no password
 * is configured).
 */
export function getAccessPasswordGateResponse(
  request: Request,
  env: object,
): Response | null {
  const expected = getEnvValueSync(env, ACCESS_PASSWORD_ENV);
  if (!expected) return null;

  const { pathname } = new URL(request.url);
  if (OPEN_PATHS.has(pathname)) return null;
  // CORS preflights carry no credentials by design.
  if (request.method === "OPTIONS") return null;

  const presented = presentedSecret(request);
  if (presented && secretsMatch(presented, expected)) return null;

  if (pathname === MCP_ROUTE) {
    return new Response(
      JSON.stringify({
        error: "unauthorized",
        error_description: `Send the deployment's ${ACCESS_PASSWORD_ENV} as "Authorization: Bearer <password>" or "x-api-key".`,
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": 'Bearer realm="OpenSEO"',
        },
      },
    );
  }

  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="OpenSEO", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
}
