import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../auth/auth-context';

export function RequireAuth() {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === 'loading') {
    return <div className="page-message">Проверка сессии…</div>;
  }

  if (state.status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

export function RedirectIfAuthenticated() {
  const { state } = useAuth();

  if (state.status === 'loading') {
    return <div className="page-message">Загрузка…</div>;
  }

  if (state.status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
