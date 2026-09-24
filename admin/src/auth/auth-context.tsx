import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { adminLogin, adminLogout, adminMe, setUnauthorizedHandler } from '../api/admin-api';
import { clearStoredAdminToken, getStoredAdminToken } from '../auth/auth-storage';
import { ApiError, type AdminIdentity } from '../types/admin-api';

type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; admin: AdminIdentity };

type AuthContextValue = {
  state: AuthState;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const refresh = useCallback(async () => {
    const token = getStoredAdminToken();

    if (!token) {
      setState({ status: 'anonymous' });
      return;
    }

    try {
      const me = await adminMe();
      setState({ status: 'authenticated', admin: me.admin });
    } catch (error) {
      clearStoredAdminToken();
      setState({ status: 'anonymous' });
      if (!(error instanceof ApiError && error.code === 'unauthorized')) {
        throw error;
      }
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setState({ status: 'anonymous' });
    });

    void refresh().catch(() => {
      setState({ status: 'anonymous' });
    });

    return () => setUnauthorizedHandler(null);
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await adminLogin(email, password);
    setState({ status: 'authenticated', admin: result.admin });
  }, []);

  const logout = useCallback(async () => {
    await adminLogout();
    setState({ status: 'anonymous' });
  }, []);

  const value = useMemo(
    () => ({
      state,
      login,
      logout,
      refresh,
    }),
    [state, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
