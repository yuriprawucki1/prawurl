import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import QRCode from "qrcode";
import {
  CalendarDays,
  ArrowUpDown,
  Check,
  Copy,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  LinkIcon,
  Lock,
  Pin,
  PinOff,
  PencilLine,
  MoreVertical,
  QrCode,
  Plus,
  Shield,
  Trash2,
  Star,
  StarOff,
  Loader2,
  Upload,
  Users,
  X
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
import { cn } from "../lib/utils";
import { useIsMobile } from "../hooks/useIsMobile";
import { normalizeDestinationUrlInput } from "../../shared/validation";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import { Skeleton } from "../components/ui/skeleton";
import { useToast } from "../components/ui/toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../components/ui/dropdown-menu";

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
    <section className="grid min-w-0 gap-6 overflow-x-hidden">
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
      <Card className="min-w-0">
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
    <section className="grid min-w-0 gap-6 overflow-x-hidden">
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
    <section className="grid min-w-0 gap-6 overflow-x-hidden">
      <PageTitle title="Auditoria" description="Eventos persistentes de autenticação, links, admin e segurança." />
      <Card className="min-w-0">
        <CardContent className="pt-6 overflow-hidden">{loading ? <AuditLogsSkeleton /> : <AuditLogsList logs={logs} />}</CardContent>
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
  const { toast } = useToast();

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
    try {
      await saveLink(editingLink?.id ?? null, input);
      setEditorOpen(false);
      setEditingLink(null);
      toast({
        title: editingLink ? "Link atualizado" : "Link criado",
        description: editingLink ? "As alterações foram salvas com sucesso." : "O novo link foi criado com sucesso."
      });
      refresh();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Erro ao salvar link.";
      toast({
        title: editingLink ? "Falha ao salvar link" : "Falha ao criar link",
        description: message
      });
      throw saveError instanceof Error ? saveError : new Error(message);
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
    <section className="grid min-w-0 gap-6 overflow-x-hidden" aria-busy={refreshing}>
      <PageTitle title={title} description={description} />

      <Card className="min-w-0">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button onClick={() => setEditorOpen(true)}>
              <Plus className="h-4 w-4" />
              Novo link
            </Button>
            <div className="hidden md:block">
              <FiltersBar filters={filters} onChange={setFilters} />
            </div>
            <div className="md:hidden">
              <MobileFiltersSheet filters={filters} onChange={setFilters} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid min-w-0 gap-4">
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

      <BulkActionsBar
        selectedCount={selectedIds.length}
        onActivate={() => toggleStatus(selectedIds, "activate")}
        onDeactivate={() => toggleStatus(selectedIds, "deactivate")}
        onExport={exportSelected}
        onDelete={async () => {
          await bulkAction({ ids: selectedIds, action: "delete" });
          setSelectedIds([]);
          refresh();
        }}
        onClear={() => setSelectedIds([])}
      />

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
          toast({
            title: "Link excluído",
            description: `${deleteTarget.alias} foi removido com sucesso.`
          });
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

function BulkActionsBar({
  selectedCount,
  onActivate,
  onDeactivate,
  onExport,
  onDelete,
  onClear
}: {
  selectedCount: number;
  onActivate: () => void;
  onDeactivate: () => void;
  onExport: () => void;
  onDelete: () => void | Promise<void>;
  onClear: () => void;
}) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-4 z-40 flex justify-center sm:bottom-6">
      <div
        data-testid="bulk-actions-bar"
        className="pointer-events-auto flex w-full max-w-[min(42rem,calc(100vw-1.5rem))] flex-wrap items-center justify-center gap-2 rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-lg sm:w-fit sm:justify-start"
      >
        <div className="flex min-w-0 items-center gap-2 pr-1 font-medium">
          <Badge className="shrink-0 bg-primary text-primary-foreground">{selectedCount}</Badge>
          <span className="whitespace-nowrap">selecionado{selectedCount === 1 ? "" : "s"}</span>
        </div>
        <Button size="sm" variant="outline" onClick={onActivate}>
          Ativar
        </Button>
        <Button size="sm" variant="outline" onClick={onDeactivate}>
          Desativar
        </Button>
        <Button size="sm" variant="outline" onClick={onExport}>
          <Upload className="h-4 w-4" />
          Exportar
        </Button>
        <Button size="sm" variant="destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
          Excluir
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={onClear} aria-label="Limpar seleção">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function EditorSection({
  title,
  icon,
  children,
  className
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("grid min-w-0 gap-4 rounded-lg border bg-muted/20 p-4", className)}>
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">{icon}</div>
        <h3 className="truncate text-sm font-semibold">{title}</h3>
      </div>
      <div className="grid min-w-0 gap-4">{children}</div>
    </section>
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
  const hasPassword = Boolean(initialLink?.passwordProtected);

  useEffect(() => {
    if (open) {
      setForm(stateFromLink(initialLink));
      setFormError(null);
    }
  }, [initialLink, open]);

  useEffect(() => {
    if (open && form.expiresPreset === "custom" && !form.expiresDate) {
      const now = new Date();
      setForm((current) => ({
        ...current,
        expiresDate: toDateInputValue(now),
        expiresTime: toTimeInputValue(now)
      }));
    }
  }, [form.expiresDate, form.expiresPreset, open]);

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
    <form className="grid min-w-0 gap-4" onSubmit={submit}>
      <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:items-start">
        <div className="grid min-w-0 gap-4">
          <EditorSection title="Destino" icon={<LinkIcon className="h-4 w-4" />}>
            <div className="grid min-w-0 gap-2">
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
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <div className="grid min-w-0 gap-2">
                <Label>Alias</Label>
                <Input
                  value={form.alias}
                  onChange={(event) => setForm((current) => ({ ...current, alias: event.target.value }))}
                  placeholder="Opcional"
                  disabled={mode === "edit"}
                />
              </div>
              <div className="grid min-w-0 gap-2">
                <Label>Título</Label>
                <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Opcional" />
              </div>
            </div>
            <div className="grid min-w-0 gap-2">
              <Label>Tags</Label>
              <Input value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} placeholder="portfolio, pessoal" />
            </div>
          </EditorSection>

          <EditorSection title="Proteção" icon={<Lock className="h-4 w-4" />}>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <div className="grid min-w-0 gap-2">
                <Label>Senha</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder={mode === "edit" ? "Nova senha (opcional)" : "Opcional"}
                />
              </div>
              <div className="grid min-w-0 gap-2">
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
            {mode === "edit" && hasPassword && (
              <div className="grid min-w-0 gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <Badge className="w-fit gap-1">
                  <Lock className="h-3 w-3" />
                  Senha definida
                </Badge>
                <Button
                  type="button"
                  variant={form.clearPassword ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => setForm((current) => ({ ...current, clearPassword: !current.clearPassword }))}
                  className="w-full sm:w-auto"
                >
                  <Trash2 className="h-4 w-4" />
                  {form.clearPassword ? "Senha será removida" : "Remover senha"}
                </Button>
              </div>
            )}
          </EditorSection>
        </div>

        <div className="grid min-w-0 gap-4">
          <EditorSection title="Regras" icon={<Clock3 className="h-4 w-4" />}>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <div className="grid min-w-0 gap-2">
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
              <div className="grid min-w-0 gap-2">
                <Label>Limite de cliques</Label>
                <Input type="number" min="1" value={form.clickLimit} onChange={(event) => setForm((current) => ({ ...current, clickLimit: event.target.value }))} />
              </div>
              <div className="grid min-w-0 gap-2">
                <Label>Inatividade (min)</Label>
                <Input type="number" min="1" value={form.inactiveMinutes} onChange={(event) => setForm((current) => ({ ...current, inactiveMinutes: event.target.value }))} />
              </div>
            </div>
            {form.expiresPreset === "custom" && (
              <DateTimePickerField
                date={form.expiresDate}
                time={form.expiresTime}
                onChange={(date, time) => setForm((current) => ({ ...current, expiresDate: date, expiresTime: time }))}
              />
            )}
          </EditorSection>

          <EditorSection title="Segmentação" icon={<Shield className="h-4 w-4" />}>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <CountryMultiSelectField
                label="Países permitidos"
                placeholder="Buscar e adicionar países"
                value={form.countryAllowlist}
                onChange={(value) => setForm((current) => ({ ...current, countryAllowlist: value }))}
              />
              <CountryMultiSelectField
                label="Países bloqueados"
                placeholder="Buscar e adicionar países"
                value={form.countryBlocklist}
                onChange={(value) => setForm((current) => ({ ...current, countryBlocklist: value }))}
              />
            </div>
          </EditorSection>

          <EditorSection title="Organização" icon={<Star className="h-4 w-4" />}>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <label className="flex min-h-10 items-center gap-3 rounded-md border bg-background px-3 py-2 text-sm">
                <Checkbox checked={form.favorite} onCheckedChange={(checked) => setForm((current) => ({ ...current, favorite: checked }))} />
                Favorito
              </label>
              <label className="flex min-h-10 items-center gap-3 rounded-md border bg-background px-3 py-2 text-sm">
                <Checkbox checked={form.pinned} onCheckedChange={(checked) => setForm((current) => ({ ...current, pinned: checked }))} />
                Fixar no topo
              </label>
            </div>
          </EditorSection>
        </div>
      </div>

      {formError && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>}
      <div className="flex flex-col-reverse gap-2 border-t pt-3 sm:flex-row sm:justify-end">
        <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Salvando" : mode === "create" ? "Criar link" : "Salvar alterações"}
        </Button>
      </div>
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
          <div className="px-4 pb-4">{content}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Novo link" : "Editar link"}</DialogTitle>
          <DialogDescription>Senha, expiração, país, tags e organização.</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}

function DateTimePickerField({
  date,
  time,
  onChange
}: {
  date: string;
  time: string;
  onChange: (date: string, time: string) => void;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(date ? new Date(`${date}T${time || "12:00"}`) : new Date()));

  useEffect(() => {
    if (open) {
      setViewMonth(startOfMonth(date ? new Date(`${date}T${time || "12:00"}`) : new Date()));
    }
  }, [date, open, time]);

  const selectedLabel = date && time ? formatDateTimeLabel(date, time) : "Selecionar data e hora";
  const days = useMemo(() => buildMonthDays(viewMonth), [viewMonth]);
  const weekDays = ["D", "S", "T", "Q", "Q", "S", "S"];
  const selectedDate = date ? new Date(`${date}T${time || "12:00"}`) : null;

  function selectDay(day: Date) {
    const nextDate = toDateInputValue(day);
    onChange(nextDate, time || "12:00");
  }

  function selectToday() {
    const now = new Date();
    onChange(toDateInputValue(now), toTimeInputValue(now));
  }

  const triggerButton = (
    <Button type="button" variant="outline" className="min-w-0 justify-between font-normal" onClick={() => isMobile && setOpen((current) => !current)}>
      <span className="flex min-w-0 items-center gap-2">
        <CalendarDays className="h-4 w-4 shrink-0" />
        <span className="truncate">{selectedLabel}</span>
      </span>
      <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Button>
  );

  const pickerPanel = (
    <div data-testid="date-time-picker-panel" className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-sm font-medium capitalize">
          {new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(viewMonth)}
        </div>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        {weekDays.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 place-items-center gap-1">
        {days.map((day, index) => (
          <Button
            key={`${day ? day.toISOString() : "empty"}-${index}`}
            type="button"
            variant={day && selectedDate && isSameDay(day, selectedDate) ? "default" : "ghost"}
            className="h-8 w-8 p-0 text-sm"
            disabled={!day}
            onClick={() => day && selectDay(day)}
          >
            {day ? day.getDate() : ""}
          </Button>
        ))}
      </div>
      <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <Input
          type="date"
          value={date}
          onChange={(event) => onChange(event.target.value, time || "12:00")}
        />
        <Input
          type="time"
          value={time}
          onChange={(event) => onChange(date || toDateInputValue(new Date()), event.target.value)}
        />
        <Button type="button" variant="outline" onClick={selectToday}>
          Agora
        </Button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            onChange("", "");
          }}
        >
          Limpar
        </Button>
        <Button type="button" onClick={() => setOpen(false)}>
          Fechar
        </Button>
      </div>
    </div>
  );

  return (
    <div className="grid min-w-0 gap-2">
      <Label>Expira em</Label>
      {isMobile ? (
        <>
          {triggerButton}
          {open && <div className="rounded-lg border bg-popover p-3 text-popover-foreground shadow-sm">{pickerPanel}</div>}
        </>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
          <PopoverContent align="start" collisionPadding={20} className="w-[min(20rem,calc(100vw-2rem))] p-3">
            {pickerPanel}
          </PopoverContent>
        </Popover>
      )}
      <p className="text-xs text-muted-foreground">Escolha uma data no calendário e ajuste o horário no painel.</p>
    </div>
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
  const tableMinWidth = showOwner ? "min-w-[980px]" : "min-w-[860px]";

  function signalLabels(link: LinkSummary): string[] {
    return [
      link.favorite ? "Favorito" : null,
      link.pinned ? "Fixado" : null,
      link.safetyStatus !== "clean" ? link.safetyStatus : null,
      link.countryAllowlist.length > 0 ? `+${link.countryAllowlist.join(",")}` : null,
      link.countryBlocklist.length > 0 ? `-${link.countryBlocklist.join(",")}` : null
    ].filter((value): value is string => Boolean(value));
  }

  return (
    <div data-testid="links-list" className="grid min-w-0 gap-3">
      <div className="grid min-w-0 gap-3 md:hidden">
        {links.map((link) => (
          <div key={link.id} className="grid gap-3 overflow-hidden rounded-md border p-3 text-sm">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <label className="flex min-w-0 flex-1 items-start gap-2">
                {onToggleSelected && <Checkbox checked={selectedIds.includes(link.id)} onCheckedChange={() => onToggleSelected(link.id)} className="mt-1" />}
                <div className="min-w-0 flex-1">
                  <a className="block truncate font-medium text-primary underline-offset-4 hover:underline" href={`${publicOrigin}/${link.alias}`} target="_blank" rel="noreferrer">
                    {publicHostname}/{link.alias}
                  </a>
                  {link.title && <div className="truncate text-xs text-muted-foreground">{link.title}</div>}
                </div>
              </label>
              <div className="flex shrink-0 items-center gap-1">
                <CopyLinkButton value={`${publicOrigin}/${link.alias}`} />
                {onEdit && <MiniActionButton icon={<PencilLine className="h-4 w-4" />} label="Editar" onClick={() => onEdit(link)} />}
                {onRequestQr && <MiniActionButton icon={<QrCode className="h-4 w-4" />} label="QR Code" onClick={() => onRequestQr(link)} />}
              </div>
            </div>
            <div className="break-words text-xs text-muted-foreground">{link.destinationUrl}</div>
            <div className="flex flex-col items-start gap-2 text-xs">
              <Badge className="w-fit">{linkStatusLabel(link.status)}</Badge>
              <Badge className="w-fit">{link.clickCount} cliques</Badge>
              {link.passwordProtected && (
                <Badge className="w-fit">
                  <Lock className="mr-1 h-3 w-3" />
                  Senha
                </Badge>
              )}
              {showOwner && <Badge className="w-fit max-w-full truncate">{link.ownerEmail ?? shortId(link.ownerId)}</Badge>}
            </div>
            <div className="flex flex-col items-start gap-1 overflow-visible pb-0.5 pr-1">
              {signalLabels(link).slice(0, 3).map((signal) => (
                <Badge key={signal} className="w-fit max-w-full leading-5">
                  {signal}
                </Badge>
              ))}
              {signalLabels(link).length > 3 && <Badge className="w-fit leading-5">...</Badge>}
            </div>
            <div className="flex flex-wrap gap-2">
              {onToggleFavorite && (
                <MiniActionButton
                  icon={link.favorite ? <StarOff className="h-4 w-4" /> : <Star className="h-4 w-4" />}
                  label={link.favorite ? "Desfavoritar" : "Favoritar"}
                  onClick={() => onToggleFavorite(link)}
                />
              )}
              {onTogglePinned && (
                <MiniActionButton
                  icon={link.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  label={link.pinned ? "Desafixar" : "Fixar"}
                  onClick={() => onTogglePinned(link)}
                />
              )}
              {onRequestDelete && (
                <MiniActionButton icon={<Trash2 className="h-4 w-4" />} label="Excluir" onClick={() => onRequestDelete(link)} variant="destructive" />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden min-w-0 md:block">
        <div className="rounded-md border">
          <Table className={`${tableMinWidth} table-fixed`}>
            <TableHeader>
              <TableRow>
                {onToggleSelected && <TableHead className="w-10" />}
                <TableHead className="w-[12rem]">Curto</TableHead>
                <TableHead className="w-[14rem]">Destino</TableHead>
                {showOwner && <TableHead className="w-[12rem]">Dono</TableHead>}
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-24">Cliques</TableHead>
                <TableHead className="w-28">Sinais</TableHead>
                {hasActions && <TableHead className="w-20 text-center">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.map((link) => (
                <TableRow key={link.id}>
                  {onToggleSelected && (
                    <TableCell>
                      <Checkbox checked={selectedIds.includes(link.id)} onCheckedChange={() => onToggleSelected(link.id)} />
                    </TableCell>
                  )}
                  <TableCell className="min-w-0 overflow-hidden font-medium">
                    <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                      <a className="block min-w-0 truncate text-primary underline-offset-4 hover:underline" href={`${publicOrigin}/${link.alias}`} target="_blank" rel="noreferrer">
                        {publicHostname}/{link.alias}
                      </a>
                      <CopyLinkButton value={`${publicOrigin}/${link.alias}`} />
                    </div>
                    {link.title && <div className="text-xs font-normal text-muted-foreground">{link.title}</div>}
                  </TableCell>
                  <TableCell className="min-w-0 overflow-hidden">
                    <div className="block w-full truncate">{link.destinationUrl}</div>
                  </TableCell>
                  {showOwner && (
                    <TableCell className="min-w-0 overflow-hidden">
                      <div className="block w-full truncate">{link.ownerEmail ?? shortId(link.ownerId)}</div>
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="w-fit shrink-0">{linkStatusLabel(link.status)}</Badge>
                      {link.passwordProtected && (
                        <Badge className="w-fit shrink-0">
                          <Lock className="mr-1 h-3 w-3" />
                          Senha
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{link.clickCount}</TableCell>
                  <TableCell>
                    <div className="flex max-w-28 flex-col items-start gap-1 overflow-visible pb-0.5 pr-1">
                      {signalLabels(link).slice(0, 3).map((signal) => (
                        <Badge key={signal} className="w-fit max-w-full leading-5">
                          {signal}
                        </Badge>
                      ))}
                      {signalLabels(link).length > 3 && <Badge className="w-fit leading-5">...</Badge>}
                    </div>
                  </TableCell>
                  {hasActions && (
                    <TableCell className="whitespace-nowrap px-5">
                      <div className="flex justify-center">
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon-sm" variant="ghost" aria-label="Abrir ações do link">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-44">
                            {onEdit && (
                              <DropdownMenuItem onClick={() => onEdit(link)}>
                                <PencilLine className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                            )}
                            {onToggleFavorite && (
                              <DropdownMenuItem onClick={() => onToggleFavorite(link)}>
                                {link.favorite ? <StarOff className="mr-2 h-4 w-4" /> : <Star className="mr-2 h-4 w-4" />}
                                {link.favorite ? "Desfavoritar" : "Favoritar"}
                              </DropdownMenuItem>
                            )}
                            {onTogglePinned && (
                              <DropdownMenuItem onClick={() => onTogglePinned(link)}>
                                {link.pinned ? <PinOff className="mr-2 h-4 w-4" /> : <Pin className="mr-2 h-4 w-4" />}
                                {link.pinned ? "Desafixar" : "Fixar"}
                              </DropdownMenuItem>
                            )}
                            {onRequestQr && (
                              <DropdownMenuItem onClick={() => onRequestQr(link)}>
                                <QrCode className="mr-2 h-4 w-4" />
                                QR Code
                              </DropdownMenuItem>
                            )}
                            {onRequestDelete && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onClick={() => onRequestDelete(link)}>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Excluir
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
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
    <Card className="min-w-0">
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
        {loading ? <BlocklistSkeleton /> : <div className="grid min-w-0 gap-3">{blockedDomains.map((entry) => <BlocklistRow key={entry.domain} entry={entry} onRemove={() => remove(entry.domain)} />)}</div>}
      </CardContent>
    </Card>
  );
}

function UsersTable({ users, loading }: { users: User[]; loading: boolean }) {
  return (
    <Card className="min-w-0">
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
      <div className="grid min-w-0 gap-3 md:hidden">
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
      <div className="hidden min-w-0 md:block">
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
      <div className="grid min-w-0 gap-3 md:hidden">
        {logs.map((log) => (
          <div key={log.id} className="grid gap-2 overflow-hidden rounded-md border p-3 text-sm">
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
      <div className="hidden min-w-0 md:block">
        <Table className="min-w-[900px] table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">Quando</TableHead>
              <TableHead className="w-44">Ação</TableHead>
              <TableHead className="w-28">Ator</TableHead>
              <TableHead className="w-40">Entidade</TableHead>
              <TableHead>Dados</TableHead>
              <TableHead className="w-28">Severidade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="truncate">{new Date(log.occurredAt).toLocaleString()}</TableCell>
                <TableCell className="truncate">{log.action}</TableCell>
                <TableCell>{log.actorUserId ? shortId(log.actorUserId) : "Sistema"}</TableCell>
                <TableCell className="truncate">
                  <span>
                    {log.entityType}
                    {log.entityId ? `/${shortId(log.entityId)}` : ""}
                  </span>
                </TableCell>
                <TableCell className="min-w-0">
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
    <div className="grid min-w-0 gap-3 rounded-md border p-3">
      <div className="grid min-w-0 gap-3 md:hidden">
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
      <div className="hidden min-w-0 md:block">
        <Table className={`${showOwner ? "min-w-[980px]" : "min-w-[860px]"} table-fixed`}>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Skeleton className="h-4 w-4" />
              </TableHead>
              <TableHead className="w-[12rem]">Curto</TableHead>
              <TableHead className="w-[14rem]">Destino</TableHead>
              {showOwner && <TableHead className="w-[12rem]">Dono</TableHead>}
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-24">Cliques</TableHead>
              <TableHead className="w-28">Sinais</TableHead>
              {hasActions && <TableHead className="w-20 text-center">Ações</TableHead>}
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
                  <div className="flex flex-col items-start gap-1">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </TableCell>
                {hasActions && (
                  <TableCell>
                    <div className="flex justify-center">
                      <Skeleton className="h-8 w-8 rounded-md" />
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
    <Card className="min-w-0">
      <CardHeader>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-24" />
      </CardHeader>
    </Card>
  );
}

function AuditLogsSkeleton() {
  return (
    <div className="grid min-w-0 gap-3">
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
    <div className="grid min-w-0 gap-3">
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

function CountryMultiSelectField({
  label,
  placeholder,
  value,
  onChange
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const selected = useMemo(() => parseDelimited(value).map((item) => item.toUpperCase()), [value]);
  const suggestionMap = useMemo(() => new Map(COUNTRY_SUGGESTIONS.map((country) => [country.code, country])), []);
  const queryLower = query.trim().toLowerCase();
  const suggestions = useMemo(() => {
    return COUNTRY_SUGGESTIONS.filter((country) => {
      if (selected.includes(country.code)) {
        return false;
      }
      if (!queryLower) {
        return true;
      }
      return country.code.toLowerCase().includes(queryLower) || country.label.toLowerCase().includes(queryLower);
    }).slice(0, 8);
  }, [queryLower, selected]);

  function addCountry(code: string) {
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(normalized) || selected.includes(normalized)) {
      setQuery("");
      return;
    }

    const next = [...selected, normalized];
    onChange(next.join(", "));
    setQuery("");
  }

  function removeCountry(code: string) {
    onChange(selected.filter((item) => item !== code).join(", "));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !query && selected.length > 0) {
      event.preventDefault();
      removeCountry(selected[selected.length - 1]);
      return;
    }

    if (event.key !== "Enter" && event.key !== "," && event.key !== "Tab") {
      return;
    }

    const candidate = suggestions[0]?.code ?? query.trim();
    if (!candidate) {
      return;
    }

    event.preventDefault();
    addCountry(candidate);
  }

  return (
    <div className="grid min-w-0 gap-2">
      <Label>{label}</Label>
      <div className="min-h-11 rounded-md border bg-background px-2 py-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {selected.map((code) => {
            const item = suggestionMap.get(code);
            return (
              <Badge key={code} className="inline-flex h-7 max-w-full items-center gap-1 pr-1">
                <span className="truncate">
                  {code}
                  {item ? ` · ${item.label}` : ""}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="ml-0.5 h-5 w-5 shrink-0 rounded-sm text-muted-foreground hover:text-foreground"
                  onClick={() => removeCountry(code)}
                  aria-label={`Remover ${code}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            );
          })}
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            placeholder={selected.length === 0 ? placeholder : "Adicionar país"}
            className="h-7 min-w-28 flex-1 border-0 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
            autoCapitalize="characters"
            autoCorrect="off"
          />
        </div>
        {query.trim() && suggestions.length > 0 && (
          <div className="mt-2 max-h-52 overflow-auto rounded-md border bg-popover p-1 shadow-sm">
            {suggestions.map((country) => (
              <button
                key={country.code}
                type="button"
                className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => addCountry(country.code)}
              >
                <span>{country.label}</span>
                <span className="text-xs text-muted-foreground">{country.code}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Selecione vários países. Digite um código ou o nome para filtrar.</p>
    </div>
  );
}

function UsersTableSkeleton() {
  return (
    <div className="grid min-w-0 gap-3">
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
  onClick,
  variant = "ghost"
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  variant?: React.ComponentProps<typeof Button>["variant"];
}) {
  return (
    <Button variant={variant} size="icon" className="h-8 w-8" onClick={onClick} aria-label={label}>
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
    <div className="flex max-w-full flex-wrap items-start gap-1.5 overflow-hidden">
      {entries.map(([key, value]) => (
        <Badge key={key} className="w-fit max-w-full">
          <span className="truncate">
            {key}: {String(value)}
          </span>
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
      expiresDate: "",
      expiresTime: "",
      clickLimit: "",
      inactiveMinutes: "",
      countryAllowlist: "",
      countryBlocklist: "",
      favorite: false,
      pinned: false
    };
  }

  const expiresParts = link.expiresAt ? toLocalDateParts(link.expiresAt) : null;

  return {
    destinationUrl: link.destinationUrl,
    alias: link.alias,
    title: link.title ?? "",
    tags: link.tags.join(", "),
    password: "",
    clearPassword: false,
    redirectCode: link.redirectCode === 301 ? "301" : "302",
    expiresPreset: link.expiresAt ? "custom" : "none",
    expiresDate: expiresParts?.date ?? "",
    expiresTime: expiresParts?.time ?? "",
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
    expiresAt: computeExpiresAt(form.expiresPreset, form.expiresDate, form.expiresTime),
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

function computeExpiresAt(preset: LinkFormState["expiresPreset"], date: string, time: string): string | null {
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
  return date && time ? new Date(`${date}T${time}`).toISOString() : null;
}

function toLocalDateParts(value: string): { date: string; time: string } {
  const date = new Date(value);
  const pad = (number: number) => String(number).padStart(2, "0");
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`
  };
}

function toDateInputValue(value: Date): string {
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function toTimeInputValue(value: Date): string {
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function formatDateTimeLabel(date: string, time: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(`${date}T${time}`));
}

function startOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function buildMonthDays(month: Date): Array<Date | null> {
  const start = startOfMonth(month);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const leadingDays = start.getDay();
  const cells: Array<Date | null> = [];

  for (let index = 0; index < leadingDays; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function isSameDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
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
  expiresDate: string;
  expiresTime: string;
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
