import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Briefcase, MessageSquare, Plus, Upload, FileBarChart, Wallet } from 'lucide-react';
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
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: NavSection[] = [
  { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { value: 'investments', label: 'Investimentos', icon: Briefcase },
  { value: 'chat', label: 'Chat', icon: MessageSquare },
  { value: 'add', label: 'Adicionar', icon: Plus },
  { value: 'import', label: 'Importar', icon: Upload },
  { value: 'reports', label: 'Relatórios', icon: FileBarChart },
];

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (v: string) => void;
}

export function AppSidebar({ activeTab, onTabChange }: AppSidebarProps) {
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
                const isActive = activeTab === item.value;
                return (
                  <SidebarMenuItem key={item.value}>
                    <SidebarMenuButton
                      onClick={() => onTabChange(item.value)}
                      isActive={isActive}
                      tooltip={item.label}
                      className="cursor-pointer"
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
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
