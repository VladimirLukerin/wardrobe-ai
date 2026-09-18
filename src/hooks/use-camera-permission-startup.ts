import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  refreshCameraPermissionAfterSettingsReturn,
  runCameraPermissionStartupCheck,
} from '@/utils/camera-permission';

export function useCameraPermissionStartup(enabled: boolean): void {
  const startupCheckedRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!enabled || startupCheckedRef.current) {
      return;
    }

    startupCheckedRef.current = true;
    void runCameraPermissionStartupCheck();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasBackgrounded =
        appStateRef.current === 'inactive' || appStateRef.current === 'background';

      appStateRef.current = nextState;

      if (wasBackgrounded && nextState === 'active') {
        void refreshCameraPermissionAfterSettingsReturn();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [enabled]);
}
