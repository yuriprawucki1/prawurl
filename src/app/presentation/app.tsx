import { useEffect, useMemo, useState } from "react";
import type * as React from "react";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Check,
  ChevronsUpDown,
  Command,
  Copy,
  Github,
  LayoutDashboard,
  LinkIcon,
  Lock,
  Moon,
  QrCode,
  Shield,
  Sun,
  Tags,
  Users,
  LogOut
} from "lucide-react";
import QRCode from "qrcode";
import { api, authUrl } from "../lib/api";
import type { AuditLog, LinkSummary, PlatformSummary, SessionUser, User } from "../../shared/contracts";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "../components/ui/sidebar";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

type View = "links" | "analytics" | "admin" | "logs";
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

  if (host === "prawurl.com" && isPotentialShortLinkPath(path)) {
    return <ShortLinkFallback alias={path.replace(/^\/+|\/+$/g, "")} theme={theme} onToggleTheme={toggleTheme} />;
  }

  return <MarketingPage theme={theme} onToggleTheme={toggleTheme} />;
}

function isPotentialShortLinkPath(path: string): boolean {
  const alias = path.replace(/^\/+|\/+$/g, "");
  return Boolean(alias) && !alias.includes(".") && !["app", "api", "admin", "login", "logout", "pricing", "terms", "privacy", "status", "assets"].includes(alias);
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
              Encurte, organize e audite links em uma plataforma feita para velocidade de edge, login social, analytics e governança.
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

function ShortLinkFallback({ alias, theme, onToggleTheme }: { alias: string; theme: Theme; onToggleTheme: () => void }) {
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
          <CardDescription>
            {error ? "Esse alias não está disponível ou foi desativado." : "Estamos redirecionando você para o destino correto."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => (window.location.href = "/")}>
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

function DashboardApp({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
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
    return <FullScreenMessage title="Carregando" description="Preparando sua sessão." />;
  }

  if (!session) {
    return <LoginPage theme={theme} onToggleTheme={onToggleTheme} />;
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex h-12 items-center gap-2 rounded-md px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <LinkIcon className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate font-semibold">PrawURL</span>
              <span className="truncate text-xs text-muted-foreground">Encurtador de URLs</span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Plataforma</SidebarGroupLabel>
            <SidebarGroupContent>
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
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg" tooltip="Conta">
                    <Avatar user={session.user} />

                    <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                      <span className="truncate font-medium">
                        {session.user.name ?? session.user.email}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {session.user.email}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  side="right"
                  align="end"
                  sideOffset={8}
                  className="w-56"
                >
                  <DropdownMenuLabel className="grid gap-1">
                    <span className="truncate text-sm font-medium">
                      {session.user.name ?? session.user.email}
                    </span>
                    <span className="truncate text-xs font-normal text-muted-foreground">
                      {session.user.email}
                    </span>
                  </DropdownMenuLabel>

                  <DropdownMenuItem onClick={onToggleTheme}>
                    {theme === "dark" ? (
                      <Sun className="mr-2 size-4" />
                    ) : (
                      <Moon className="mr-2 size-4" />
                    )}

                    {theme === "dark" ? "Tema claro" : "Tema escuro"}
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() =>
                      api.logout().finally(() => {
                        window.location.href = "https://prawurl.com";
                      })
                    }
                  >
                    <LogOut className="mr-2 size-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-10 items-center bg-background/95 px-3 backdrop-blur">
          <SidebarTrigger className="h-7 w-7 p-0" />
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden p-4 pt-2 md:p-8 md:pt-4">
          {view === "links" && <LinksView />}
          {view === "analytics" && <AnalyticsView />}
          {view === "admin" && session.user.role === "admin" && <AdminView />}
          {view === "logs" && session.user.role === "admin" && <AuditLogsView />}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function LoginPage({ theme, onToggleTheme }: { theme?: Theme; onToggleTheme?: () => void }) {
  return (
    <main className="min-h-screen bg-background px-6 py-6">
      <header className="mx-auto flex max-w-5xl items-center justify-between">
        <Button variant="ghost" onClick={() => (window.location.href = "https://prawurl.com")}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        {theme && onToggleTheme && <ThemeToggle theme={theme} onToggle={onToggleTheme} />}
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-5xl items-center gap-10 py-8 lg:grid-cols-[1fr_420px]">
        <div className="max-w-xl">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <LinkIcon className="h-6 w-6" />
          </div>
          <Badge className="mb-4 border-primary/20 bg-primary/10 text-primary">PrawURL Workspace</Badge>
          <h1 className="text-4xl font-semibold tracking-normal md:text-5xl">Entre para gerenciar seus links.</h1>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">
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
              <Github className="h-4 w-4" />
              Continuar com GitHub
            </Button>
            <p className="pt-2 text-xs leading-5 text-muted-foreground">
              Ao continuar, você aceita usar o PrawURL para criar e auditar links curtos públicos.
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function LinksView() {
  const [links, setLinks] = useState<LinkSummary[]>([]);
  const [destinationUrl, setDestinationUrl] = useState("");
  const [alias, setAlias] = useState("");
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState<string | null>(null);
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
      await api.createLink({
        destinationUrl,
        alias: alias || undefined,
        title: title || undefined,
        tags: parseTags(tags)
      });
      setDestinationUrl("");
      setAlias("");
      setTitle("");
      setTags("");
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
          <CardDescription>Aliases são globais em prawurl.com.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-[1fr_220px_auto]" onSubmit={createLink}>
            <div className="grid gap-2">
              <Label htmlFor="destination">URL destino</Label>
              <Input id="destination" value={destinationUrl} onChange={(event) => setDestinationUrl(event.target.value)} placeholder="https://..." />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="alias">
                Alias <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input id="alias" value={alias} onChange={(event) => setAlias(event.target.value)} placeholder="minha-url" />
            </div>
            <Button className="self-end" type="submit" disabled={submitting}>
              {submitting ? "Criando" : "Criar"}
            </Button>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="title">
                Título <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Meu link importante" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tags">
                Tags <span className="text-xs font-normal text-muted-foreground">(opcionais)</span>
              </Label>
              <Input id="tags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="portfolio, pessoal" />
            </div>
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
      <PageTitle title="Admin" description="Operação da plataforma, usuários, links globais e governança." />
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard title="Usuários" value={summary.users} />
          <MetricCard title="Links" value={summary.links} />
          <MetricCard title="Cliques" value={summary.clicks} />
          <MetricCard title="Auditoria" value={summary.auditEvents} />
        </div>
      )}
      <Tabs>
        <TabsList>
          <TabsTrigger active={tab === "users"} onClick={() => setTab("users")}>
            <Users className="mr-2 h-4 w-4" />
            Usuários
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
        <CardTitle>Usuários recentes</CardTitle>
        <CardDescription>Status, papéis e cadastros da plataforma.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table className="min-w-[760px]">
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
                <TableCell><Badge>{roleLabel(user.role)}</Badge></TableCell>
                <TableCell>{userStatusLabel(user.status)}</TableCell>
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
      <PageTitle title="Auditoria" description="Eventos persistentes de auth, CRUD, admin e segurança." />
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Ação</TableHead>
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
        <Table className="min-w-[820px]">
          <TableHeader>
            <TableRow>
              <TableHead>Curto</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Cliques</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>QR Code</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {links.map((link) => (
              <TableRow key={link.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <a className="text-primary underline-offset-4 hover:underline" href={`https://prawurl.com/${link.alias}`} target="_blank" rel="noreferrer">
                      prawurl.com/{link.alias}
                    </a>
                    <CopyLinkButton value={`https://prawurl.com/${link.alias}`} />
                  </div>
                  {link.title && <div className="text-xs font-normal text-muted-foreground">{link.title}</div>}
                </TableCell>
                <TableCell className="max-w-xl truncate">{link.destinationUrl}</TableCell>
                <TableCell><Badge>{linkStatusLabel(link.status)}</Badge></TableCell>
                <TableCell>{link.clickCount}</TableCell>
                <TableCell>
                  <div className="flex max-w-48 flex-wrap gap-1">
                    {link.tags.length > 0 ? link.tags.map((tag) => (
                      <Badge key={tag} className="gap-1">
                        <Tags className="h-3 w-3" />
                        {tag}
                      </Badge>
                    )) : <span className="text-xs text-muted-foreground">Sem tags</span>}
                  </div>
                </TableCell>
                <TableCell>
                  <QrPreview value={`https://prawurl.com/${link.alias}`} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CopyLinkButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copy} aria-label="Copiar link curto">
      {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

function QrPreview({ value }: { value: string }) {
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    QRCode.toDataURL(value, { margin: 1, width: 320, errorCorrectionLevel: "M" })
      .then(setSrc)
      .catch(() => setSrc(""));
  }, [value]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Abrir QR Code">
          <QrCode className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>QR Code</DialogTitle>
          <DialogDescription>{value}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center rounded-md border bg-white p-4">
          {src ? <img src={src} alt={`QR Code para ${value}`} className="h-64 w-64" /> : <QrCode className="h-8 w-8 text-muted-foreground" />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Avatar({ user }: { user: User }) {
  const fallback = (user.name ?? user.email).slice(0, 2).toUpperCase();

  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" referrerPolicy="no-referrer" />;
  }

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
      {fallback}
    </div>
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

function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function linkStatusLabel(status: LinkSummary["status"]): string {
  const labels: Record<LinkSummary["status"], string> = {
    active: "Ativo",
    disabled: "Desativado",
    blocked: "Bloqueado"
  };
  return labels[status];
}

function userStatusLabel(status: User["status"]): string {
  const labels: Record<User["status"], string> = {
    active: "Ativo",
    blocked: "Bloqueado"
  };
  return labels[status];
}

function roleLabel(role: User["role"]): string {
  const labels: Record<User["role"], string> = {
    admin: "Admin",
    user: "Usuário"
  };
  return labels[role];
}

function NavButton({
  icon,
  children,
  active,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: React.ReactElement;
  active?: boolean;
}) {
  const label = typeof children === "string" ? children : undefined;
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        tooltip={label}
        {...props}
        onClick={(event) => {
          props.onClick?.(event);
          if (isMobile) {
            setOpenMobile(false);
          }
        }}
      >
        {icon}
        <span>{children}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
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
            {status === "checking" ? "Verificando" : status === "online" ? "API operacional" : "API indisponível"}
          </Badge>
          <CardTitle className="pt-4">Status do PrawURL</CardTitle>
          <CardDescription>
            Esta página consulta o health check da API e mostra um estado legível para operação.
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

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
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
