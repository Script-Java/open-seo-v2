import { describe, expect, it } from "vitest";
import { matchGa4PropertiesByName, suggestGscSite } from "./propertyMatch";

const gscAccount = (
  accountId: string,
  siteUrls: string[],
  overrides: Partial<{
    requiresReconnect: boolean;
    permissionLevel: string;
  }> = {},
) => ({
  accountId,
  requiresReconnect: overrides.requiresReconnect ?? false,
  sites: siteUrls.map((siteUrl) => ({
    siteUrl,
    permissionLevel: overrides.permissionLevel ?? "siteOwner",
  })),
});

describe("suggestGscSite", () => {
  it("prefers the domain property over URL-prefix properties and ignores www", () => {
    const accounts = [
      gscAccount("a", ["https://www.example.com/", "sc-domain:example.com"]),
    ];
    expect(suggestGscSite("www.example.com", accounts)).toEqual({
      accountId: "a",
      siteUrl: "sc-domain:example.com",
    });
  });

  it("skips unverified properties and accounts that need reconnecting", () => {
    const accounts = [
      gscAccount("stale", ["sc-domain:example.com"], {
        requiresReconnect: true,
      }),
      gscAccount("unverified", ["sc-domain:example.com"], {
        permissionLevel: "siteUnverifiedUser",
      }),
      gscAccount("ok", ["http://example.com/", "https://other.com/"]),
    ];
    expect(suggestGscSite("example.com", accounts)).toEqual({
      accountId: "ok",
      siteUrl: "http://example.com/",
    });
    expect(suggestGscSite("nothing.com", accounts)).toBeNull();
  });
});

describe("matchGa4PropertiesByName", () => {
  it("matches properties named after the domain", () => {
    const accounts = [
      {
        accountId: "a",
        requiresReconnect: false,
        propertiesUnavailable: false,
        properties: [
          { propertyId: "properties/1", displayName: "Example.com - GA4" },
          { propertyId: "properties/2", displayName: "Other site" },
        ],
      },
    ];
    expect(
      matchGa4PropertiesByName("https://www.example.com", accounts),
    ).toEqual([{ accountId: "a", propertyId: "properties/1" }]);
  });
});
