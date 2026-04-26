import { Activity, LayoutDashboard, LinkIcon } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { ThemeToggle, type Theme } from "./theme";

export function MarketingPage({
  theme,
  onToggleTheme,
  appOrigin
}: {
  theme: Theme;
  onToggleTheme: () => void;
  appOrigin: string;
}) {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <LinkIcon className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold">PrawURL</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            <Button onClick={() => (window.location.href = `${appOrigin}/app`)}>Entrar</Button>
          </div>
        </header>

        <div className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="max-w-3xl">
            <Badge className="mb-5 border-primary/20 bg-primary/10 text-primary">Links curtos com controle de plataforma</Badge>
            <h1 className="text-5xl font-semibold leading-tight tracking-normal md:text-6xl">PrawURL</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              Encurte, organize e audite links em uma plataforma feita para velocidade de edge, login social, analytics e governança.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="default" onClick={() => (window.location.href = `${appOrigin}/app`)}>
                <LayoutDashboard className="h-4 w-4" />
                Abrir dashboard
              </Button>
              <Button variant="outline" onClick={() => (window.location.href = "/status")}>
                <Activity className="h-4 w-4" />
                Status da API
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
            {[
              ["Redirect rápido", "KV resolve aliases no edge; D1 fica como fonte de verdade."],
              ["Auditoria completa", "Auth, CRUD, admin, redirects, erros e segurança em logs estruturados."],
              ["Admin nativo", "Usuários, links globais, bloqueios, flags e métricas da plataforma."]
            ].map(([title, description]) => (
              <Card key={title}>
                <CardHeader>
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
