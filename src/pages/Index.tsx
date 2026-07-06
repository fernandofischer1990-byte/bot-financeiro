import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { useFinancialMetrics } from '@/hooks/useFinancialMetrics';
import { useTheme } from '@/hooks/useTheme';
import { AuthPage } from '@/components/auth/AuthPage';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { ImportWizard } from '@/components/import/ImportWizard';
import { InvestmentsTab } from '@/components/investments/InvestmentsTab';
import { ReportsTab } from '@/components/reports/ReportsTab';
import { OnboardingDialog } from '@/components/onboarding/OnboardingDialog';
import { AppSidebar, NAV_ITEMS } from '@/components/layout/AppSidebar';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Loader2, LogOut, Moon, Sun } from 'lucide-react';

export default function Index() {
  const { user, loading: authLoading, signOut } = useAuth();

  // After sign-in, honor a same-origin `?next=` redirect (used by the OAuth consent page).
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next');
    if (next && next.startsWith('/') && !next.startsWith('//')) {
      window.location.replace(next);
    }
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <AuthPage />;
  return <AuthenticatedApp signOut={signOut} />;
}

function AuthenticatedApp({ signOut }: { signOut: () => Promise<void> }) {
  const {
    filteredTransactions,
    initialLoading,
    hasLoadedOnce,
    loadError,
    filters,
    setFilters,
    deleteTransaction,
    updateTransaction,
    refetch,
  } = useTransactionsContext();
  const { metrics } = useFinancialMetrics();
  const { theme, toggle } = useTheme();
  const [activeTab, setActiveTab] = useState('dashboard');

  const activeLabel = NAV_ITEMS.find((i) => i.value === activeTab)?.label ?? 'FinBot';

  return (
    <SidebarProvider>
      <OnboardingDialog onNavigate={setActiveTab} />
      <div className="min-h-dvh flex w-full bg-background">
        <AppSidebar activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
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

          {/* Main */}
          <main className="flex-1 container mx-auto px-3 lg:px-6 py-4 lg:py-6 pb-24 lg:pb-6">
            {activeTab === 'dashboard' && (
              <Dashboard
                metrics={metrics}
                transactions={filteredTransactions}
                loading={initialLoading || !hasLoadedOnce}
                loadError={loadError}
                filters={filters}
                onFiltersChange={setFilters}
                onDeleteTransaction={deleteTransaction}
                onUpdateTransaction={updateTransaction}
                onRetry={refetch}
                onNavigate={setActiveTab}
              />
            )}
            {activeTab === 'investments' && <InvestmentsTab />}
            {activeTab === 'chat' && (
              <div className="h-[calc(100dvh-9rem)] lg:h-[calc(100dvh-7rem)]">
                <ChatInterface />
              </div>
            )}
            {activeTab === 'add' && (
              <div className="max-w-md mx-auto">
                <TransactionForm />
              </div>
            )}
            {activeTab === 'import' && <ImportWizard />}
            {activeTab === 'reports' && <ReportsTab />}
          </main>

          <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
      </div>
    </SidebarProvider>
  );
}
