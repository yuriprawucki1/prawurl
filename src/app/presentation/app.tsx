import { useEffect, useMemo, useState } from "react";
import type * as React from "react";
import { Activity, BarChart3, Command, Github, LayoutDashboard, LinkIcon, Lock, LogOut, Shield, Users } from "lucide-react";
import { api, authUrl } from "../lib/api";
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

export function App() {
  const host = window.location.hostname;
  const path = window.location.pathname;

  if (host === "app.prawurl.com" || path.startsWith("/app")) {
    return <DashboardApp />;
  }

  return <MarketingPage />;
}

function MarketingPage() {
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
          <Button onClick={() => (window.location.href = "https://app.prawurl.com/app")}>Entrar</Button>
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
              <Button variant="outline" onClick={() => (window.location.href = "https://api.prawurl.com/health")}>
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

function DashboardApp() {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("links");

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
    <div className="flex min-h-screen">
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <LinkIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">PrawURL</div>
              <div className="text-xs text-muted-foreground">{session.user.email}</div>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <NavButton active={view === "links"} onClick={() => setView("links")} icon={<LinkIcon />}>
              Links
            </NavButton>
            <NavButton active={view === "analytics"} onClick={() => setView("analytics")} icon={<BarChart3 />}>
              Analytics
            </NavButton>
            {session.user.role === "admin" && (
              <>
                <NavButton active={view === "admin"} onClick={() => setView("admin")} icon={<Shield />}>
                  Admin
                </NavButton>
                <NavButton active={view === "logs"} onClick={() => setView("logs")} icon={<Command />}>
                  Auditoria
                </NavButton>
              </>
            )}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => api.logout().then(() => window.location.reload())}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </SidebarFooter>
      </Sidebar>
      <main className="flex-1 p-8">
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

  const refresh = () => api.links().then(({ links }) => setLinks(links));

  useEffect(() => {
    refresh();
  }, []);

  async function createLink(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api.createLink({ destinationUrl, alias: alias || undefined });
      setDestinationUrl("");
      setAlias("");
      refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Erro ao criar link");
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
            <Button className="self-end" type="submit">
              Criar
            </Button>
          </form>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
      <LinksTable links={links} />
    </section>
  );
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

  useEffect(() => {
    api.adminSummary().then(({ summary }) => setSummary(summary));
    api.adminUsers().then(({ users }) => setUsers(users));
    api.adminLinks().then(({ links }) => setLinks(links));
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
          <TabsTrigger active>
            <Users className="mr-2 h-4 w-4" />
            Usuarios
          </TabsTrigger>
          <TabsTrigger>
            <LinkIcon className="mr-2 h-4 w-4" />
            Links globais
          </TabsTrigger>
        </TabsList>
      </Tabs>
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
      <LinksTable links={links} />
    </section>
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
