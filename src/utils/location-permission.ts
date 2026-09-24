import * as Location from 'expo-location';

export type ForegroundLocationPermission = {
  granted: boolean;
  canAskAgain: boolean;
};

export async function getForegroundLocationPermission(): Promise<ForegroundLocationPermission> {
  const permission = await Location.getForegroundPermissionsAsync();

  return {
    granted: permission.status === Location.PermissionStatus.GRANTED,
    canAskAgain: permission.canAskAgain,
  };
}

export function canRequestForegroundLocationPermission(
  permission: ForegroundLocationPermission,
): boolean {
  return !permission.granted && permission.canAskAgain;
}

export function shouldOpenLocationSettings(permission: ForegroundLocationPermission): boolean {
  return !permission.granted && !permission.canAskAgain;
}
