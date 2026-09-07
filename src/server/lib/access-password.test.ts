import { describe, expect, it } from "vitest";
import { checkAccessPassword, withAccessCookie } from "./access-password";

const env = { OPENSEO_ACCESS_PASSWORD: "s3cret" };
const request = (path: string, headers?: Record<string, string>) =>
  new Request(`https://openseo.example${path}`, { headers });
const basicAuth = { Authorization: `Basic ${btoa("anyone:s3cret")}` };

describe("access password gate", () => {
  it("is inactive when no password is configured", async () => {
    expect(await checkAccessPassword(request("/"), {})).toEqual({
      allowed: true,
      setCookie: null,
    });
  });

  it("challenges browsers with Basic and MCP clients with Bearer", async () => {
    const page = await checkAccessPassword(request("/"), env);
    expect(page.allowed).toBe(false);
    if (!page.allowed) {
      expect(page.response.status).toBe(401);
      expect(page.response.headers.get("WWW-Authenticate")).toMatch(/^Basic/);
    }

    const mcp = await checkAccessPassword(request("/mcp"), env);
    expect(mcp.allowed).toBe(false);
    if (!mcp.allowed) {
      expect(mcp.response.headers.get("WWW-Authenticate")).toMatch(/^Bearer/);
    }
  });

  it("accepts the password via Basic, Bearer, or x-api-key and rejects a wrong one", async () => {
    const results = await Promise.all([
      checkAccessPassword(request("/", basicAuth), env),
      checkAccessPassword(
        request("/mcp", { Authorization: "Bearer s3cret" }),
        env,
      ),
      checkAccessPassword(request("/mcp", { "x-api-key": "s3cret" }), env),
      checkAccessPassword(
        request("/mcp", { Authorization: "Bearer wrong" }),
        env,
      ),
    ]);
    expect(results.map((result) => result.allowed)).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it("issues a cookie to browsers that later passes without credentials", async () => {
    const first = await checkAccessPassword(request("/", basicAuth), env);
    const setCookie = first.allowed ? first.setCookie : null;
    expect(setCookie).toMatch(/^openseo_access=.+; Path=\/; HttpOnly/);
    const cookie = setCookie?.split(";")[0] ?? "";

    // A WebSocket handshake carries cookies but never Basic credentials.
    const socket = await checkAccessPassword(
      request("/agents/sam-chat/abc", { Cookie: cookie, Upgrade: "websocket" }),
      env,
    );
    expect(socket).toEqual({ allowed: true, setCookie: null });

    const forged = await checkAccessPassword(
      request("/agents/sam-chat/abc", { Cookie: "openseo_access=forged" }),
      env,
    );
    expect(forged.allowed).toBe(false);

    // Headless /mcp callers get no cookie.
    const mcp = await checkAccessPassword(
      request("/mcp", { Authorization: "Bearer s3cret" }),
      env,
    );
    expect(mcp).toEqual({ allowed: true, setCookie: null });
  });

  it("attaches the cookie to the response", () => {
    const page = withAccessCookie(
      new Response("ok"),
      "openseo_access=t; Path=/",
    );
    expect(page.headers.get("Set-Cookie")).toBe("openseo_access=t; Path=/");
  });

  it("leaves the health endpoint open for platform healthchecks", async () => {
    expect(await checkAccessPassword(request("/api/health"), env)).toEqual({
      allowed: true,
      setCookie: null,
    });
  });
});
