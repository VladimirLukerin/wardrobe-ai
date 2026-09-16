import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import {
  type ColorPreference,
  type StylePreference,
  type StylePreferences,
} from '@/constants/style-preferences';

type StylePreferencesContextValue = StylePreferences & {
  setStylePreferences: (preferences: StylePreferences) => void;
  hasStylePreferences: boolean;
};

const EMPTY_PREFERENCES: StylePreferences = {
  styles: [],
  colors: [],
};

const StylePreferencesContext = createContext<StylePreferencesContextValue | null>(null);

export function StylePreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<StylePreferences>(EMPTY_PREFERENCES);

  const setStylePreferences = useCallback((next: StylePreferences) => {
    setPreferences(next);
  }, []);

  const hasStylePreferences =
    preferences.styles.length > 0 || preferences.colors.length > 0;

  const value = useMemo(
    () => ({
      ...preferences,
      setStylePreferences,
      hasStylePreferences,
    }),
    [preferences, setStylePreferences, hasStylePreferences],
  );

  return (
    <StylePreferencesContext.Provider value={value}>{children}</StylePreferencesContext.Provider>
  );
}

export function useStylePreferences() {
  const context = useContext(StylePreferencesContext);

  if (!context) {
    throw new Error('useStylePreferences must be used within StylePreferencesProvider');
  }

  return context;
}

export type { StylePreference, ColorPreference, StylePreferences };
