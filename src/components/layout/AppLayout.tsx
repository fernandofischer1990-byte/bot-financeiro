import { Suspense } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { OnboardingDialog } from '@/components/onboarding/OnboardingDialog';
import { AppSidebar, NAV_ITEMS, pathForTab } from '@/components/layout/AppSidebar';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Loader2, LogOut, Moon, Sun } from 'lucide-react';

export function AppLayout() {
  const { signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const activeLabel = NAV_ITEMS.find((i) => i.path === pathname)?.label ?? 'FinBot';

  return (
    <SidebarProvider>
      <OnboardingDialog onNavigate={(tab) => navigate(pathForTab(tab))} />
      <div className="min-h-dvh flex w-full bg-background">
        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 h-14 flex items-center justify-between gap-3 px-3 lg:px-6 border-b bg-card/80 backdrop-blur no-print">
            <div className="flex items-center gap-2 min-w-0">
              <SidebarTrigger className="hidden lg:flex" />
              <h1 className="font-semibold text-base lg:text-lg truncate">{activeLabel}</h1>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggle}
                aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
                title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sair">
                <LogOut className="h-4 w-4 lg:mr-2" />
                <span className="hidden lg:inline">Sair</span>
              </Button>
            </div>
          </header>

          <main className="flex-1 container mx-auto px-3 lg:px-6 py-4 lg:py-6 pb-24 lg:pb-6">
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-24">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </main>

          <BottomNav />
        </div>
      </div>
    </SidebarProvider>
  );
}
