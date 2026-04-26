export interface AppOrigins {
  publicOrigin: string;
  appOrigin: string;
  apiOrigin: string;
  publicHost: string;
  appHost: string | null;
  apiHost: string | null;
  siteHost: string;
}

const defaultLocation = {
  hostname: "prawurl.com",
  origin: "https://prawurl.com",
  protocol: "https:"
} satisfies Pick<Location, "hostname" | "origin" | "protocol">;

export function resolveOrigins(location: Pick<Location, "hostname" | "origin" | "protocol"> = typeof window === "undefined" ? defaultLocation : window.location): AppOrigins {
  const siteHost = normalizeSiteHost(location.hostname);
  const isLocal = isLocalhost(location.hostname);
  const publicHost = isLocal ? location.hostname : siteHost;
  const appHost = isLocal ? null : `app.${siteHost}`;
  const apiHost = isLocal ? null : `api.${siteHost}`;

  const publicOrigin = import.meta.env.VITE_PUBLIC_ORIGIN ?? buildOrigin(location.protocol, publicHost);
  const appOrigin = import.meta.env.VITE_APP_ORIGIN ?? (appHost ? buildOrigin(location.protocol, appHost) : publicOrigin);
  const apiOrigin = import.meta.env.VITE_API_ORIGIN ?? (apiHost ? buildOrigin(location.protocol, apiHost) : "https://api.prawurl.com");

  return {
    publicOrigin,
    appOrigin,
    apiOrigin,
    publicHost,
    appHost,
    apiHost,
    siteHost
  };
}

export function getCookieDomain(origin: string): string {
  const hostname = new URL(origin).hostname;
  if (isLocalhost(hostname)) {
    return "";
  }

  const parts = normalizeSiteHost(hostname).split(".");
  if (parts.length < 2) {
    return "";
  }

  return `; domain=.${parts.slice(-2).join(".")}`;
}

function normalizeSiteHost(hostname: string): string {
  return hostname.replace(/^(app|api)\./, "");
}

function isLocalhost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function buildOrigin(protocol: string, host: string): string {
  return `${protocol}//${host}`;
}
