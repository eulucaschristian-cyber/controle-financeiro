import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { LayoutDashboard, PlusCircle, Settings, LogOut, PanelLeft, Wallet, Users, TrendingUp, CreditCard, BarChart3, Upload, ScanLine } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: PlusCircle, label: "Novo Gasto", path: "/add" },
  { icon: ScanLine, label: "Scan Comprovante", path: "/scan" },
  { icon: TrendingUp, label: "Renda", path: "/income" },
  { icon: CreditCard, label: "Cartão", path: "/credit-card" },
  { icon: BarChart3, label: "Relatórios", path: "/reports" },
  { icon: Upload, label: "Importar Fatura", path: "/import" },
  { icon: Users, label: "Família", path: "/family" },
  { icon: Settings, label: "Configurações", path: "/settings" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-8 p-8 max-w-sm w-full">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Wallet className="h-8 w-8 text-primary" />
          </div>
          <div className="flex flex-col items-center gap-3 text-center">
            <h1 className="text-2xl font-bold tracking-tight">
              Controle de Gastos
            </h1>
            <p className="text-sm text-muted-foreground max-w-xs">
              Gerencie seu orçamento diário de forma simples e eficiente. Controle seus gastos e veja seu saldo acumulado em tempo real.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all h-12 text-base font-semibold"
          >
            Entrar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          {/* Header da Sidebar */}
          <SidebarHeader className="h-16 justify-center border-b border-sidebar-border/60">
            <div className="flex items-center gap-3 px-3 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-colors focus:outline-none shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-sidebar-foreground/60" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
                    <Wallet className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold tracking-tight truncate text-sidebar-foreground text-sm block">
                      Finanças
                    </span>
                    <span className="text-[10px] text-sidebar-foreground/50 truncate block">
                      Controle Pessoal
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          {/* Menu Items */}
          <SidebarContent className="gap-0 py-3">
            <SidebarMenu className="px-2 gap-0.5">
              {menuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-9 rounded-lg transition-all font-normal text-sm
                        ${isActive
                          ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        }`}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          {/* Footer com usuário */}
          <SidebarFooter className="p-3 border-t border-sidebar-border/60">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-sidebar-accent transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none">
                  <Avatar className="h-8 w-8 shrink-0 ring-2 ring-primary/30">
                    <AvatarFallback className="text-xs font-bold bg-primary/20 text-primary">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-xs font-semibold truncate leading-none text-sidebar-foreground">
                      {user?.name || "-"}
                    </p>
                    <p className="text-[10px] text-sidebar-foreground/50 truncate mt-1">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Resize handle */}
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/30 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {/* Mobile top bar */}
        {isMobile && (
          <div className="flex h-14 items-center justify-between bg-card/80 px-3 backdrop-blur-md border-b border-border/50 sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-9 w-9 rounded-xl bg-card border border-border/50 shadow-sm" />
              <span className="font-semibold text-foreground">
                {activeMenuItem?.label ?? "Menu"}
              </span>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 max-w-2xl mx-auto w-full">{children}</main>

        {/* Mobile FAB */}
        {isMobile && location === "/" && (
          <button
            onClick={() => setLocation("/add")}
            className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center z-50 active:scale-95"
          >
            <PlusCircle className="h-7 w-7" />
          </button>
        )}
      </SidebarInset>
    </>
  );
}
