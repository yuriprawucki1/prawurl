import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Lock } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { ThemeToggle, type Theme } from "./theme";

type LinkState =
  | { kind: "loading" }
  | { kind: "redirect" }
  | { kind: "password_required"; message: string }
  | { kind: "blocked"; message: string }
  | { kind: "not_found"; message: string };

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
  const [state, setState] = useState<LinkState>({ kind: "loading" });
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    api.resolvePublicAlias(alias).then((result) => {
      if (!active) {
        return;
      }

      if (result.kind === "redirect") {
        window.location.replace(result.destinationUrl ?? publicOrigin);
        setState({ kind: "redirect" });
        return;
      }

      if (result.kind === "password_required") {
        setState({ kind: "password_required", message: result.message ?? "Digite a senha para continuar." });
        return;
      }

      if (result.kind === "blocked") {
        setState({ kind: "blocked", message: result.message ?? "Esse link não está disponível." });
        return;
      }

      setState({ kind: "not_found", message: "Esse link não existe ou foi removido." });
    });

    return () => {
      active = false;
    };
  }, [alias, publicOrigin]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const result = await api.unlockPublicAlias(alias, password);
      if (result.kind === "redirect" && result.destinationUrl) {
        window.location.replace(result.destinationUrl);
        return;
      }
      if (result.kind === "password_required") {
        setState({ kind: "password_required", message: result.message ?? "Senha inválida." });
      } else if (result.kind === "blocked") {
        setState({ kind: "blocked", message: result.message ?? "Esse link não está disponível." });
      } else {
        setState({ kind: "not_found", message: "Esse link não existe ou foi removido." });
      }
    } catch (error) {
      setState({ kind: "blocked", message: error instanceof Error ? error.message : "Não foi possível validar a senha." });
    } finally {
      setSubmitting(false);
    }
  }

  const showPasswordForm = state.kind === "password_required";
  const description =
    state.kind === "loading"
      ? "Verificando se este link exige senha."
      : "message" in state
        ? state.message
        : "Redirecionando.";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-6">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_42%),radial-gradient(circle_at_bottom,_rgba(245,158,11,0.12),_transparent_40%)]" />
      <Card className="w-full max-w-md border-border/60 shadow-2xl shadow-black/5">
        <CardHeader className="space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Lock className="h-5 w-5" />
          </div>
          <CardTitle>Link protegido</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {state.kind === "loading" && (
            <div className="grid gap-3">
              <div className="h-10 rounded-md border bg-muted/40" />
              <div className="h-10 rounded-md border bg-muted/40" />
            </div>
          )}

          {showPasswordForm && (
            <form className="grid gap-3" onSubmit={submit}>
              <Input
                autoFocus
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Digite a senha"
                aria-label="Senha do link"
              />
              <Button type="submit" disabled={submitting || !password}>
                {submitting ? "Validando" : "Liberar acesso"}
              </Button>
            </form>
          )}

          <Button variant="outline" onClick={() => (window.location.href = publicOrigin)}>
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
