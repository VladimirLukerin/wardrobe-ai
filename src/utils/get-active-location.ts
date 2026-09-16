import type { BodyParameters, LocationPlace } from '@/constants/body-parameters';

type ActiveLocationInput = Pick<
  BodyParameters,
  'locationMode' | 'manualLocation' | 'autoLocation'
>;

export function getActiveLocation(parameters: ActiveLocationInput): LocationPlace | null {
  if (parameters.locationMode === 'manual' && parameters.manualLocation) {
    return parameters.manualLocation;
  }

  if (parameters.autoLocation) {
    return parameters.autoLocation;
  }

  if (parameters.manualLocation) {
    return parameters.manualLocation;
  }

  return null;
}
