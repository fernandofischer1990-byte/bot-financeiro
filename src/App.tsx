import { lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { TransactionsProvider } from "@/contexts/TransactionsContext";
import { InvestmentsProvider } from "@/contexts/InvestmentsContext";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import NotFound from "./pages/NotFound";

import OAuthConsent from "./pages/OAuthConsent";

// Code-splitting por rota: mantém o chunk inicial enxuto (recharts/xlsx só entram sob demanda).
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const InvestmentsPage = lazy(() => import("./pages/InvestmentsPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const AddTransactionPage = lazy(() => import("./pages/AddTransactionPage"));
const ImportPage = lazy(() => import("./pages/ImportPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const HistoryPage = lazy(() => import("./pages/HistoryPage"));

const App = () => (
  <ThemeProvider>
    <AuthProvider>
      <TransactionsProvider>
        <InvestmentsProvider>
          <TooltipProvider>
            <Toaster />
            <BrowserRouter>
              <Routes>
                <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
                <Route element={<RequireAuth />}>
                  <Route element={<AppLayout />}>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/investimentos" element={<InvestmentsPage />} />
                    <Route path="/chat" element={<ChatPage />} />
                    <Route path="/adicionar" element={<AddTransactionPage />} />
                    <Route path="/importar" element={<ImportPage />} />
                    <Route path="/relatorios" element={<ReportsPage />} />
                    <Route path="/historico" element={<HistoryPage />} />
                  </Route>
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </InvestmentsProvider>
      </TransactionsProvider>
    </AuthProvider>
  </ThemeProvider>
);

export default App;
