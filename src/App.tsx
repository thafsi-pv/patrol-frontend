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
            <Route path="incidents" element={<IncidentsPage />} />

            {/* Admin-only routes */}
            <Route
              path="checkpoints"
              element={
                <RequireAuth role="ADMIN">
                  <CheckpointsPage />
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
