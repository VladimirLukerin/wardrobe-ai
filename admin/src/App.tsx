import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider } from './auth/auth-context';
import { RedirectIfAuthenticated, RequireAuth } from './auth/require-auth';
import { AdminLayout } from './layouts/admin-layout';
import { DashboardPage } from './pages/dashboard-page';
import { LoginPage } from './pages/login-page';
import { PlaceholderPage } from './pages/placeholder-page';
import { UserDetailPage } from './pages/user-detail-page';
import { UsersPage } from './pages/users-page';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<RedirectIfAuthenticated />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          <Route element={<RequireAuth />}>
            <Route element={<AdminLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="users/:id" element={<UserDetailPage />} />
              <Route path="ai" element={<PlaceholderPage title="AI Usage" />} />
              <Route path="settings" element={<PlaceholderPage title="Settings" />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
