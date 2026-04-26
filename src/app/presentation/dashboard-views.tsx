import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import QRCode from "qrcode";
import {
  ArrowUpDown,
  Check,
  Copy,
  Filter,
  LinkIcon,
  Lock,
  Pin,
  PinOff,
  PencilLine,
  QrCode,
  Plus,
  Shield,
  Tags,
  Trash2,
  Star,
  StarOff,
  Loader2,
  Upload,
  Users
} from "lucide-react";
import type {
  AuditLog,
  BlockedDomainEntry,
  CreateLinkInput,
  Link,
  LinkBulkActionInput,
  LinkExportInput,
  LinkListFilters,
  LinkStatus,
  LinkSummary,
  PlatformSummary,
  User
} from "../../shared/contracts";
import { api } from "../lib/api";
import { resolveOrigins } from "../lib/origins";
import { useIsMobile } from "../hooks/useIsMobile";
import { normalizeDestinationUrlInput } from "../../shared/validation";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import { Skeleton } from "../components/ui/skeleton";

type AdminTab = "users" | "links" | "blocklist";
type EditorMode = "create" | "edit";

const { publicOrigin } = resolveOrigins();
const publicHostname = new URL(publicOrigin).hostname;

export function LinksView() {
  return (
    <LinkWorkspace
      scope="user"
      title="Links"
      description="Crie, filtre, proteja e organize seus links com ações em massa."
      loadLinks={(filters) => api.links(filters)}
      saveLink={(id, input) => (id ? api.updateLink(id, input).then(({ link }) => link) : api.createLink(toCreateLinkInput(input)).then(({ link }) => link))}
      deleteLink={(id) => api.deleteLink(id)}
      bulkAction={(input) => api.bulkLinks(input).then(({ result }) => result)}
      exportLinks={(input) => api.exportLinks(input)}
      showOwner={false}
    />
  );
}

export function AnalyticsView() {
  const [links, setLinks] = useState<LinkSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.links().then(({ links }) => setLinks(links)).finally(() => setLoading(false));
  }, []);

  const totalClicks = useMemo(() => links.reduce((sum, link) => sum + link.clickCount, 0), [links]);
  const protectedLinks = useMemo(() => links.filter((link) => link.passwordProtected).length, [links]);
  const pinnedLinks = useMemo(() => links.filter((link) => link.pinned).length, [links]);

  return (
    <section className="grid gap-6">
      <PageTitle title="Analytics" description="Um panorama rápido dos seus links e sinais de proteção." />
      {loading ? (
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard title="Links" value={links.length} />
          <MetricCard title="Cliques" value={totalClicks} />
          <MetricCard title="Protegidos" value={protectedLinks} />
          <MetricCard title="Fixados" value={pinnedLinks} />
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Top links</CardTitle>
          <CardDescription>Os links mais usados aparecem primeiro.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <LinksTableSkeleton showOwner={false} hasActions={false} /> : <LinksList links={links.slice(0, 8)} showOwner={false} />}
        </CardContent>
      </Card>
    </section>
  );
}

export function AdminView() {
  const [summary, setSummary] = useState<PlatformSummary | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [blockedDomains, setBlockedDomains] = useState<BlockedDomainEntry[]>([]);
  const [tab, setTab] = useState<AdminTab>("links");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    Promise.all([api.adminSummary(), api.adminUsers(), api.adminBlockedDomains()])
      .then(([summaryResult, usersResult, blockedResult]) => {
        setSummary(summaryResult.summary);
        setUsers(usersResult.users);
        setBlockedDomains(blockedResult.domains);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Erro ao carregar admin."));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <section className="grid gap-6">
      <PageTitle title="Admin" description="Operação da plataforma, governança e blocklist interna." />
      {summary ? (
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard title="Usuários" value={summary.users} />
          <MetricCard title="Links" value={summary.links} />
          <MetricCard title="Cliques" value={summary.clicks} />
          <MetricCard title="Auditoria" value={summary.auditEvents} />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </div>
      )}
      <Tabs>
        <TabsList className="flex flex-wrap">
          <TabsTrigger active={tab === "links"} onClick={() => setTab("links")}>
            <LinkIcon className="mr-2 h-4 w-4" />
            Links
          </TabsTrigger>
          <TabsTrigger active={tab === "users"} onClick={() => setTab("users")}>
            <Users className="mr-2 h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger active={tab === "blocklist"} onClick={() => setTab("blocklist")}>
            <Shield className="mr-2 h-4 w-4" />
            Blocklist
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {tab === "links" && (
        <LinkWorkspace
          scope="admin"
          title="Links globais"
          description="Visão consolidada com filtros, bulk actions e export."
          loadLinks={(filters) => api.adminLinks(filters)}
          saveLink={(id, input) => (id ? api.updateLink(id, input).then(({ link }) => link) : api.createLink(toCreateLinkInput(input)).then(({ link }) => link))}
          deleteLink={(id) => api.deleteLink(id)}
          bulkAction={(input) => api.adminBulkLinks(input).then(({ result }) => result)}
          exportLinks={(input) => api.adminExportLinks(input)}
          showOwner
        />
      )}
      {tab === "users" && <UsersTable users={users} loading={!summary} />}
      {tab === "blocklist" && <BlocklistPanel blockedDomains={blockedDomains} onRefresh={refresh} loading={!summary} />}
    </section>
  );
}

export function AuditLogsView() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.adminAuditLogs().then(({ logs }) => setLogs(logs)).finally(() => setLoading(false));
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
          {loading ? <AuditLogsSkeleton /> : <AuditLogsList logs={logs} />}
        </CardContent>
      </Card>
    </section>
  );
}

function LinkWorkspace({
  scope,
  title,
  description,
  loadLinks,
  saveLink,
  deleteLink,
  bulkAction,
  exportLinks,
  showOwner
}: {
  scope: "user" | "admin";
  title: string;
  description: string;
  loadLinks: (filters: LinkListFilters) => Promise<{ links: LinkSummary[] }>;
  saveLink: (id: string | null, input: LinkFormInput) => Promise<Link>;
  deleteLink: (id: string) => Promise<unknown>;
  bulkAction: (input: LinkBulkActionInput) => Promise<{ affected: number }>;
  exportLinks: (input: LinkExportInput) => Promise<string>;
  showOwner: boolean;
}) {
  const isMobile = useIsMobile();
  const [links, setLinks] = useState<LinkSummary[]>([]);
  const [filters, setFilters] = useState<LinkListFilters>({});
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<LinkSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LinkSummary | null>(null);
  const [qrTarget, setQrTarget] = useState<LinkSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);

  const refresh = useCallback(() => {
    if (hasLoadedRef.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    loadLinks(filters)
      .then(({ links: nextLinks }) => setLinks(nextLinks))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Erro ao carregar links."))
      .finally(() => {
        hasLoadedRef.current = true;
        setLoading(false);
        setRefreshing(false);
      });
  }, [filters, loadLinks]);

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

  async function submitLink(input: LinkFormInput) {
    setSaving(true);
    setError(null);
    try {
      await saveLink(editingLink?.id ?? null, input);
      setEditorOpen(false);
      setEditingLink(null);
      refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erro ao salvar link.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(ids: string[], action: "activate" | "deactivate") {
    await bulkAction({ ids, action });
    setSelectedIds([]);
    refresh();
  }

  async function exportSelected() {
    const csv = await exportLinks({ ids: selectedIds });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${scope}-links-export.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function toggleFavorite(link: LinkSummary) {
    await saveLink(link.id, { favorite: !link.favorite });
    refresh();
  }

  async function togglePinned(link: LinkSummary) {
    await saveLink(link.id, { pinned: !link.pinned });
    refresh();
  }

  return (
    <section className="grid gap-6" aria-busy={refreshing}>
      <PageTitle title={title} description={description} />

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            <Button onClick={() => setEditorOpen(true)}>
              <Plus className="h-4 w-4" />
              Novo link
            </Button>
          </div>
          <div className="hidden md:block">
            <FiltersBar filters={filters} onChange={setFilters} />
          </div>
          <div className="md:hidden">
            <MobileFiltersSheet filters={filters} onChange={setFilters} />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm">
              <span className="font-medium">{selectedIds.length} selecionados</span>
              <Button size="sm" variant="outline" onClick={() => toggleStatus(selectedIds, "activate")}>
                Ativar
              </Button>
              <Button size="sm" variant="outline" onClick={() => toggleStatus(selectedIds, "deactivate")}>
                Desativar
              </Button>
              <Button size="sm" variant="outline" onClick={exportSelected}>
                <Upload className="h-4 w-4" />
                Exportar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={async () => {
                  await bulkAction({ ids: selectedIds, action: "delete" });
                  setSelectedIds([]);
                  refresh();
                }}
              >
                <Trash2 className="h-4 w-4" />
                Excluir
              </Button>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {loading && links.length === 0 ? (
            <LinksTableSkeleton showOwner={showOwner} hasActions={true} />
          ) : (
            <LinksList
              links={links}
              showOwner={showOwner}
              selectedIds={selectedIds}
              onToggleSelected={(id) =>
                setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
              }
              onEdit={(link) => {
                setEditingLink(link);
                setEditorOpen(true);
              }}
              onRequestDelete={(link) => setDeleteTarget(link)}
              onRequestQr={(link) => setQrTarget(link)}
              onToggleFavorite={toggleFavorite}
              onTogglePinned={togglePinned}
            />
          )}
        </CardContent>
      </Card>

      <LinkEditorDialog
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) {
            setEditingLink(null);
          }
        }}
        mode={editingLink ? "edit" : "create"}
        initialLink={editingLink}
        onSubmit={submitLink}
        busy={saving}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        link={deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={async () => {
          if (!deleteTarget) {
            return;
          }
          await deleteLink(deleteTarget.id);
          setSelectedIds((current) => current.filter((selected) => selected !== deleteTarget.id));
          setDeleteTarget(null);
          refresh();
        }}
      />

      <QrCodeDialog open={Boolean(qrTarget)} link={qrTarget} onOpenChange={(open) => !open && setQrTarget(null)} />
    </section>
  );
}

function FiltersBar({
  filters,
  onChange
}: {
  filters: LinkListFilters;
  onChange: (value: LinkListFilters) => void;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-6">
      <Input
        placeholder="Buscar por slug ou destino"
        value={filters.search ?? ""}
        onChange={(event) => onChange({ ...filters, search: event.target.value || undefined })}
      />
      <Input placeholder="Domínio" value={filters.domain ?? ""} onChange={(event) => onChange({ ...filters, domain: event.target.value || undefined })} />
      <Input placeholder="Tag" value={filters.tag ?? ""} onChange={(event) => onChange({ ...filters, tag: event.target.value || undefined })} />
      <Select value={filters.status ?? "all"} onValueChange={(value) => onChange({ ...filters, status: value === "all" ? undefined : parseStatus(value) })}>
        <SelectTrigger>
          <SelectValue placeholder="Todos os status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os status</SelectItem>
          <SelectItem value="active">Ativo</SelectItem>
          <SelectItem value="disabled">Desativado</SelectItem>
          <SelectItem value="blocked">Bloqueado</SelectItem>
        </SelectContent>
      </Select>
      <Select value={filters.favorite === undefined ? "all" : filters.favorite ? "1" : "0"} onValueChange={(value) => onChange({ ...filters, favorite: value === "all" ? undefined : value === "1" })}>
        <SelectTrigger>
          <SelectValue placeholder="Todos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="1">Favoritos</SelectItem>
          <SelectItem value="0">Não favoritos</SelectItem>
        </SelectContent>
      </Select>
      <Button variant="outline" onClick={() => onChange({})}>
        <ArrowUpDown className="h-4 w-4" />
        Limpar
      </Button>
    </div>
  );
}

function MobileFiltersSheet({
  filters,
  onChange
}: {
  filters: LinkListFilters;
  onChange: (value: LinkListFilters) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <Filter className="h-4 w-4" />
        Filtros
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filtros</SheetTitle>
            <SheetDescription>Refine a lista por status, domínio, tag e favoritos.</SheetDescription>
          </SheetHeader>
          <div className="grid gap-3 p-4">
            <Input placeholder="Buscar por slug ou destino" value={filters.search ?? ""} onChange={(event) => onChange({ ...filters, search: event.target.value || undefined })} />
            <Input placeholder="Domínio" value={filters.domain ?? ""} onChange={(event) => onChange({ ...filters, domain: event.target.value || undefined })} />
            <Input placeholder="Tag" value={filters.tag ?? ""} onChange={(event) => onChange({ ...filters, tag: event.target.value || undefined })} />
            <Select value={filters.status ?? "all"} onValueChange={(value) => onChange({ ...filters, status: value === "all" ? undefined : parseStatus(value) })}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="disabled">Desativado</SelectItem>
                <SelectItem value="blocked">Bloqueado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.favorite === undefined ? "all" : filters.favorite ? "1" : "0"} onValueChange={(value) => onChange({ ...filters, favorite: value === "all" ? undefined : value === "1" })}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="1">Favoritos</SelectItem>
                <SelectItem value="0">Não favoritos</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => onChange({})}>
              Limpar filtros
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function LinkEditorDialog({
  open,
  onOpenChange,
  mode,
  initialLink,
  onSubmit,
  busy
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: EditorMode;
  initialLink: LinkSummary | null;
    onSubmit: (input: LinkFormInput) => Promise<void>;
  busy: boolean;
}) {
  const isMobile = useIsMobile();
  const [form, setForm] = useState<LinkFormState>(() => stateFromLink(null));
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(stateFromLink(initialLink));
      setFormError(null);
    }
  }, [initialLink, open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      setFormError(null);
      await onSubmit(formToInput(form, mode));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não foi possível salvar o link.");
    }
  }

  const content = (
    <form className="grid gap-4 p-4" onSubmit={submit}>
      <div className="grid gap-2">
        <Label>URL destino</Label>
        <Input
          value={form.destinationUrl}
          onChange={(event) => setForm((current) => ({ ...current, destinationUrl: event.target.value }))}
          placeholder="https://..."
          autoCapitalize="none"
          autoCorrect="off"
          inputMode="url"
        />
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Alias</Label>
          <Input value={form.alias} onChange={(event) => setForm((current) => ({ ...current, alias: event.target.value }))} placeholder="meu-link" />
        </div>
        <div className="grid gap-2">
          <Label>Título</Label>
          <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Título opcional" />
        </div>
      </div>
      <div className="grid gap-2">
        <Label>Tags</Label>
        <Input value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} placeholder="portfolio, pessoal" />
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Senha</Label>
          <Input
            type="password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            placeholder={mode === "edit" ? "Deixe em branco para manter" : "Opcional"}
          />
          {mode === "edit" && (
            <label className="flex items-center gap-2 text-sm">
              <input checked={form.clearPassword} onChange={(event) => setForm((current) => ({ ...current, clearPassword: event.target.checked }))} type="checkbox" />
              Remover senha
            </label>
          )}
        </div>
        <div className="grid gap-2">
          <Label>Redirect</Label>
          <Select value={form.redirectCode} onValueChange={(value) => setForm((current) => ({ ...current, redirectCode: value === "301" ? "301" : "302" }))}>
            <SelectTrigger>
              <SelectValue placeholder="302 temporário" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="302">302 temporário</SelectItem>
              <SelectItem value="301">301 permanente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        <div className="grid gap-2">
          <Label>Expiração</Label>
          <Select value={form.expiresPreset} onValueChange={(value) => setForm((current) => ({ ...current, expiresPreset: value as LinkFormState["expiresPreset"] }))}>
            <SelectTrigger>
              <SelectValue placeholder="Sem expiração" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem expiração</SelectItem>
              <SelectItem value="1h">Válido por 1 hora</SelectItem>
              <SelectItem value="24h">Válido por 24 horas</SelectItem>
              <SelectItem value="tomorrow">Válido até amanhã</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Limite de cliques</Label>
          <Input type="number" min="1" value={form.clickLimit} onChange={(event) => setForm((current) => ({ ...current, clickLimit: event.target.value }))} />
        </div>
        <div className="grid gap-2">
          <Label>Inatividade (min)</Label>
          <Input type="number" min="1" value={form.inactiveMinutes} onChange={(event) => setForm((current) => ({ ...current, inactiveMinutes: event.target.value }))} />
        </div>
      </div>
      {form.expiresPreset === "custom" && (
        <div className="grid gap-2">
          <Label>Expira em</Label>
          <Input type="datetime-local" value={form.expiresAt} onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))} />
        </div>
      )}
      <div className="grid gap-2 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Países permitidos</Label>
          <Input
            list="country-code-options"
            value={form.countryAllowlist}
            onChange={(event) => setForm((current) => ({ ...current, countryAllowlist: event.target.value }))}
            placeholder="BR, US"
            autoCapitalize="characters"
            autoCorrect="off"
          />
        </div>
        <div className="grid gap-2">
          <Label>Países bloqueados</Label>
          <Input
            list="country-code-options"
            value={form.countryBlocklist}
            onChange={(event) => setForm((current) => ({ ...current, countryBlocklist: event.target.value }))}
            placeholder="RU, CN"
            autoCapitalize="characters"
            autoCorrect="off"
          />
        </div>
      </div>
      <datalist id="country-code-options">
        {COUNTRY_SUGGESTIONS.map((country) => (
          <option key={country.code} value={country.code}>
            {country.label}
          </option>
        ))}
      </datalist>
      <p className="text-xs text-muted-foreground">Digite um ou mais códigos ISO, separados por vírgula. O campo sugere os códigos mais usados.</p>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input checked={form.favorite} onChange={(event) => setForm((current) => ({ ...current, favorite: event.target.checked }))} type="checkbox" />
          Favorito
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input checked={form.pinned} onChange={(event) => setForm((current) => ({ ...current, pinned: event.target.checked }))} type="checkbox" />
          Fixar no topo
        </label>
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Salvando" : mode === "create" ? "Criar link" : "Salvar alterações"}
        </Button>
        <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
      </div>
      {formError && <p className="text-sm text-destructive">{formError}</p>}
    </form>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{mode === "create" ? "Novo link" : "Editar link"}</SheetTitle>
            <SheetDescription>Senha, expiração, país, tags e organização.</SheetDescription>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Novo link" : "Editar link"}</DialogTitle>
          <DialogDescription>Senha, expiração, país, tags e organização.</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}

function LinksList({
  links,
  showOwner,
  selectedIds = [],
  onToggleSelected,
  onEdit,
  onRequestDelete,
  onRequestQr,
  onToggleFavorite,
  onTogglePinned
}: {
  links: LinkSummary[];
  showOwner: boolean;
  selectedIds?: string[];
  onToggleSelected?: (id: string) => void;
  onEdit?: (link: LinkSummary) => void;
  onRequestDelete?: (link: LinkSummary) => void;
  onRequestQr?: (link: LinkSummary) => void;
  onToggleFavorite?: (link: LinkSummary) => void;
  onTogglePinned?: (link: LinkSummary) => void;
}) {
  const hasActions = Boolean(onEdit || onRequestDelete || onRequestQr || onToggleFavorite || onTogglePinned);

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:hidden">
        {links.map((link) => (
          <div key={link.id} className="grid gap-3 rounded-md border p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <label className="flex items-start gap-2">
                {onToggleSelected && <input checked={selectedIds.includes(link.id)} onChange={() => onToggleSelected(link.id)} type="checkbox" className="mt-1" />}
                <div className="min-w-0">
                  <a className="block truncate font-medium text-primary underline-offset-4 hover:underline" href={`${publicOrigin}/${link.alias}`} target="_blank" rel="noreferrer">
                    {publicHostname}/{link.alias}
                  </a>
                  {link.title && <div className="truncate text-xs text-muted-foreground">{link.title}</div>}
                </div>
              </label>
              <div className="flex items-center gap-1">
                <CopyLinkButton value={`${publicOrigin}/${link.alias}`} />
                {onEdit && <MiniActionButton icon={<PencilLine className="h-4 w-4" />} label="Editar" onClick={() => onEdit(link)} />}
                {onRequestQr && <MiniActionButton icon={<QrCode className="h-4 w-4" />} label="QR Code" onClick={() => onRequestQr(link)} />}
              </div>
            </div>
            <div className="break-all text-xs text-muted-foreground">{link.destinationUrl}</div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge>{linkStatusLabel(link.status)}</Badge>
              <Badge>{link.clickCount} cliques</Badge>
              {link.passwordProtected && <Badge><Lock className="mr-1 h-3 w-3" />Senha</Badge>}
              {link.favorite && <Badge>Favorito</Badge>}
              {link.pinned && <Badge>Fixado</Badge>}
              {showOwner && <Badge>{link.ownerEmail ?? shortId(link.ownerId)}</Badge>}
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
            <div className="flex flex-wrap gap-2">
              {onToggleFavorite && (
                <Button size="sm" variant="outline" onClick={() => onToggleFavorite(link)}>
                  {link.favorite ? "Desfavoritar" : "Favoritar"}
                </Button>
              )}
              {onTogglePinned && (
                <Button size="sm" variant="outline" onClick={() => onTogglePinned(link)}>
                  {link.pinned ? "Desafixar" : "Fixar"}
                </Button>
              )}
              {onRequestDelete && (
                <Button size="sm" variant="destructive" onClick={() => onRequestDelete(link)}>
                  Excluir
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block">
        <div className="overflow-x-auto rounded-md border">
          <Table className="min-w-[1280px] table-fixed">
            <TableHeader>
              <TableRow>
                {onToggleSelected && <TableHead className="w-10" />}
                <TableHead className="w-[18rem]">Curto</TableHead>
                <TableHead className="w-[24rem]">Destino</TableHead>
                {showOwner && <TableHead className="w-[16rem]">Dono</TableHead>}
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-24">Cliques</TableHead>
                <TableHead className="w-[14rem]">Sinais</TableHead>
                {hasActions && <TableHead className="w-[14rem]">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.map((link) => (
                <TableRow key={link.id}>
                  {onToggleSelected && (
                    <TableCell>
                      <input checked={selectedIds.includes(link.id)} onChange={() => onToggleSelected(link.id)} type="checkbox" />
                    </TableCell>
                  )}
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <a className="text-primary underline-offset-4 hover:underline" href={`${publicOrigin}/${link.alias}`} target="_blank" rel="noreferrer">
                        {publicHostname}/{link.alias}
                      </a>
                      <CopyLinkButton value={`${publicOrigin}/${link.alias}`} />
                    </div>
                    {link.title && <div className="text-xs font-normal text-muted-foreground">{link.title}</div>}
                  </TableCell>
                  <TableCell className="truncate">{link.destinationUrl}</TableCell>
                  {showOwner && <TableCell className="truncate">{link.ownerEmail ?? shortId(link.ownerId)}</TableCell>}
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Badge>{linkStatusLabel(link.status)}</Badge>
                      {link.passwordProtected && (
                        <Badge>
                          <Lock className="mr-1 h-3 w-3" />
                          Senha
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{link.clickCount}</TableCell>
                  <TableCell>
                    <div className="flex max-w-64 flex-wrap gap-1">
                      {link.favorite && <Badge>Favorito</Badge>}
                      {link.pinned && <Badge>Fixado</Badge>}
                      {link.safetyStatus !== "clean" && <Badge>{link.safetyStatus}</Badge>}
                      {link.countryAllowlist.length > 0 && <Badge>+{link.countryAllowlist.join(",")}</Badge>}
                      {link.countryBlocklist.length > 0 && <Badge>-{link.countryBlocklist.join(",")}</Badge>}
                    </div>
                  </TableCell>
                  {hasActions && (
                    <TableCell className="whitespace-nowrap">
                      <div className="flex flex-nowrap items-center justify-end gap-0">
                        {onEdit && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon-sm" variant="ghost" onClick={() => onEdit(link)} aria-label="Editar link">
                                <PencilLine className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Editar</TooltipContent>
                          </Tooltip>
                        )}
                        {onToggleFavorite && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon-sm" variant="ghost" onClick={() => onToggleFavorite(link)} aria-label={link.favorite ? "Desfavoritar link" : "Favoritar link"}>
                                {link.favorite ? <StarOff className="h-4 w-4" /> : <Star className="h-4 w-4" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{link.favorite ? "Desfavoritar" : "Favoritar"}</TooltipContent>
                          </Tooltip>
                        )}
                        {onTogglePinned && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon-sm" variant="ghost" onClick={() => onTogglePinned(link)} aria-label={link.pinned ? "Desafixar link" : "Fixar link"}>
                                {link.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{link.pinned ? "Desafixar" : "Fixar"}</TooltipContent>
                          </Tooltip>
                        )}
                        {onRequestQr && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon-sm" variant="ghost" onClick={() => onRequestQr(link)} aria-label="Ver QR code">
                                <QrCode className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>QR Code</TooltipContent>
                          </Tooltip>
                        )}
                        {onRequestDelete && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon-sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onRequestDelete(link)} aria-label="Excluir link">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Excluir</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function BlocklistPanel({
  blockedDomains,
  onRefresh,
  loading
}: {
  blockedDomains: BlockedDomainEntry[];
  onRefresh: () => void;
  loading: boolean;
}) {
  const [domain, setDomain] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api.addBlockedDomain({
        domain,
        reason,
        createdAt: new Date().toISOString()
      });
      setDomain("");
      setReason("");
      onRefresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível adicionar o domínio.");
    }
  }

  async function remove(domainToRemove: string) {
    await api.removeBlockedDomain(domainToRemove);
    onRefresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Blocklist interna</CardTitle>
        <CardDescription>Domínios proibidos manualmente e usados pelo safe browsing básico.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto]" onSubmit={submit}>
          <Input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="dominio-proibido.com" />
          <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo" />
          <Button type="submit">Adicionar</Button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {loading ? <BlocklistSkeleton /> : <div className="grid gap-3">{blockedDomains.map((entry) => <BlocklistRow key={entry.domain} entry={entry} onRemove={() => remove(entry.domain)} />)}</div>}
      </CardContent>
    </Card>
  );
}

function UsersTable({ users, loading }: { users: User[]; loading: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Usuários recentes</CardTitle>
        <CardDescription>Status, papéis e cadastros da plataforma.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? <UsersTableSkeleton /> : <UsersTableContent users={users} />}
      </CardContent>
    </Card>
  );
}

function UsersTableContent({ users }: { users: User[] }) {
  return (
    <>
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
    </>
  );
}

function AuditLogsList({ logs }: { logs: AuditLog[] }) {
  return (
    <>
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
    </>
  );
}

function ConfirmDeleteDialog({
  open,
  link,
  onOpenChange,
  onConfirm
}: {
  open: boolean;
  link: LinkSummary | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir link?</AlertDialogTitle>
          <AlertDialogDescription>
            {link ? (
              <>
                Essa ação remove <span className="font-medium text-foreground">{link.alias}</span> permanentemente.
              </>
            ) : (
              "Essa ação remove o link permanentemente."
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction>
            <Button
              variant="destructive"
              onClick={async () => {
                await onConfirm();
              }}
            >
              Excluir
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function QrCodeDialog({
  open,
  link,
  onOpenChange
}: {
  open: boolean;
  link: LinkSummary | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!open || !link) {
      setQrDataUrl(null);
      return;
    }

    QRCode.toDataURL(`${publicOrigin}/${link.alias}`, { width: 320, margin: 1 })
      .then((value) => {
        if (active) {
          setQrDataUrl(value);
        }
      })
      .catch(() => {
        if (active) {
          setQrDataUrl(null);
        }
      });

    return () => {
      active = false;
    };
  }, [link, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>QR Code</DialogTitle>
          <DialogDescription>{link ? `${publicOrigin}/${link.alias}` : "Compartilhe este link por QR Code."}</DialogDescription>
        </DialogHeader>
        <div className="grid place-items-center gap-4">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt={`QR Code de ${link?.alias ?? "link"}`} className="h-56 w-56 rounded-lg border bg-white p-3" />
          ) : (
            <div className="grid h-56 w-56 place-items-center rounded-lg border bg-muted">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          <Button
            variant="outline"
            onClick={async () => {
              if (link) {
                await navigator.clipboard.writeText(`${publicOrigin}/${link.alias}`);
              }
            }}
          >
            Copiar URL
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LinksTableSkeleton({ showOwner, hasActions }: { showOwner: boolean; hasActions: boolean }) {
  return (
    <div className="grid gap-3 rounded-md border p-3">
      <div className="grid gap-3 md:hidden">
        {[0, 1, 2].map((index) => (
          <div key={index} className="grid gap-3 rounded-md border p-3">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-4 w-4 rounded-sm" />
              <div className="grid flex-1 gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            <Skeleton className="h-3 w-full" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-14" />
              <Skeleton className="h-5 w-16" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        ))}
      </div>
      <div className="hidden md:block">
          <Table className="min-w-[1280px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Skeleton className="h-4 w-4" />
                </TableHead>
              <TableHead className="w-[18rem]">Curto</TableHead>
              <TableHead className="w-[24rem]">Destino</TableHead>
              {showOwner && <TableHead className="w-[16rem]">Dono</TableHead>}
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-24">Cliques</TableHead>
              <TableHead className="w-[14rem]">Sinais</TableHead>
              {hasActions && <TableHead className="w-[14rem]">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[0, 1, 2].map((index) => (
              <TableRow key={index}>
                <TableCell>
                  <Skeleton className="h-4 w-4" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="mt-2 h-3 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-56" />
                </TableCell>
                {showOwner && (
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                )}
                <TableCell>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-8" />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </TableCell>
                {hasActions && (
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <Skeleton className="h-8 w-8 rounded-full" />
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function MetricCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-24" />
      </CardHeader>
    </Card>
  );
}

function AuditLogsSkeleton() {
  return (
    <div className="grid gap-3">
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="grid gap-2 rounded-md border p-3">
          <Skeleton className="h-4 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

function BlocklistSkeleton() {
  return (
    <div className="grid gap-3">
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex items-center justify-between gap-3 rounded-md border p-3">
          <div className="grid gap-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
      ))}
    </div>
  );
}

function BlocklistRow({ entry, onRemove }: { entry: BlockedDomainEntry; onRemove: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
      <div>
        <div className="font-medium">{entry.domain}</div>
        <div className="text-sm text-muted-foreground">{entry.reason}</div>
      </div>
      <Button size="sm" variant="destructive" onClick={onRemove}>
        Remover
      </Button>
    </div>
  );
}

function UsersTableSkeleton() {
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:hidden">
        {[0, 1, 2].map((index) => (
          <div key={index} className="grid gap-2 rounded-md border p-3">
            <Skeleton className="h-4 w-48" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3 w-32" />
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
            {[0, 1, 2].map((index) => (
              <TableRow key={index}>
                <TableCell>
                  <Skeleton className="h-4 w-48" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-28" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

const COUNTRY_SUGGESTIONS = [
  { code: "BR", label: "Brasil" },
  { code: "US", label: "Estados Unidos" },
  { code: "PT", label: "Portugal" },
  { code: "ES", label: "Espanha" },
  { code: "AR", label: "Argentina" },
  { code: "CL", label: "Chile" },
  { code: "CO", label: "Colômbia" },
  { code: "MX", label: "México" },
  { code: "PE", label: "Peru" },
  { code: "UY", label: "Uruguai" },
  { code: "GB", label: "Reino Unido" },
  { code: "DE", label: "Alemanha" },
  { code: "FR", label: "França" },
  { code: "IT", label: "Itália" },
  { code: "JP", label: "Japão" },
  { code: "CA", label: "Canadá" }
];

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
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copy} aria-label="Copiar link curto">
          {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{copied ? "Copiado" : "Copiar link"}</TooltipContent>
    </Tooltip>
  );
}

function MiniActionButton({
  icon,
  label,
  onClick
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClick} aria-label={label}>
      {icon}
    </Button>
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

function statusLabel(status: LinkStatus): string {
  const labels: Record<LinkStatus, string> = {
    active: "Ativo",
    disabled: "Desativado",
    blocked: "Bloqueado"
  };
  return labels[status];
}

function linkStatusLabel(status: LinkStatus): string {
  return statusLabel(status);
}

function severityLabel(severity: AuditLog["severity"]): string {
  const labels: Record<AuditLog["severity"], string> = {
    info: "Info",
    warning: "Atenção",
    critical: "Crítico"
  };
  return labels[severity];
}

function roleLabel(role: User["role"]): string {
  const labels: Record<User["role"], string> = {
    admin: "Admin",
    user: "Usuário"
  };
  return labels[role];
}

function userStatusLabel(status: User["status"]): string {
  const labels: Record<User["status"], string> = {
    active: "Ativo",
    blocked: "Bloqueado"
  };
  return labels[status];
}

function shortId(value: string): string {
  return value.length > 10 ? `${value.slice(0, 8)}...` : value;
}

function parseStatus(value: string): LinkStatus | undefined {
  if (value === "active" || value === "disabled" || value === "blocked") {
    return value;
  }
  return undefined;
}

function stateFromLink(link: LinkSummary | null): LinkFormState {
  if (!link) {
    return {
      destinationUrl: "",
      alias: "",
      title: "",
      tags: "",
      password: "",
      clearPassword: false,
      redirectCode: "302",
      expiresPreset: "none",
      expiresAt: "",
      clickLimit: "",
      inactiveMinutes: "",
      countryAllowlist: "",
      countryBlocklist: "",
      favorite: false,
      pinned: false
    };
  }

  return {
    destinationUrl: link.destinationUrl,
    alias: link.alias,
    title: link.title ?? "",
    tags: link.tags.join(", "),
    password: "",
    clearPassword: false,
    redirectCode: link.redirectCode === 301 ? "301" : "302",
    expiresPreset: link.expiresAt ? "custom" : "none",
    expiresAt: link.expiresAt ? toDatetimeLocal(link.expiresAt) : "",
    clickLimit: link.clickLimit ? String(link.clickLimit) : "",
    inactiveMinutes: link.inactiveExpiresAfterMinutes ? String(link.inactiveExpiresAfterMinutes) : "",
    countryAllowlist: link.countryAllowlist.join(", "),
    countryBlocklist: link.countryBlocklist.join(", "),
    favorite: link.favorite,
    pinned: link.pinned
  };
}

function formToInput(form: LinkFormState, mode: EditorMode): LinkFormInput {
  return {
    destinationUrl: normalizeDestinationUrlInput(form.destinationUrl),
    alias: form.alias.trim() || undefined,
    title: form.title.trim() || undefined,
    tags: parseDelimited(form.tags),
    password: form.clearPassword ? null : mode === "edit" && !form.password.trim() ? undefined : form.password.trim() || null,
    redirectCode: form.redirectCode === "301" ? 301 : 302,
    expiresAt: computeExpiresAt(form.expiresPreset, form.expiresAt),
    clickLimit: form.clickLimit ? Number(form.clickLimit) : null,
    inactiveExpiresAfterMinutes: form.inactiveMinutes ? Number(form.inactiveMinutes) : null,
    countryAllowlist: parseCountryCodes(form.countryAllowlist),
    countryBlocklist: parseCountryCodes(form.countryBlocklist),
    favorite: form.favorite,
    pinned: form.pinned
  };
}

function toCreateLinkInput(input: LinkFormInput): CreateLinkInput {
  const destinationUrl = input.destinationUrl?.trim();
  if (!destinationUrl) {
    throw new Error("DESTINATION_URL_REQUIRED");
  }

  return {
    destinationUrl,
    alias: input.alias,
    title: input.title,
    tags: input.tags,
    expiresAt: input.expiresAt,
    redirectCode: input.redirectCode,
    password: input.password,
    clickLimit: input.clickLimit,
    inactiveExpiresAfterMinutes: input.inactiveExpiresAfterMinutes,
    countryAllowlist: input.countryAllowlist,
    countryBlocklist: input.countryBlocklist,
    favorite: input.favorite,
    pinned: input.pinned
  };
}

function parseDelimited(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseCountryCodes(value: string): string[] {
  return parseDelimited(value).map((item) => item.toUpperCase()).slice(0, 20);
}

function computeExpiresAt(preset: LinkFormState["expiresPreset"], custom: string): string | null {
  const now = new Date();
  if (preset === "none") {
    return null;
  }
  if (preset === "1h") {
    return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  }
  if (preset === "24h") {
    return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  }
  if (preset === "tomorrow") {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);
    return tomorrow.toISOString();
  }
  return custom ? new Date(custom).toISOString() : null;
}

function toDatetimeLocal(value: string): string {
  const date = new Date(value);
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

type LinkFormState = {
  destinationUrl: string;
  alias: string;
  title: string;
  tags: string;
  password: string;
  clearPassword: boolean;
  redirectCode: "301" | "302";
  expiresPreset: "none" | "1h" | "24h" | "tomorrow" | "custom";
  expiresAt: string;
  clickLimit: string;
  inactiveMinutes: string;
  countryAllowlist: string;
  countryBlocklist: string;
  favorite: boolean;
  pinned: boolean;
};

type LinkFormInput = Partial<CreateLinkInput> & {
  status?: LinkStatus;
};
