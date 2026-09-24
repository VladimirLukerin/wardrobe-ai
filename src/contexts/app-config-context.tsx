import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  DEFAULT_CLIENT_APP_CONFIG,
  type ClientAppConfig,
} from '@/constants/app-config-defaults';
import { fetchAppConfig, getCachedAppConfig } from '@/services/app-config';

type AppConfigContextValue = {
  config: ClientAppConfig;
  refresh: () => Promise<void>;
};

const AppConfigContext = createContext<AppConfigContextValue | null>(null);

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ClientAppConfig>(getCachedAppConfig());

  useEffect(() => {
    let active = true;

    void fetchAppConfig().then((next) => {
      if (active) {
        setConfig(next);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AppConfigContextValue>(
    () => ({
      config,
      refresh: async () => {
        const next = await fetchAppConfig({ force: true });
        setConfig(next);
      },
    }),
    [config],
  );

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}

export function useAppConfig(): AppConfigContextValue {
  const context = useContext(AppConfigContext);

  if (!context) {
    return {
      config: DEFAULT_CLIENT_APP_CONFIG,
      refresh: async () => {},
    };
  }

  return context;
}
