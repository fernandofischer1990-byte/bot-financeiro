import { useAuth } from '@/hooks/useAuth';
import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { useFinancialMetrics } from '@/hooks/useFinancialMetrics';
import { AuthPage } from '@/components/auth/AuthPage';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { ImportWizard } from '@/components/import/ImportWizard';
import { InvestmentsTab } from '@/components/investments/InvestmentsTab';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, LogOut, Wallet, LayoutDashboard, MessageSquare, Plus, Upload, Briefcase } from 'lucide-react';

export default function Index() {
  const { user, loading: authLoading, signOut } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <AuthenticatedApp signOut={signOut} />;
}

function AuthenticatedApp({ signOut }: { signOut: () => Promise<void> }) {
  const { 
    filteredTransactions,
    metrics, 
    initialLoading,
    hasLoadedOnce,
    loadError,
    filters,
    setFilters,
    deleteTransaction, 
    updateTransaction,
    refetch,
  } = useTransactionsContext();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary rounded-lg">
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl">FinBot</span>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-5">
            <TabsTrigger value="dashboard" className="flex items-center gap-1.5">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="investments" className="flex items-center gap-1.5">
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">Investimentos</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Chat</span>
            </TabsTrigger>
            <TabsTrigger value="add" className="flex items-center gap-1.5">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Adicionar</span>
            </TabsTrigger>
            <TabsTrigger value="import" className="flex items-center gap-1.5">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Importar</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
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
            />
          </TabsContent>

          <TabsContent value="investments">
            <InvestmentsTab />
          </TabsContent>

          <TabsContent value="chat" className="h-[calc(100vh-200px)]">
            <ChatInterface />
          </TabsContent>

          <TabsContent value="add">
            <div className="max-w-md mx-auto">
              <TransactionForm />
            </div>
          </TabsContent>

          <TabsContent value="import">
            <ImportWizard />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
