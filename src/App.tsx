import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { CheckpointsPage } from './pages/CheckpointsPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { IncidentsPage } from './pages/IncidentsPage';
import { LogsPage } from './pages/LogsPage';
import { ScanPage } from './pages/ScanPage';
import { UsersPage } from './pages/UsersPage';
import { RoutesPage } from './pages/RoutesPage';
import { PatrolFlowPage } from './pages/PatrolFlowPage';
import { LiveMonitorPage } from './pages/LiveMonitorPage';
import { SessionHistoryPage } from './pages/SessionHistoryPage';
import { SessionDetailPage } from './pages/SessionDetailPage';
import { WhatsAppConfigPage } from './pages/WhatsAppConfigPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected layout shell */}
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="scan" element={<ScanPage />} />
            <Route path="patrol" element={<PatrolFlowPage />} />
            <Route path="incidents" element={<IncidentsPage />} />
            <Route path="sessions/:id" element={<SessionDetailPage />} />

            {/* Admin-only routes */}
            <Route
              path="whatsapp"
              element={
                <RequireAuth role="ADMIN">
                  <WhatsAppConfigPage />
                </RequireAuth>
              }
            />
            <Route
              path="checkpoints"
              element={
                <RequireAuth role="ADMIN">
                  <CheckpointsPage />
                </RequireAuth>
              }
            />
            <Route
              path="routes"
              element={
                <RequireAuth role="ADMIN">
                  <RoutesPage />
                </RequireAuth>
              }
            />
            <Route
              path="monitor"
              element={
                <RequireAuth role="ADMIN">
                  <LiveMonitorPage />
                </RequireAuth>
              }
            />
            <Route
              path="sessions"
              element={
                <RequireAuth role="ADMIN">
                  <SessionHistoryPage />
                </RequireAuth>
              }
            />
            <Route
              path="logs"
              element={
                <RequireAuth role="ADMIN">
                  <LogsPage />
                </RequireAuth>
              }
            />
            <Route
              path="users"
              element={
                <RequireAuth role="ADMIN">
                  <UsersPage />
                </RequireAuth>
              }
            />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

