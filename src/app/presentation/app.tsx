import { resolveOrigins } from "../lib/origins";
import { DashboardApp } from "./dashboard-app";
import { MarketingPage } from "./marketing-page";
import { ShortLinkFallback } from "./short-link-fallback";
import { StatusPage } from "./status-page";
import { useTheme } from "./theme";

export function App() {
  const origins = resolveOrigins();
  const { theme, toggleTheme } = useTheme(origins.publicOrigin);
  const host = window.location.hostname;
  const path = window.location.pathname;

  if ((origins.appHost && host === origins.appHost) || path.startsWith("/app")) {
    return <DashboardApp theme={theme} onToggleTheme={toggleTheme} publicOrigin={origins.publicOrigin} />;
  }

  if (path === "/status") {
    return <StatusPage theme={theme} onToggleTheme={toggleTheme} apiOrigin={origins.apiOrigin} appOrigin={origins.appOrigin} />;
  }

  if (host === origins.publicHost && isPotentialShortLinkPath(path)) {
    return <ShortLinkFallback alias={path.replace(/^\/+|\/+$/g, "")} theme={theme} onToggleTheme={toggleTheme} publicOrigin={origins.publicOrigin} />;
  }

  return <MarketingPage theme={theme} onToggleTheme={toggleTheme} appOrigin={origins.appOrigin} />;
}

function isPotentialShortLinkPath(path: string): boolean {
  const alias = path.replace(/^\/+|\/+$/g, "");
  return Boolean(alias) && !alias.includes(".") && !["app", "api", "admin", "login", "logout", "pricing", "terms", "privacy", "status", "assets"].includes(alias);
}
