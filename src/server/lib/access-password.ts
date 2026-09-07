import { getEnvValueSync } from "@/server/lib/runtime-env";
import { MCP_ROUTE } from "@/server/mcp/context";

// Opt-in shared password for local_noauth deployments that are reachable from
// the internet (Railway, a VPS, a tunnel). Without it, that mode hands every
// visitor the admin identity — fine on localhost, not on a public URL.
//
// One secret, two doors: browsers get an HTTP Basic prompt (any username, the
// password), headless callers of /mcp send it as a bearer token or x-api-key.
// A browser that has authenticated once also gets a signed cookie, because
// browsers never attach Basic credentials to WebSocket handshakes and the chat
// agents (/agents/*) connect over WebSockets. The health endpoint stays open
// so platform healthchecks keep working. Cloudflare Access mode has its own
// login; hosted mode has Better Auth.

const ACCESS_PASSWORD_ENV = "OPENSEO_ACCESS_PASSWORD";
const COOKIE_NAME = "openseo_access";
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const OPEN_PATHS = new Set(["/api/health"]);

export type AccessGate =
  | { allowed: true; setCookie: string | null }
  | { allowed: false; response: Response };

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

function presentedCookie(request: Request): string | null {
  const cookies = request.headers.get("Cookie");
  if (!cookies) return null;
  for (const part of cookies.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE_NAME) return rest.join("=");
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

// The cookie value is an HMAC of a fixed label under the password, so it
// proves knowledge of the password without containing it, and rotating the
// password invalidates every cookie.
async function cookieToken(password: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode("openseo-access-cookie-v1"),
  );
  let binary = "";
  for (const byte of new Uint8Array(signature)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function denied(pathname: string): Response {
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

/**
 * Decides whether a request may proceed. `setCookie` is non-null when the
 * caller proved the password without a cookie: attach it to the response so
 * the browser's later WebSocket handshakes pass too.
 */
export async function checkAccessPassword(
  request: Request,
  env: object,
): Promise<AccessGate> {
  const expected = getEnvValueSync(env, ACCESS_PASSWORD_ENV);
  if (!expected) return { allowed: true, setCookie: null };

  const url = new URL(request.url);
  if (OPEN_PATHS.has(url.pathname)) return { allowed: true, setCookie: null };
  // CORS preflights carry no credentials by design.
  if (request.method === "OPTIONS") return { allowed: true, setCookie: null };

  const token = await cookieToken(expected);
  const cookie = presentedCookie(request);
  if (cookie && secretsMatch(cookie, token)) {
    return { allowed: true, setCookie: null };
  }

  const presented = presentedSecret(request);
  if (presented && secretsMatch(presented, expected)) {
    const secure = url.protocol === "https:" ? "; Secure" : "";
    return {
      allowed: true,
      setCookie:
        url.pathname === MCP_ROUTE
          ? null
          : `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE_SECONDS}${secure}`,
    };
  }

  return { allowed: false, response: denied(url.pathname) };
}

/** Appends the access cookie to a response (WebSocket upgrades are left alone). */
export function withAccessCookie(response: Response, cookie: string): Response {
  if (response.status === 101) return response;
  const headers = new Headers(response.headers);
  headers.append("Set-Cookie", cookie);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
