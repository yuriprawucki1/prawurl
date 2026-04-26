import { useEffect, useState } from "react";
import {
  BarChart3,
  ChevronsUpDown,
  Command,
  LinkIcon,
  LogOut,
  Moon,
  Shield,
  Sun
} from "lucide-react";
import type * as React from "react";
import type { SessionUser, User } from "../../shared/contracts";
import { api } from "../lib/api";
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
  useSidebar
} from "../components/ui/sidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../components/ui/dropdown-menu";
import { TooltipProvider } from "../components/ui/tooltip";
import { Theme } from "./theme";
import { FullScreenMessage } from "./full-screen-message";
import { LoginPage } from "./login-page";
import { AdminView, AnalyticsView, AuditLogsView, LinksView } from "./dashboard-views";

type View = "links" | "analytics" | "admin" | "logs";

export function DashboardApp({
  theme,
  onToggleTheme,
  publicOrigin
}: {
  theme: Theme;
  onToggleTheme: () => void;
  publicOrigin: string;
}) {
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
    return <LoginPage theme={theme} onToggleTheme={onToggleTheme} publicOrigin={publicOrigin} />;
  }

  return (
    <TooltipProvider delayDuration={100}>
      <SidebarProvider className="overflow-x-hidden">
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
                      <span className="truncate font-medium">{session.user.name ?? session.user.email}</span>
                      <span className="truncate text-xs text-sidebar-foreground/80">{session.user.email}</span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>

                <UserMenuContent session={session} theme={theme} onToggleTheme={onToggleTheme} publicOrigin={publicOrigin} />
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
        </Sidebar>

        <SidebarInset>
          <header className="sticky top-0 z-20 flex h-12 items-center bg-background/95 px-3 backdrop-blur md:h-8 md:px-2">
            <SidebarTrigger className="h-9 w-9 p-0 md:h-6 md:w-6 [&_svg]:h-4 [&_svg]:w-4 md:[&_svg]:h-3.5 md:[&_svg]:w-3.5" />
          </header>

          <main className="min-w-0 max-w-full flex-1 overflow-x-hidden p-3 pt-2 md:p-8 md:pt-4">
            {view === "links" && <LinksView />}
            {view === "analytics" && <AnalyticsView />}
            {view === "admin" && session.user.role === "admin" && <AdminView />}
            {view === "logs" && session.user.role === "admin" && <AuditLogsView />}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

function UserMenuContent({
  session,
  theme,
  onToggleTheme,
  publicOrigin
}: {
  session: SessionUser;
  theme: Theme;
  onToggleTheme: () => void;
  publicOrigin: string;
}) {
  const { isMobile, setOpenMobile } = useSidebar();

  function logout() {
    api.logout().finally(() => {
      setOpenMobile(false);
      window.location.href = publicOrigin;
    });
  }

  return (
    <DropdownMenuContent
      side={isMobile ? "top" : "right"}
      align={isMobile ? "start" : "end"}
      sideOffset={8}
      className={isMobile ? "w-[calc(100vw-2rem)] p-2" : "w-56"}
    >
      <DropdownMenuLabel className={isMobile ? "grid gap-1.5 px-2 py-3" : "grid gap-1"}>
        <span className="block truncate text-sm font-medium">{session.user.name ?? session.user.email}</span>
        <span className="block break-all text-xs font-normal text-muted-foreground" x-apple-data-detectors="false">
          {session.user.email}
        </span>
      </DropdownMenuLabel>

      <DropdownMenuItem className={isMobile ? "py-3 text-base" : undefined} onClick={onToggleTheme}>
        {theme === "dark" ? <Sun className="mr-2 size-4" /> : <Moon className="mr-2 size-4" />}
        {theme === "dark" ? "Tema claro" : "Tema escuro"}
      </DropdownMenuItem>

      <DropdownMenuSeparator />

      <DropdownMenuItem className={isMobile ? "py-3 text-base text-destructive focus:text-destructive" : "text-destructive focus:text-destructive"} onClick={logout}>
        <LogOut className="mr-2 size-4" />
        Sair
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}

function Avatar({ user }: { user: User }) {
  const fallback = (user.name ?? user.email).slice(0, 2).toUpperCase();

  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" referrerPolicy="no-referrer" />;
  }

  return <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">{fallback}</div>;
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
