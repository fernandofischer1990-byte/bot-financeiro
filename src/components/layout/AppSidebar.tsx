import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Briefcase, MessageSquare, Plus, Upload, FileBarChart, Wallet, History } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';

export interface NavSection {
  value: string;
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: NavSection[] = [
  { value: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { value: 'investments', path: '/investimentos', label: 'Investimentos', icon: Briefcase },
  { value: 'chat', path: '/chat', label: 'Chat', icon: MessageSquare },
  { value: 'add', path: '/adicionar', label: 'Adicionar', icon: Plus },
  { value: 'import', path: '/importar', label: 'Importar', icon: Upload },
  { value: 'reports', path: '/relatorios', label: 'Relatórios', icon: FileBarChart },
  { value: 'history', path: '/historico', label: 'Histórico', icon: History },
];

/** Resolve o caminho de uma aba legada (`dashboard`, `add`, …) para a rota real. */
export function pathForTab(tab: string): string {
  return NAV_ITEMS.find((i) => i.value === tab)?.path ?? '/dashboard';
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="p-2 rounded-lg gradient-primary shadow-elegant shrink-0">
            <Wallet className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && <span className="font-bold text-base text-sidebar-foreground">FinBot</span>}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.value}>
                    <NavLink to={item.path}>
                      {({ isActive }) => (
                        <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                          <span>
                            <Icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </span>
                        </SidebarMenuButton>
                      )}
                    </NavLink>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
