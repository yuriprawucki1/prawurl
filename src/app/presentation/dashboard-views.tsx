import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import { Check, Copy, LinkIcon, QrCode, Tags, Users } from "lucide-react";
import type { AuditLog, LinkSummary, PlatformSummary, User } from "../../shared/contracts";
import { api } from "../lib/api";
import { resolveOrigins } from "../lib/origins";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";

type AdminTab = "users" | "links";
const { publicOrigin } = resolveOrigins();
const publicHostname = new URL(publicOrigin).hostname;

export function LinksView() {
  const [links, setLinks] = useState<LinkSummary[]>([]);
  const [destinationUrl, setDestinationUrl] = useState("");
  const [alias, setAlias] = useState("");
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(() => {
    api
      .links()
      .then(({ links }) => setLinks(links))
      .catch((error) => setError(error instanceof Error ? error.message : "Erro ao carregar links."));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (!document.hidden) {
        refresh();
      }
    };

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refresh]);

  async function createLink(event: FormEvent) {
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
          <CardDescription>Aliases são globais em {publicHostname}.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_220px]" onSubmit={createLink}>
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
            <div className="grid gap-2">
              <Label htmlFor="tags">
                Tags <span className="text-xs font-normal text-muted-foreground">(opcionais)</span>
              </Label>
              <Input id="tags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="portfolio, pessoal" />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="title">
                Título <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Meu link importante" />
            </div>
            <div className="flex md:items-end md:justify-end">
              <Button className="w-full md:w-auto" type="submit" disabled={submitting}>
                {submitting ? "Criando" : "Criar link"}
              </Button>
            </div>
          </form>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
      <LinksTable links={links} />
    </section>
  );
}

export function AnalyticsView() {
  const [links, setLinks] = useState<LinkSummary[]>([]);
  const refresh = useCallback(() => {
    api.links().then(({ links }) => setLinks(links));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (!document.hidden) {
        refresh();
      }
    };

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refresh]);

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

export function AdminView() {
  const [summary, setSummary] = useState<PlatformSummary | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [links, setLinks] = useState<LinkSummary[]>([]);
  const [tab, setTab] = useState<AdminTab>("users");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.adminSummary().then(({ summary }) => setSummary(summary)), api.adminUsers().then(({ users }) => setUsers(users)), api.adminLinks().then(({ links }) => setLinks(links))]).catch((error) =>
      setError(error instanceof Error ? error.message : "Erro ao carregar admin.")
    );
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

export function AuditLogsView() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  useEffect(() => {
    api.auditLogs().then(({ logs }) => setLogs(logs));
  }, []);

  return (
    <section className="grid gap-6">
      <PageTitle title="Auditoria" description="Eventos persistentes de autenticação, links, admin e segurança." />
      <Card>
        <CardHeader>
          <CardTitle>Eventos recentes</CardTitle>
          <CardDescription>Use esta visão para entender quem fez o quê, quando e em qual entidade.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-3 md:hidden">
            {logs.map((log) => (
              <div key={log.id} className="grid gap-2 rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{log.action}</span>
                  <Badge>{severityLabel(log.severity)}</Badge>
                </div>
                <div className="grid gap-1 text-xs text-muted-foreground">
                  <span>
                    Entidade: {log.entityType}
                    {log.entityId ? `/${shortId(log.entityId)}` : ""}
                  </span>
                  <span>Ator: {log.actorUserId ? shortId(log.actorUserId) : "Sistema"}</span>
                </div>
                <AuditMetadata metadata={log.metadata} />
                <div className="text-xs text-muted-foreground">{new Date(log.occurredAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Ator</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>Dados</TableHead>
                  <TableHead>Severidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{new Date(log.occurredAt).toLocaleString()}</TableCell>
                    <TableCell>{log.action}</TableCell>
                    <TableCell>{log.actorUserId ? shortId(log.actorUserId) : "Sistema"}</TableCell>
                    <TableCell>
                      {log.entityType}
                      {log.entityId ? `/${shortId(log.entityId)}` : ""}
                    </TableCell>
                    <TableCell className="max-w-sm">
                      <AuditMetadata metadata={log.metadata} />
                    </TableCell>
                    <TableCell>
                      <Badge>{severityLabel(log.severity)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
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
        <div className="grid gap-3 md:hidden">
          {users.map((user) => (
            <div key={user.id} className="grid gap-2 rounded-md border p-3 text-sm">
              <div className="font-medium">{user.email}</div>
              <div className="flex flex-wrap gap-2">
                <Badge>{roleLabel(user.role)}</Badge>
                <Badge>{userStatusLabel(user.status)}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">{new Date(user.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
        <div className="hidden md:block">
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
                  <TableCell>
                    <Badge>{roleLabel(user.role)}</Badge>
                  </TableCell>
                  <TableCell>{userStatusLabel(user.status)}</TableCell>
                  <TableCell>{new Date(user.createdAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
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
        <div className="grid gap-3 md:hidden">
          {links.map((link) => (
            <div key={link.id} className="grid gap-2 rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <a className="block truncate font-medium text-primary underline-offset-4 hover:underline" href={`${publicOrigin}/${link.alias}`} target="_blank" rel="noreferrer">
                    {publicHostname}/{link.alias}
                  </a>
                  {link.title && <div className="truncate text-xs text-muted-foreground">{link.title}</div>}
                </div>
                <CopyLinkButton value={`${publicOrigin}/${link.alias}`} />
              </div>
              <div className="text-xs text-muted-foreground">{link.destinationUrl}</div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge>{linkStatusLabel(link.status)}</Badge>
                <Badge>{link.clickCount} cliques</Badge>
                <Badge>{link.ownerEmail ?? shortId(link.ownerId)}</Badge>
              </div>
              <div className="flex flex-wrap gap-1">
                {link.tags.length > 0 ? (
                  link.tags.map((tag) => (
                    <Badge key={tag} className="gap-1">
                      <Tags className="h-3 w-3" />
                      {tag}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">Sem tags</span>
                )}
              </div>
              <div className="pt-1">
                <QrPreview value={`${publicOrigin}/${link.alias}`} compact />
              </div>
            </div>
          ))}
        </div>
        <div className="hidden md:block">
          <Table className="min-w-[1200px]">
            <TableHeader>
              <TableRow>
                <TableHead>Curto</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Dono</TableHead>
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
                      <a className="text-primary underline-offset-4 hover:underline" href={`${publicOrigin}/${link.alias}`} target="_blank" rel="noreferrer">
                        {publicHostname}/{link.alias}
                      </a>
                      <CopyLinkButton value={`${publicOrigin}/${link.alias}`} />
                    </div>
                    {link.title && <div className="text-xs font-normal text-muted-foreground">{link.title}</div>}
                  </TableCell>
                  <TableCell className="max-w-xl truncate">{link.destinationUrl}</TableCell>
                  <TableCell>{link.ownerEmail ?? shortId(link.ownerId)}</TableCell>
                  <TableCell>
                    <Badge>{linkStatusLabel(link.status)}</Badge>
                  </TableCell>
                  <TableCell>{link.clickCount}</TableCell>
                  <TableCell>
                    <div className="flex max-w-48 flex-wrap gap-1">
                      {link.tags.length > 0 ? (
                        link.tags.map((tag) => (
                          <Badge key={tag} className="gap-1">
                            <Tags className="h-3 w-3" />
                            {tag}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem tags</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <QrPreview value={`${publicOrigin}/${link.alias}`} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function PageTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-normal md:text-3xl">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground md:text-base">{description}</p>
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

function QrPreview({ value, compact = false }: { value: string; compact?: boolean }) {
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    QRCode.toDataURL(value, { margin: 1, width: 320, errorCorrectionLevel: "M" })
      .then(setSrc)
      .catch(() => setSrc(""));
  }, [value]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className={compact ? "h-8 w-8" : undefined} aria-label="Abrir QR Code">
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

function AuditMetadata({ metadata }: { metadata: Record<string, unknown> }) {
  const entries = Object.entries(metadata).filter(([, value]) => value !== undefined && value !== null && value !== "");

  if (entries.length === 0) {
    return <span className="text-xs text-muted-foreground">Sem metadados</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([key, value]) => (
        <Badge key={key} className="max-w-full truncate">
          {key}: {String(value)}
        </Badge>
      ))}
    </div>
  );
}

function shortId(value: string): string {
  return value.length > 10 ? `${value.slice(0, 8)}...` : value;
}

function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function severityLabel(severity: AuditLog["severity"]): string {
  const labels: Record<AuditLog["severity"], string> = {
    info: "Info",
    warning: "Atenção",
    critical: "Crítico"
  };
  return labels[severity];
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
