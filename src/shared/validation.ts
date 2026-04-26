import { z } from "zod";

export function normalizeDestinationUrlInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("A URL de destino é obrigatória.");
  }

  const candidates = trimmed.startsWith("http://") || trimmed.startsWith("https://") ? [trimmed] : [`https://${trimmed}`, `http://${trimmed}`];

  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.toString();
      }
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error("Use uma URL válida ou informe apenas o domínio.");
}

export const aliasSchema = z
  .string()
  .min(2, "O alias precisa ter pelo menos 2 caracteres.")
  .max(48)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/, "Use letras, números, hífens ou underscores.");

export const destinationUrlSchema = z.string().trim().transform((value, ctx) => {
  try {
    return normalizeDestinationUrlInput(value);
  } catch (error) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: error instanceof Error ? error.message : "Use uma URL válida ou informe apenas o domínio."
    });
    return z.NEVER;
  }
});

export const countryCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2}$/, "Use um código ISO-3166-1 alpha-2.")
  .transform((value) => value.toUpperCase());

export const countryListSchema = z.array(countryCodeSchema).max(20);

export const passwordSchema = z.string().trim().min(4).max(128);

export const nonNegativeIntegerSchema = z.number().int().min(0);

export const positiveIntegerSchema = z.number().int().positive().max(1000000);

export const boolishSchema = z.boolean();

export const blockedDomainSchema = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(253)
    .regex(/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i, "Use um domínio válido."),
  reason: z.string().trim().min(1).max(120)
});

export const createLinkSchema = z.object({
  destinationUrl: destinationUrlSchema,
  alias: aliasSchema.optional(),
  title: z.string().trim().min(1).max(120).optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(10).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  redirectCode: z.union([z.literal(301), z.literal(302)]).optional(),
  password: passwordSchema.nullable().optional(),
  clickLimit: positiveIntegerSchema.nullable().optional(),
  inactiveExpiresAfterMinutes: positiveIntegerSchema.nullable().optional(),
  countryAllowlist: countryListSchema.optional(),
  countryBlocklist: countryListSchema.optional(),
  favorite: boolishSchema.optional(),
  pinned: boolishSchema.optional()
});

export const updateLinkSchema = z.object({
  destinationUrl: destinationUrlSchema.optional(),
  title: z.string().trim().min(1).max(120).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(10).optional(),
  status: z.enum(["active", "disabled", "blocked"]).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  redirectCode: z.union([z.literal(301), z.literal(302)]).optional(),
  password: passwordSchema.nullable().optional(),
  clickLimit: positiveIntegerSchema.nullable().optional(),
  inactiveExpiresAfterMinutes: positiveIntegerSchema.nullable().optional(),
  countryAllowlist: countryListSchema.optional(),
  countryBlocklist: countryListSchema.optional(),
  favorite: boolishSchema.optional(),
  pinned: boolishSchema.optional()
});

export const bulkLinkActionSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
  action: z.enum(["activate", "deactivate", "delete"])
});

export const exportLinkSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100)
});

export const blockedDomainInputSchema = blockedDomainSchema;

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

export function normalizeCountryCode(value: string): string {
  return value.trim().toUpperCase();
}

export function normalizeCountryList(values: string[] | undefined): string[] {
  if (!values) {
    return [];
  }

  return [...new Set(values.map((value) => normalizeCountryCode(value)).filter(Boolean))].sort();
}

export function normalizeDomain(value: string): string {
  return value.trim().toLowerCase();
}

export function isReservedPath(value: string): boolean {
  return reservedPublicPaths.has(normalizeAlias(value));
}
