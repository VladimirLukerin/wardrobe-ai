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
  EMPTY_BODY_PARAMETERS,
  type BodyParameters,
} from '@/constants/body-parameters';
import {
  loadProfileBodyParameters,
  saveProfileBodyParameters,
} from '@/storage/profile-storage';

type BodyParametersContextValue = BodyParameters & {
  setBodyParameters: (parameters: BodyParameters) => void;
  hasBodyParameters: boolean;
  isHydrated: boolean;
};

const BodyParametersContext = createContext<BodyParametersContextValue | null>(null);

function hasAnyParameters(parameters: BodyParameters) {
  return (
    parameters.manualLocation !== null ||
    parameters.autoLocation !== null ||
    parameters.heightCm.trim().length > 0 ||
    parameters.topSize !== null ||
    parameters.bottomSize !== null ||
    parameters.shoeSize !== null ||
    parameters.fitPreference !== null ||
    parameters.weatherSensitivity !== null
  );
}

export function BodyParametersProvider({ children }: { children: ReactNode }) {
  const [parameters, setParameters] = useState<BodyParameters>(EMPTY_BODY_PARAMETERS);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    loadProfileBodyParameters().then((stored) => {
      if (isMounted) {
        setParameters(stored);
        setIsHydrated(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const setBodyParameters = useCallback((next: BodyParameters) => {
    setParameters(next);
    void saveProfileBodyParameters(next);
  }, []);

  const hasBodyParameters = hasAnyParameters(parameters);

  const value = useMemo(
    () => ({
      ...parameters,
      setBodyParameters,
      hasBodyParameters,
      isHydrated,
    }),
    [parameters, setBodyParameters, hasBodyParameters, isHydrated],
  );

  return (
    <BodyParametersContext.Provider value={value}>{children}</BodyParametersContext.Provider>
  );
}

export function useBodyParameters() {
  const context = useContext(BodyParametersContext);

  if (!context) {
    throw new Error('useBodyParameters must be used within BodyParametersProvider');
  }

  return context;
}

export type { BodyParameters };
