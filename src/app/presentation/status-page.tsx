import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { ThemeToggle, type Theme } from "./theme";

export function StatusPage({
  theme,
  onToggleTheme,
  apiOrigin,
  appOrigin
}: {
  theme: Theme;
  onToggleTheme: () => void;
  apiOrigin: string;
  appOrigin: string;
}) {
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking");
  const checkedAt = useMemo(() => new Date().toLocaleTimeString(), [status]);
  const apiHostname = new URL(apiOrigin).hostname;

  useEffect(() => {
    fetch(`${apiOrigin}/health`)
      .then((response) => setStatus(response.ok ? "online" : "offline"))
      .catch(() => setStatus("offline"));
  }, [apiOrigin]);

  return (
    <main className="min-h-screen bg-background px-5 py-4 md:px-6 md:py-6">
      <header className="mx-auto flex max-w-3xl items-center justify-between">
        <Button variant="ghost" onClick={() => (window.location.href = "/")}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-4.5rem)] max-w-3xl place-items-center py-4">
        <Card className="w-full">
          <CardHeader>
            <Badge className={status === "online" ? "w-fit border-primary/20 bg-primary/10 text-primary" : "w-fit"}>
              {status === "checking" ? "Verificando" : status === "online" ? "API operacional" : "API indisponível"}
            </Badge>
            <CardTitle className="pt-4">Status do PrawURL</CardTitle>
            <CardDescription>Monitoramento simples do Worker de API em {apiHostname}.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 rounded-md border bg-muted/40 p-4 text-sm md:grid-cols-3">
              <div>
                <div className="text-muted-foreground">API</div>
                <div className="font-medium">{new URL(apiOrigin).hostname}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Resultado</div>
                <div className="font-medium">{status === "online" ? "Respondendo" : status === "offline" ? "Sem resposta" : "Consultando"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Verificado</div>
                <div className="font-medium">{checkedAt}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => window.location.reload()}>Atualizar</Button>
              <Button variant="outline" onClick={() => (window.location.href = `${appOrigin}/app`)}>
                Abrir app
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
