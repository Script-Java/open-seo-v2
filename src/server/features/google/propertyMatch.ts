// Pure matching of a project's domain to the Google properties a user can see,
// so connecting Search Console / Analytics to a project is one click (or none)
// instead of a hunt through a dropdown. Callers decide what to do with the
// suggestion; nothing here talks to Google.

type GscAccountLike = {
  accountId: string;
  requiresReconnect: boolean;
  sites: Array<{ siteUrl: string; permissionLevel: string }>;
};

type Ga4AccountLike = {
  accountId: string;
  requiresReconnect: boolean;
  propertiesUnavailable: boolean;
  properties: Array<{ propertyId: string; displayName: string }>;
};

type GscSuggestion = { accountId: string; siteUrl: string };
export type Ga4Suggestion = { accountId: string; propertyId: string };

const SITE_UNVERIFIED_PERMISSION = "siteUnverifiedUser";

/** Lowercased hostname without a leading www., or null for junk input. */
export function normalizeHost(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z\d+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const host = new URL(withScheme).hostname.replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

/**
 * Best Search Console property for a domain: the domain property
 * (`sc-domain:example.com`) beats a URL-prefix property, and https beats http.
 * Unverified properties never qualify. Ties keep account order.
 */
export function suggestGscSite(
  domain: string | null | undefined,
  accounts: GscAccountLike[],
): GscSuggestion | null {
  const target = normalizeHost(domain);
  if (!target) return null;

  let best: (GscSuggestion & { rank: number }) | null = null;
  for (const account of accounts) {
    if (account.requiresReconnect) continue;
    for (const site of account.sites) {
      if (site.permissionLevel === SITE_UNVERIFIED_PERMISSION) continue;
      const isDomainProperty = site.siteUrl.startsWith("sc-domain:");
      const host = normalizeHost(
        isDomainProperty
          ? site.siteUrl.slice("sc-domain:".length)
          : site.siteUrl,
      );
      if (host !== target) continue;
      const rank = isDomainProperty
        ? 0
        : site.siteUrl.startsWith("https")
          ? 1
          : 2;
      if (!best || rank < best.rank) {
        best = { accountId: account.accountId, siteUrl: site.siteUrl, rank };
      }
    }
  }
  return best ? { accountId: best.accountId, siteUrl: best.siteUrl } : null;
}

/** Analytics properties whose display name is (or contains) the domain. */
export function matchGa4PropertiesByName(
  domain: string | null | undefined,
  accounts: Ga4AccountLike[],
): Ga4Suggestion[] {
  const target = normalizeHost(domain);
  if (!target) return [];

  const matches: Ga4Suggestion[] = [];
  for (const account of accounts) {
    if (account.requiresReconnect || account.propertiesUnavailable) continue;
    for (const property of account.properties) {
      const name = property.displayName.toLowerCase();
      if (name.includes(target) || normalizeHost(name) === target) {
        matches.push({
          accountId: account.accountId,
          propertyId: property.propertyId,
        });
      }
    }
  }
  return matches;
}
