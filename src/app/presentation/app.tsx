import { useEffect, useMemo, useState } from "react";
import type * as React from "react";
import {
  Activity,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Command,
  Github,
  LayoutDashboard,
  LinkIcon,
  Lock,
  LogOut,
  Moon,
  Shield,
  Sun,
  UserCircle,
  Users
} from "lucide-react";
import { api, authUrl, turnstileSiteKey } from "../lib/api";
import type { AuditLog, LinkSummary, PlatformSummary, SessionUser, User } from "../../shared/contracts";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton } from "../components/ui/sidebar";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";

type View = "links" | "analytics" | "admin" | "logs" | "settings";
type Theme = "light" | "dark";
type AdminTab = "users" | "links";

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return "light";
    }
    const stored = window.localStorage.getItem("prawurl-theme");
    if (stored === "light" || stored === "dark") {
      return stored;
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("prawurl-theme", theme);
  }, [theme]);

  return { theme, toggleTheme: () => setTheme((current) => (current === "dark" ? "light" : "dark")) };
}

export function App() {
  const host = window.location.hostname;
  const path = window.location.pathname;
  const { theme, toggleTheme } = useTheme();

  if (host === "app.prawurl.com" || path.startsWith("/app")) {
    return <DashboardApp theme={theme} onToggleTheme={toggleTheme} />;
  }

  if (path === "/status") {
    return <StatusPage theme={theme} onToggleTheme={toggleTheme} />;
  }

  return <MarketingPage theme={theme} onToggleTheme={toggleTheme} />;
}

function MarketingPage({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
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
            <Button onClick={() => (window.location.href = "https://app.prawurl.com/app")}>Entrar</Button>
          </div>
        </header>

        <div className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="max-w-3xl">
            <Badge className="mb-5 border-primary/20 bg-primary/10 text-primary">Links curtos com controle de plataforma</Badge>
            <h1 className="text-5xl font-semibold leading-tight tracking-normal md:text-6xl">PrawURL</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              Encurte, organize e audite links em uma plataforma feita para velocidade de edge, login social, analytics e governanca.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="default" onClick={() => (window.location.href = "https://app.prawurl.com/app")}>
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
              ["Redirect rapido", "KV resolve aliases no edge; D1 fica como fonte de verdade."],
              ["Auditoria completa", "Auth, CRUD, admin, redirects, erros e seguranca em logs estruturados."],
              ["Admin nativo", "Usuarios, links globais, bloqueios, flags e metricas da plataforma."]
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

function DashboardApp({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("links");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    api
      .session()
      .then(({ session }) => setSession(session))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <FullScreenMessage title="Carregando" description="Preparando sua sessao." />;
  }

  if (!session) {
    return <LoginPage />;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar collapsed={sidebarCollapsed}>
        <SidebarHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <LinkIcon className="h-5 w-5" />
            </div>
            <div className={sidebarCollapsed ? "sr-only" : "min-w-0"}>
              <div className="font-semibold">PrawURL</div>
              <div className="text-xs text-muted-foreground">{session.user.email}</div>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <NavButton active={view === "links"} onClick={() => setView("links")} icon={<LinkIcon />}>
              {!sidebarCollapsed && "Links"}
            </NavButton>
            <NavButton active={view === "analytics"} onClick={() => setView("analytics")} icon={<BarChart3 />}>
              {!sidebarCollapsed && "Analytics"}
            </NavButton>
            {session.user.role === "admin" && (
              <>
                <NavButton active={view === "admin"} onClick={() => setView("admin")} icon={<Shield />}>
                  {!sidebarCollapsed && "Admin"}
                </NavButton>
                <NavButton active={view === "logs"} onClick={() => setView("logs")} icon={<Command />}>
                  {!sidebarCollapsed && "Auditoria"}
                </NavButton>
              </>
            )}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <div className="mb-3 flex items-center gap-3 rounded-md border bg-background p-2">
            <UserCircle className="h-8 w-8 shrink-0 text-muted-foreground" />
            <div className={sidebarCollapsed ? "sr-only" : "min-w-0 flex-1"}>
              <div className="truncate text-sm font-medium">{session.user.name ?? session.user.email}</div>
              <div className="truncate text-xs text-muted-foreground">{session.user.role}</div>
            </div>
          </div>
          <div className="grid gap-2">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} collapsed={sidebarCollapsed} />
            <Button variant="outline" className="w-full" onClick={() => setSidebarCollapsed((value) => !value)}>
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              {!sidebarCollapsed && "Recolher"}
            </Button>
          </div>
          <Button
            variant="outline"
            className="mt-2 w-full"
            onClick={() => api.logout().then(() => window.location.reload())}
          >
            <LogOut className="h-4 w-4" />
            {!sidebarCollapsed && "Sair"}
          </Button>
        </SidebarFooter>
      </Sidebar>
      <main className="min-w-0 flex-1 overflow-x-hidden p-6 md:p-8">
        {view === "links" && <LinksView />}
        {view === "analytics" && <AnalyticsView />}
        {view === "admin" && session.user.role === "admin" && <AdminView />}
        {view === "logs" && session.user.role === "admin" && <AuditLogsView />}
      </main>
    </div>
  );
}

function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Entrar no PrawURL</CardTitle>
          <CardDescription>Use Google ou GitHub para criar e gerenciar seus links.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Button onClick={() => (window.location.href = authUrl("google"))}>
            <Lock className="h-4 w-4" />
            Continuar com Google
          </Button>
          <Button variant="outline" onClick={() => (window.location.href = authUrl("github"))}>
            <Github className="h-4 w-4" />
            Continuar com GitHub
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

function LinksView() {
  const [links, setLinks] = useState<LinkSummary[]>([]);
  const [destinationUrl, setDestinationUrl] = useState("");
  const [alias, setAlias] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = () => api.links().then(({ links }) => setLinks(links)).catch((error) => setError(error instanceof Error ? error.message : "Erro ao carregar links."));

  useEffect(() => {
    refresh();
  }, []);

  async function createLink(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.createLink({ destinationUrl, alias: alias || undefined }, turnstileToken);
      setDestinationUrl("");
      setAlias("");
      setTurnstileToken(null);
      refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Erro ao criar link");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="grid gap-6">
      <PageTitle title="Links" description="Crie links curtos, acompanhe cliques e mantenha controle de status." />
      <Card>
        <CardHeader>
          <CardTitle>Novo link</CardTitle>
          <CardDescription>Aliases sao globais em prawurl.com.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-[1fr_220px_auto]" onSubmit={createLink}>
            <div className="grid gap-2">
              <Label htmlFor="destination">URL destino</Label>
              <Input id="destination" value={destinationUrl} onChange={(event) => setDestinationUrl(event.target.value)} placeholder="https://..." />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="alias">Alias</Label>
              <Input id="alias" value={alias} onChange={(event) => setAlias(event.target.value)} placeholder="minha-url" />
            </div>
            <Button className="self-end" type="submit" disabled={submitting}>
              {submitting ? "Criando" : "Criar"}
            </Button>
          </form>
          <Turnstile onToken={setTurnstileToken} />
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
      <LinksTable links={links} />
    </section>
  );
}

function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const elementId = "prawurl-turnstile";

  useEffect(() => {
    if (!turnstileSiteKey) {
      return;
    }

    const render = () => {
      const target = document.getElementById(elementId);
      const turnstile = window.turnstile;
      if (!target || !turnstile || target.dataset.rendered === "true") {
        return;
      }
      turnstile.render(target, {
        sitekey: turnstileSiteKey,
        callback: (token) => onToken(token),
        "expired-callback": () => onToken(null),
        "error-callback": () => onToken(null)
      });
      target.dataset.rendered = "true";
    };

    if (!document.querySelector('script[src="https://challenges.cloudflare.com/turnstile/v0/api.js"]')) {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;
      script.onload = render;
      document.head.appendChild(script);
    } else {
      render();
    }
  }, [onToken]);

  return <div id={elementId} className="mt-4 min-h-16" />;
}

function AnalyticsView() {
  const [links, setLinks] = useState<LinkSummary[]>([]);
  useEffect(() => {
    api.links().then(({ links }) => setLinks(links));
  }, []);
  const totalClicks = useMemo(() => links.reduce((sum, link) => sum + link.clickCount, 0), [links]);

  return (
    <section className="grid gap-6">
      <PageTitle title="Analytics" description="Resumo operacional dos seus links." />
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard title="Links" value={links.length} />
        <MetricCard title="Cliques" value={totalClicks} />
        <MetricCard title="Ativos" value={links.filter((link) => link.status === "active").length} />
      </div>
      <LinksTable links={links} />
    </section>
  );
}

function AdminView() {
  const [summary, setSummary] = useState<PlatformSummary | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [links, setLinks] = useState<LinkSummary[]>([]);
  const [tab, setTab] = useState<AdminTab>("users");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.adminSummary().then(({ summary }) => setSummary(summary)),
      api.adminUsers().then(({ users }) => setUsers(users)),
      api.adminLinks().then(({ links }) => setLinks(links))
    ]).catch((error) => setError(error instanceof Error ? error.message : "Erro ao carregar admin."));
  }, []);

  return (
    <section className="grid gap-6">
      <PageTitle title="Admin" description="Operacao da plataforma, usuarios, links globais e governanca." />
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard title="Usuarios" value={summary.users} />
          <MetricCard title="Links" value={summary.links} />
          <MetricCard title="Cliques" value={summary.clicks} />
          <MetricCard title="Auditoria" value={summary.auditEvents} />
        </div>
      )}
      <Tabs>
        <TabsList>
          <TabsTrigger active={tab === "users"} onClick={() => setTab("users")}>
            <Users className="mr-2 h-4 w-4" />
            Usuarios
          </TabsTrigger>
          <TabsTrigger active={tab === "links"} onClick={() => setTab("links")}>
            <LinkIcon className="mr-2 h-4 w-4" />
            Links globais
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {tab === "users" ? <UsersTable users={users} /> : <LinksTable links={links} />}
    </section>
  );
}

function UsersTable({ users }: { users: User[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Usuarios recentes</CardTitle>
        <CardDescription>Status, papeis e cadastros da plataforma.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.email}</TableCell>
                <TableCell><Badge>{user.role}</Badge></TableCell>
                <TableCell>{user.status}</TableCell>
                <TableCell>{new Date(user.createdAt).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AuditLogsView() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  useEffect(() => {
    api.auditLogs().then(({ logs }) => setLogs(logs));
  }, []);

  return (
    <section className="grid gap-6">
      <PageTitle title="Auditoria" description="Eventos persistentes de auth, CRUD, admin e seguranca." />
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Acao</TableHead>
                <TableHead>Entidade</TableHead>
                <TableHead>Severidade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{new Date(log.occurredAt).toLocaleString()}</TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell>{log.entityType}</TableCell>
                  <TableCell><Badge>{log.severity}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}

function LinksTable({ links }: { links: LinkSummary[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Links</CardTitle>
        <CardDescription>Lista operacional dos links encurtados.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Curto</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Cliques</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {links.map((link) => (
              <TableRow key={link.id}>
                <TableCell className="font-medium">prawurl.com/{link.alias}</TableCell>
                <TableCell className="max-w-xl truncate">{link.destinationUrl}</TableCell>
                <TableCell><Badge>{link.status}</Badge></TableCell>
                <TableCell>{link.clickCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function NavButton({ icon, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: React.ReactElement; active?: boolean }) {
  return (
    <SidebarMenuButton {...props}>
      {icon}
      {children}
    </SidebarMenuButton>
  );
}

function PageTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-normal">{title}</h1>
      <p className="mt-1 text-muted-foreground">{description}</p>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl">{value.toLocaleString()}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function StatusPage({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    fetch("https://api.prawurl.com/health")
      .then((response) => setStatus(response.ok ? "online" : "offline"))
      .catch(() => setStatus("offline"));
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      <div className="absolute right-6 top-6">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
      <Card className="w-full max-w-xl">
        <CardHeader>
          <Badge className={status === "online" ? "w-fit border-primary/20 bg-primary/10 text-primary" : "w-fit"}>
            {status === "checking" ? "Verificando" : status === "online" ? "API operacional" : "API indisponivel"}
          </Badge>
          <CardTitle className="pt-4">Status do PrawURL</CardTitle>
          <CardDescription>
            Esta pagina consulta o health check da API e mostra um estado legivel para operacao.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button onClick={() => window.location.reload()}>Atualizar</Button>
          <Button variant="outline" onClick={() => (window.location.href = "/")}>Voltar</Button>
        </CardContent>
      </Card>
    </main>
  );
}

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void; collapsed?: boolean }) {
  return (
    <Button variant="outline" size="icon" onClick={onToggle} aria-label="Alternar tema">
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="sr-only">Alternar tema</span>
    </Button>
  );
}

function FullScreenMessage({ title, description }: { title: string; description: string }) {
  return (
    <main className="grid min-h-screen place-items-center">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}
