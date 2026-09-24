import * as ImagePicker from 'expo-image-picker';
import type { CameraPermissionResponse } from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

let cameraSettingsAlertShownThisSession = false;

export function isCameraPermissionGranted(permission: CameraPermissionResponse): boolean {
  return permission.granted;
}

export function canRequestCameraPermission(permission: CameraPermissionResponse): boolean {
  return !permission.granted && permission.canAskAgain;
}

export function shouldPromptCameraSettings(permission: CameraPermissionResponse): boolean {
  return !permission.granted && !permission.canAskAgain;
}

export async function getCameraPermissionState(): Promise<CameraPermissionResponse> {
  return ImagePicker.getCameraPermissionsAsync();
}

export async function resolveCameraPermission(): Promise<CameraPermissionResponse> {
  const current = await ImagePicker.getCameraPermissionsAsync();

  if (current.granted) {
    return current;
  }

  if (canRequestCameraPermission(current)) {
    return ImagePicker.requestCameraPermissionsAsync();
  }

  return current;
}

export function showCameraSettingsAlert(): void {
  if (cameraSettingsAlertShownThisSession) {
    return;
  }

  cameraSettingsAlertShownThisSession = true;

  Alert.alert(
    'Нет доступа к камере',
    'Разрешите доступ к камере в настройках, чтобы добавлять вещи в гардероб.',
    [
      { text: 'Позже', style: 'cancel' },
      {
        text: 'Открыть настройки',
        onPress: () => {
          void Linking.openSettings();
        },
      },
    ],
  );
}

export async function runCameraPermissionStartupCheck(): Promise<CameraPermissionResponse> {
  const permission = await resolveCameraPermission();

  if (shouldPromptCameraSettings(permission)) {
    showCameraSettingsAlert();
  }

  return permission;
}

export async function refreshCameraPermissionAfterSettingsReturn(): Promise<CameraPermissionResponse> {
  const permission = await ImagePicker.getCameraPermissionsAsync();

  if (permission.granted) {
    return permission;
  }

  if (shouldPromptCameraSettings(permission)) {
    showCameraSettingsAlert();
  }

  return permission;
}
