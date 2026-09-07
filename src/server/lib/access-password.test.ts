import { describe, expect, it } from "vitest";
import { getAccessPasswordGateResponse } from "./access-password";

const env = { OPENSEO_ACCESS_PASSWORD: "s3cret" };
const request = (path: string, headers?: Record<string, string>) =>
  new Request(`https://openseo.example${path}`, { headers });

describe("access password gate", () => {
  it("is inactive when no password is configured", () => {
    expect(getAccessPasswordGateResponse(request("/"), {})).toBeNull();
  });

  it("challenges browsers with Basic and MCP clients with Bearer", () => {
    const page = getAccessPasswordGateResponse(request("/"), env);
    expect(page?.status).toBe(401);
    expect(page?.headers.get("WWW-Authenticate")).toMatch(/^Basic/);

    const mcp = getAccessPasswordGateResponse(request("/mcp"), env);
    expect(mcp?.status).toBe(401);
    expect(mcp?.headers.get("WWW-Authenticate")).toMatch(/^Bearer/);
  });

  it("accepts the password via Basic, Bearer, or x-api-key and rejects a wrong one", () => {
    const basic = `Basic ${btoa("anyone:s3cret")}`;
    expect(
      getAccessPasswordGateResponse(
        request("/", { Authorization: basic }),
        env,
      ),
    ).toBeNull();
    expect(
      getAccessPasswordGateResponse(
        request("/mcp", { Authorization: "Bearer s3cret" }),
        env,
      ),
    ).toBeNull();
    expect(
      getAccessPasswordGateResponse(
        request("/mcp", { "x-api-key": "s3cret" }),
        env,
      ),
    ).toBeNull();
    expect(
      getAccessPasswordGateResponse(
        request("/mcp", { Authorization: "Bearer wrong" }),
        env,
      )?.status,
    ).toBe(401);
  });

  it("leaves the health endpoint open for platform healthchecks", () => {
    expect(
      getAccessPasswordGateResponse(request("/api/health"), env),
    ).toBeNull();
  });
});
