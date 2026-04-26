import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { ThemeToggle, type Theme } from "./theme";

export function ShortLinkFallback({
  alias,
  theme,
  onToggleTheme,
  publicOrigin
}: {
  alias: string;
  theme: Theme;
  onToggleTheme: () => void;
  publicOrigin: string;
}) {
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .resolvePublicAlias(alias)
      .then(({ destinationUrl }) => window.location.replace(destinationUrl))
      .catch(() => setError(true));
  }, [alias]);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      <div className="absolute right-6 top-6">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{error ? "Link não encontrado" : "Abrindo link"}</CardTitle>
          <CardDescription>{error ? "Esse alias não está disponível ou foi desativado." : "Estamos redirecionando você para o destino correto."}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => (window.location.href = publicOrigin)}>
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
