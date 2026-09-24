export const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;

export const SHOE_SIZES_EU = [
  '35',
  '36',
  '37',
  '38',
  '39',
  '40',
  '41',
  '42',
  '43',
  '44',
  '45',
  '46',
  '47',
  '48',
] as const;

export const FIT_PREFERENCES = ['По фигуре', 'Обычная', 'Свободная'] as const;

export const WEATHER_SENSITIVITIES = ['Часто мёрзну', 'Обычно', 'Мне часто жарко'] as const;

export type LocationMode = 'auto' | 'manual';

export type ClothingSize = (typeof CLOTHING_SIZES)[number];

export type ShoeSizeEu = (typeof SHOE_SIZES_EU)[number];

export type FitPreference = (typeof FIT_PREFERENCES)[number];

export type WeatherSensitivity = (typeof WEATHER_SENSITIVITIES)[number];

export type LocationPlace = {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  region?: string;
};

export type ManualLocation = LocationPlace;

export type AutoLocation = LocationPlace & {
  source: 'auto';
  updatedAt?: number;
};

export type BodyParameters = {
  locationMode: LocationMode;
  manualLocation: ManualLocation | null;
  autoLocation: AutoLocation | null;
  heightCm: string;
  topSize: ClothingSize | null;
  bottomSize: ClothingSize | null;
  shoeSize: ShoeSizeEu | null;
  fitPreference: FitPreference | null;
  weatherSensitivity: WeatherSensitivity | null;
};

export const EMPTY_BODY_PARAMETERS: BodyParameters = {
  locationMode: 'auto',
  manualLocation: null,
  autoLocation: null,
  heightCm: '',
  topSize: null,
  bottomSize: null,
  shoeSize: null,
  fitPreference: null,
  weatherSensitivity: null,
};
