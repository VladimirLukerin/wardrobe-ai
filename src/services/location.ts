import * as Location from 'expo-location';

import type { AutoLocation } from '@/constants/body-parameters';
import { reverseGeocodeCoordinates } from '@/services/location-search';

export type DetectLocationOutcome =
  | { status: 'success'; location: AutoLocation }
  | { status: 'permission_denied' }
  | { status: 'unavailable' };

export async function readAutoLocationIfPermissionGranted(): Promise<DetectLocationOutcome> {
  const permission = await Location.getForegroundPermissionsAsync();

  if (permission.status !== Location.PermissionStatus.GRANTED) {
    return { status: 'permission_denied' };
  }

  let latitude: number;
  let longitude: number;

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    latitude = position.coords.latitude;
    longitude = position.coords.longitude;
  } catch {
    return { status: 'unavailable' };
  }

  try {
    const geocoded = await reverseGeocodeWithDevice(latitude, longitude);

    return {
      status: 'success',
      location: {
        source: 'auto',
        latitude,
        longitude,
        ...geocoded,
      },
    };
  } catch {
    return { status: 'unavailable' };
  }
}

export async function detectCurrentAutoLocation(): Promise<DetectLocationOutcome> {
  const currentPermission = await Location.getForegroundPermissionsAsync();

  let permission = currentPermission;

  if (permission.status !== Location.PermissionStatus.GRANTED) {
    if (!permission.canAskAgain) {
      return { status: 'permission_denied' };
    }

    permission = await Location.requestForegroundPermissionsAsync();
  }

  if (permission.status !== Location.PermissionStatus.GRANTED) {
    return { status: 'permission_denied' };
  }

  let latitude: number;
  let longitude: number;

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    latitude = position.coords.latitude;
    longitude = position.coords.longitude;
  } catch {
    return { status: 'unavailable' };
  }

  try {
    const geocoded = await reverseGeocodeWithDevice(latitude, longitude);

    return {
      status: 'success',
      location: {
        source: 'auto',
        latitude,
        longitude,
        ...geocoded,
      },
    };
  } catch {
    return { status: 'unavailable' };
  }
}

async function reverseGeocodeWithDevice(latitude: number, longitude: number) {
  try {
    const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
    const address = addresses[0];

    if (address) {
      const region = address.region || address.subregion || undefined;
      const name =
        address.city ||
        address.district ||
        address.subregion ||
        address.region ||
        address.country ||
        'Неизвестное место';
      const country = address.country || address.isoCountryCode || '';

      if (name || country) {
        return {
          name,
          country: country || name,
          region,
        };
      }
    }
  } catch {
    // Fall back to Open-Meteo reverse geocoding below.
  }

  return reverseGeocodeCoordinates(latitude, longitude);
}
