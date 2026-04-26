import { useEffect, useLayoutEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { Button } from "../components/ui/button";
import { getCookieDomain } from "../lib/origins";

export type Theme = "light" | "dark";

const themeCookieName = "prawurl_theme";
const themeStorageKey = "prawurl-theme";

export function useTheme(publicOrigin: string) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    const cookieTheme = readCookie(themeCookieName);
    if (cookieTheme === "light" || cookieTheme === "dark") {
      return cookieTheme;
    }

    try {
      const stored = window.localStorage.getItem(themeStorageKey);
      if (stored === "light" || stored === "dark") {
        return stored;
      }
    } catch {
      // Ignore storage access failures and fall back below.
    }

    if (document.documentElement.classList.contains("dark")) {
      return "dark";
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    try {
      window.localStorage.setItem(themeStorageKey, theme);
    } catch {
      // Ignore storage access failures and continue writing the cookie.
    }
    writeThemeCookie(theme, publicOrigin);
  }, [publicOrigin, theme]);

  return {
    theme,
    toggleTheme: () => setTheme((current) => (current === "dark" ? "light" : "dark"))
  };
}

export function ThemeToggle({ theme, onToggle, ...props }: { theme: Theme; onToggle: () => void } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button variant="outline" size="icon" onClick={onToggle} aria-label="Alternar tema" {...props}>
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="sr-only">Alternar tema</span>
    </Button>
  );
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1] ?? null;
}

function writeThemeCookie(theme: Theme, publicOrigin: string): void {
  const domain = getCookieDomain(publicOrigin);
  document.cookie = `${themeCookieName}=${theme}; path=/; max-age=31536000; SameSite=Lax${domain}`;
}
