import { z } from "zod";
import { AuditRepository } from "@/server/features/audit/repositories/AuditRepository";
import { parseAuditConfig } from "@/server/lib/audit/types";
import { AppError } from "@/server/lib/errors";
import { buildProjectMeta } from "@/server/mcp/context";
import { mcpResponse } from "@/server/mcp/formatters";
import {
  looseObjectOutputSchema,
  optionalMetaOutputSchema,
} from "@/server/mcp/output-schemas";
import { withMcpProjectAuth } from "@/server/mcp/project-auth";
import { projectIdSchema } from "@/server/mcp/schemas";

const inputSchema = {
  projectId: projectIdSchema,
  auditId: z
    .string()
    .optional()
    .describe("Audit ID. If omitted, uses the project's most recent audit."),
} as const;

/**
 * Lighthouse results are stored per sampled page and strategy when an audit
 * runs with `runLighthouse`, but until this tool nothing exposed them over
 * MCP: the web app read them through its own server functions only. Headless
 * clients (a monitoring job) need the same numbers.
 */
export const getLighthouseResultsTool = {
  name: "get_lighthouse_results",
  config: {
    title: "Get Lighthouse results",
    description:
      "Returns the Lighthouse scores and lab Core Web Vitals stored for each sampled page of a site audit that ran with runLighthouse, one row per page and strategy (mobile, desktop): performance, accessibility, best-practices and SEO scores (0-100), LCP, CLS, INP and TTFB, or the error that stopped the check. Empty when the audit ran without Lighthouse. Uses no credits.",
    inputSchema,
    outputSchema: z.looseObject({
      auditId: z.string(),
      ranLighthouse: z.boolean(),
      results: z.array(looseObjectOutputSchema),
      ...optionalMetaOutputSchema,
    }),
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  handler: withMcpProjectAuth(
    async (args: z.infer<z.ZodObject<typeof inputSchema>>, context) => {
      const audit = args.auditId
        ? await AuditRepository.getAuditForProject(args.auditId, args.projectId)
        : await AuditRepository.getLatestAuditForProject(args.projectId);
      if (!audit) {
        throw new AppError(
          "NOT_FOUND",
          args.auditId
            ? `Audit ${args.auditId} not found in this project.`
            : "No audits exist for this project yet. Start one with run_site_audit.",
        );
      }
      const { pages, lighthouse } =
        await AuditRepository.getAuditResultsForProject(
          audit.id,
          args.projectId,
        );
      const ranLighthouse =
        parseAuditConfig(audit.config)?.lighthouseStrategy !== "none";
      const urlById = new Map(pages.map((page) => [page.id, page.url]));
      const results = lighthouse.map((row) => ({
        pageId: row.pageId,
        url: urlById.get(row.pageId) ?? null,
        strategy: row.strategy,
        performanceScore: row.performanceScore,
        accessibilityScore: row.accessibilityScore,
        bestPracticesScore: row.bestPracticesScore,
        seoScore: row.seoScore,
        lcpMs: row.lcpMs,
        cls: row.cls,
        inpMs: row.inpMs,
        ttfbMs: row.ttfbMs,
        errorMessage: row.errorMessage ?? null,
      }));
      const scored = results.filter((r) => r.performanceScore !== null);
      return mcpResponse({
        text: results.length
          ? `${results.length} Lighthouse result${results.length === 1 ? "" : "s"} for audit ${audit.id} (${scored.length} scored):\n` +
            results
              .map(
                (r) =>
                  `${r.strategy}  ${r.url ?? r.pageId}  performance ${r.performanceScore ?? "–"}  LCP ${r.lcpMs ?? "–"}ms  CLS ${r.cls ?? "–"}${r.errorMessage ? `  error: ${r.errorMessage}` : ""}`,
              )
              .join("\n")
          : ranLighthouse
            ? `Audit ${audit.id} ran Lighthouse but stored no results yet (status: ${audit.status}).`
            : `Audit ${audit.id} ran without Lighthouse. Start one with run_site_audit and runLighthouse: true to measure a sample of pages.`,
        meta: buildProjectMeta(
          context,
          args.projectId,
          `/p/${args.projectId}/audit?auditId=${audit.id}`,
        ),
        structuredContent: { auditId: audit.id, ranLighthouse, results },
      });
    },
  ),
};
