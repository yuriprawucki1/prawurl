import { ArrowLeft } from "lucide-react";
import { LinkIcon } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { authUrl } from "../lib/api";
import { ThemeToggle, type Theme } from "./theme";

export function LoginPage({
  theme,
  onToggleTheme,
  publicOrigin
}: {
  theme?: Theme;
  onToggleTheme?: () => void;
  publicOrigin: string;
}) {
  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-background px-5 py-4 md:px-6 md:py-6">
      <header className="mx-auto flex w-full max-w-5xl shrink-0 items-center justify-between">
        <Button variant="ghost" onClick={() => (window.location.href = publicOrigin)}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        {theme && onToggleTheme && <ThemeToggle theme={theme} onToggle={onToggleTheme} />}
      </header>

      <section className="mx-auto grid min-h-0 w-full max-w-5xl flex-1 items-center gap-4 py-3 lg:grid-cols-[1fr_420px]">
        <div className="max-w-xl">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground md:h-11 md:w-11">
            <LinkIcon className="h-6 w-6" />
          </div>
          <Badge className="mb-3 border-primary/20 bg-primary/10 text-primary">PrawURL Workspace</Badge>
          <h1 className="text-2xl font-semibold tracking-normal md:text-5xl">Entre para gerenciar seus links.</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground md:text-lg md:leading-8">
            Crie aliases, acompanhe cliques, organize tags e mantenha seus redirects sob controle em um painel simples.
          </p>
        </div>

        <Card className="w-full">
          <CardHeader>
            <CardTitle>Entrar no PrawURL</CardTitle>
            <CardDescription>Use uma conta social para continuar. A criação de conta é automática.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button onClick={() => (window.location.href = authUrl("google"))}>
              <GoogleIcon className="h-4 w-4" />
              Continuar com Google
            </Button>
            <Button variant="outline" onClick={() => (window.location.href = authUrl("github"))}>
              <GithubMark className="h-4 w-4" />
              Continuar com GitHub
            </Button>
            <p className="text-xs leading-5 text-muted-foreground">
              Ao continuar, você aceita usar o PrawURL para criar e auditar links curtos públicos.
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.23c0-.78-.07-1.53-.2-2.23H12v4.22h5.37a4.59 4.59 0 0 1-1.99 3.01v2.5h3.22c1.89-1.74 3-4.3 3-7.5Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.42l-3.22-2.5c-.9.6-2.04.95-3.39.95-2.6 0-4.8-1.76-5.59-4.12H3.08v2.59A9.99 9.99 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.41 13.91a6 6 0 0 1 0-3.82V7.5H3.08a10.01 10.01 0 0 0 0 9l3.33-2.59Z" />
      <path fill="#EA4335" d="M12 5.97c1.47 0 2.8.51 3.84 1.5l2.86-2.86A9.61 9.61 0 0 0 12 2 9.99 9.99 0 0 0 3.08 7.5l3.33 2.59C7.2 7.73 9.4 5.97 12 5.97Z" />
    </svg>
  );
}

function GithubMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.58 2 12.24c0 4.52 2.86 8.35 6.84 9.7.5.1.68-.22.68-.5 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.63.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.9 1.56 2.35 1.11 2.92.85.09-.67.35-1.11.63-1.37-2.22-.26-4.55-1.14-4.55-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.27 9.27 0 0 1 12 6.95c.85 0 1.7.12 2.5.34 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.8-4.57 5.05.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .28.18.6.69.5A10.04 10.04 0 0 0 22 12.24C22 6.58 17.52 2 12 2Z"
      />
    </svg>
  );
}
