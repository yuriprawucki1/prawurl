import { z } from "zod";

export const aliasSchema = z
  .string()
  .min(3)
  .max(48)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/, "Use letters, numbers, dashes or underscores.");

export const destinationUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "https:" || protocol === "http:";
  }, "Only http and https URLs are supported.");

export const createLinkSchema = z.object({
  destinationUrl: destinationUrlSchema,
  alias: aliasSchema.optional(),
  title: z.string().trim().min(1).max(120).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  redirectCode: z.union([z.literal(301), z.literal(302)]).optional()
});

export const updateLinkSchema = z.object({
  destinationUrl: destinationUrlSchema.optional(),
  title: z.string().trim().min(1).max(120).nullable().optional(),
  status: z.enum(["active", "disabled", "blocked"]).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  redirectCode: z.union([z.literal(301), z.literal(302)]).optional()
});

export const reservedPublicPaths = new Set([
  "",
  "app",
  "api",
  "admin",
  "login",
  "logout",
  "pricing",
  "terms",
  "privacy",
  "status",
  "assets",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml"
]);

export function normalizeAlias(value: string): string {
  return value.trim().toLowerCase();
}

export function isReservedPath(value: string): boolean {
  return reservedPublicPaths.has(normalizeAlias(value));
}
