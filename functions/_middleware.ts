import type { PagesFunction } from "@cloudflare/workers-types";
import { homepageMarkdown } from "./homepage-markdown";

const homepageLinks = [
  '</.well-known/api-catalog>; rel="api-catalog"',
  '</openapi.json>; rel="service-desc"',
  '</api-docs.html>; rel="service-doc"',
  '</openapi.json>; rel="describedby"'
].join(", ");

export const onRequest: PagesFunction = async ({ request, next }) => {
  const { pathname } = new URL(request.url);
  const isHomepage = pathname === "/" && (request.method === "GET" || request.method === "HEAD");
  const isCatalogHead = pathname === "/.well-known/api-catalog" && request.method === "HEAD";

  if (isHomepage && acceptsMarkdown(request.headers.get("accept"))) {
    return markdownResponse(request.method);
  }

  const response = await next();
  if (response.status >= 400 || (!isHomepage && !isCatalogHead)) {
    return response;
  }

  const headers = new Headers(response.headers);
  if (isHomepage) {
    addHomepageHeaders(headers);
  } else {
    headers.append("Link", '</.well-known/api-catalog>; rel="api-catalog"');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
};

function acceptsMarkdown(accept: string | null): boolean {
  if (!accept) {
    return false;
  }

  return accept.split(",").some((mediaRange) => {
    const [mediaType, ...parameters] = mediaRange.split(";");
    if (mediaType.trim().toLowerCase() !== "text/markdown") {
      return false;
    }

    const qualityParameter = parameters.find((parameter) => /^\s*q\s*=/i.test(parameter));
    if (!qualityParameter) {
      return true;
    }

    const quality = Number(qualityParameter.split("=")[1]);
    return Number.isFinite(quality) && quality > 0 && quality <= 1;
  });
}

function markdownResponse(method: string): Response {
  const headers = new Headers({
    "Content-Type": "text/markdown; charset=utf-8",
    "Content-Length": String(new TextEncoder().encode(homepageMarkdown).byteLength),
    "Cache-Control": "public, max-age=3600",
    "Content-Signal": "ai-train=no, search=yes, ai-input=no"
  });
  addHomepageHeaders(headers);
  return new Response(method === "HEAD" ? null : homepageMarkdown, { headers });
}

function addHomepageHeaders(headers: Headers): void {
  headers.append("Link", homepageLinks);
  headers.set("Content-Signal", "ai-train=no, search=yes, ai-input=no");
  const existingVary = headers.get("Vary");
  if (!existingVary || existingVary.split(",").every((value) => value.trim().toLowerCase() !== "accept")) {
    headers.set("Vary", existingVary ? `${existingVary}, Accept` : "Accept");
  }
}
