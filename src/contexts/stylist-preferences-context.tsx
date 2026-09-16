import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  DEFAULT_STYLIST_PREFERENCES,
  type StylistPreferences,
} from '@/constants/stylist-preferences';
import {
  loadProfileStylistPreferences,
  saveProfileStylistPreferences,
} from '@/storage/profile-storage';

type StylistPreferencesContextValue = StylistPreferences & {
  setStylistPreferences: (preferences: StylistPreferences) => void;
  isHydrated: boolean;
};

const StylistPreferencesContext = createContext<StylistPreferencesContextValue | null>(null);

export function StylistPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<StylistPreferences>(DEFAULT_STYLIST_PREFERENCES);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    loadProfileStylistPreferences().then((stored) => {
      if (isMounted) {
        setPreferences(stored);
        setIsHydrated(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const setStylistPreferences = useCallback((next: StylistPreferences) => {
    setPreferences(next);
    void saveProfileStylistPreferences(next);
  }, []);

  const value = useMemo(
    () => ({
      ...preferences,
      setStylistPreferences,
      isHydrated,
    }),
    [preferences, setStylistPreferences, isHydrated],
  );

  return (
    <StylistPreferencesContext.Provider value={value}>
      {children}
    </StylistPreferencesContext.Provider>
  );
}

export function useStylistPreferences() {
  const context = useContext(StylistPreferencesContext);

  if (!context) {
    throw new Error('useStylistPreferences must be used within StylistPreferencesProvider');
  }

  return context;
}

export type { StylistPreferences };
