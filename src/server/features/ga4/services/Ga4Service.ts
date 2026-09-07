import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { account } from "@/db/schema";
import { AppError } from "@/server/lib/errors";
import { createGa4AdminClient } from "@/server/lib/ga4Client";
import { Ga4AdminApiError, Ga4TokenError } from "@/server/lib/ga4Errors";
import { GA4_OAUTH_PROVIDER_ID } from "@/shared/ga4";
import {
  type Ga4Suggestion,
  matchGa4PropertiesByName,
  normalizeHost,
} from "@/server/features/google/propertyMatch";
import {
  Ga4ConnectionRepository,
  type Ga4Connection,
} from "@/server/features/ga4/repositories/Ga4ConnectionRepository";

async function getConnection(projectId: string): Promise<Ga4Connection | null> {
  return Ga4ConnectionRepository.getByProjectId(projectId);
}

async function listGrantsForUser(userId: string) {
  return db
    .select({ id: account.id, accountId: account.accountId })
    .from(account)
    .where(
      and(
        eq(account.userId, userId),
        eq(account.providerId, GA4_OAUTH_PROVIDER_ID),
      ),
    );
}

async function userHasGrant(userId: string): Promise<boolean> {
  const grants = await listGrantsForUser(userId);
  return grants.length > 0;
}

function requiresReconnect(error: unknown): boolean {
  return (
    error instanceof Ga4TokenError ||
    (error instanceof Ga4AdminApiError && error.status === 401)
  );
}

async function listPropertiesForUserWithGrantStatus(userId: string) {
  const grants = await listGrantsForUser(userId);
  const accounts = await Promise.all(
    grants.map(async (grant) => {
      const client = createGa4AdminClient({
        userId,
        ga4AccountId: grant.accountId,
      });
      try {
        const properties = await client.listProperties();
        let email: string | null = null;
        try {
          email = await client.getUserInfoEmail();
        } catch {
          email = null;
        }
        return {
          accountId: grant.accountId,
          email,
          requiresReconnect: false,
          propertiesUnavailable: false,
          properties,
        };
      } catch (error) {
        const reconnect = requiresReconnect(error);
        if (!reconnect) {
          console.error("ga4.property_discovery_failed", {
            errorName: error instanceof Error ? error.name : "UnknownError",
            status:
              error instanceof Ga4AdminApiError ? error.status : undefined,
          });
        }
        return {
          accountId: grant.accountId,
          email: null,
          requiresReconnect: reconnect,
          propertiesUnavailable: !reconnect,
          properties: [],
        };
      }
    }),
  );
  return { accounts };
}

type Ga4PropertyList = Awaited<
  ReturnType<typeof listPropertiesForUserWithGrantStatus>
>;

// Bounds the per-property data-stream lookups below; beyond this an agency
// account is better served by the picker than by a slow guess.
const MAX_STREAM_LOOKUPS = 40;

/**
 * The property that belongs to a project's domain, if it can be told apart:
 * a single property named after the domain, else the property whose web data
 * stream URL is the domain. null when nothing matches or several do; the
 * picker then shows all of them.
 */
async function suggestPropertyForDomain(
  userId: string,
  domain: string | null,
  propertyList: Ga4PropertyList,
): Promise<Ga4Suggestion | null> {
  const target = normalizeHost(domain);
  if (!target) return null;

  const byName = matchGa4PropertiesByName(target, propertyList.accounts);
  if (byName.length === 1) return byName[0];

  const candidates = propertyList.accounts
    .filter((grant) => !grant.requiresReconnect && !grant.propertiesUnavailable)
    .flatMap((grant) =>
      grant.properties.map((property) => ({
        accountId: grant.accountId,
        propertyId: property.propertyId,
      })),
    );
  if (candidates.length === 0 || candidates.length > MAX_STREAM_LOOKUPS) {
    return null;
  }

  const clients = new Map<string, ReturnType<typeof createGa4AdminClient>>();
  const matches = await Promise.all(
    candidates.map(async (candidate) => {
      let client = clients.get(candidate.accountId);
      if (!client) {
        client = createGa4AdminClient({
          userId,
          ga4AccountId: candidate.accountId,
        });
        clients.set(candidate.accountId, client);
      }
      try {
        const streams = await client.listDataStreams(candidate.propertyId);
        return streams.some(
          (stream) =>
            normalizeHost(stream.webStreamData?.defaultUri) === target,
        )
          ? candidate
          : null;
      } catch {
        // A property we can't inspect is simply not suggested.
        return null;
      }
    }),
  );
  const matched = matches.filter((match) => match !== null);
  return matched.length === 1 ? matched[0] : null;
}

async function setProperty(input: {
  projectId: string;
  organizationId: string;
  propertyId: string;
  accountId: string;
  userId: string;
}): Promise<Ga4Connection> {
  const grants = await listGrantsForUser(input.userId);
  if (!grants.some((grant) => grant.accountId === input.accountId)) {
    throw new AppError(
      "NOT_FOUND",
      "That Google account isn't connected to your OpenSEO account.",
    );
  }

  const client = createGa4AdminClient({
    userId: input.userId,
    ga4AccountId: input.accountId,
  });
  const properties = await client.listProperties();
  if (
    !properties.some((property) => property.propertyId === input.propertyId)
  ) {
    throw new AppError(
      "NOT_FOUND",
      "That Google Analytics property isn't available on your connected Google account.",
    );
  }

  const property = await client.getProperty(input.propertyId);
  let connectedAccountEmail: string | null = null;
  try {
    connectedAccountEmail = await client.getUserInfoEmail();
  } catch {
    connectedAccountEmail = null;
  }

  return Ga4ConnectionRepository.upsert({
    projectId: input.projectId,
    organizationId: input.organizationId,
    propertyId: property.name,
    propertyDisplayName: property.displayName,
    propertyTimeZone: property.timeZone,
    propertyCurrencyCode: property.currencyCode,
    connectedByUserId: input.userId,
    ga4AccountId: input.accountId,
    connectedAccountEmail,
  });
}

async function unlinkUserGrant(
  userId: string,
  ga4AccountId: string,
): Promise<void> {
  await db
    .delete(account)
    .where(
      and(
        eq(account.userId, userId),
        eq(account.providerId, GA4_OAUTH_PROVIDER_ID),
        eq(account.accountId, ga4AccountId),
      ),
    );
}

async function disconnect(input: {
  projectId: string;
  userId: string;
}): Promise<void> {
  const connection = await Ga4ConnectionRepository.getByProjectId(
    input.projectId,
  );
  await Ga4ConnectionRepository.deleteByProjectId(input.projectId);
  if (
    connection?.ga4AccountId &&
    connection.connectedByUserId === input.userId
  ) {
    const stillUsed = await Ga4ConnectionRepository.existsForConnectorAccount(
      input.userId,
      connection.ga4AccountId,
    );
    if (!stillUsed) {
      await unlinkUserGrant(input.userId, connection.ga4AccountId);
    }
  }
}

export const Ga4Service = {
  getConnection,
  userHasGrant,
  listPropertiesForUserWithGrantStatus,
  suggestPropertyForDomain,
  setProperty,
  disconnect,
};
