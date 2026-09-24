import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../auth/auth-context';

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/users', label: 'Users' },
  { to: '/ai', label: 'AI Usage' },
  { to: '/settings', label: 'Settings' },
] as const;

export function AdminLayout() {
  const { state, logout } = useAuth();
  const admin = state.status === 'authenticated' ? state.admin : null;

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="brand-block">
          <div className="brand-title">ПРИКИНЬ</div>
          <div className="brand-subtitle">Admin</div>
        </div>
        <nav className="admin-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : false}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="admin-main">
        <header className="admin-header">
          <div className="header-meta">
            {admin ? (
              <>
                <span className="header-email">{admin.email}</span>
                <span className="role-pill">{admin.role}</span>
              </>
            ) : null}
          </div>
          <button type="button" className="button-secondary" onClick={() => void logout()}>
            Выйти
          </button>
        </header>
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
