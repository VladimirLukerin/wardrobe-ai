export const STYLE_EXPERIMENTS = ['familiar', 'balanced', 'bold'] as const;

export const WARDROBE_MODES = ['owned-only', 'allow-suggestions'] as const;

export type StyleExperiment = (typeof STYLE_EXPERIMENTS)[number];

export type WardrobeMode = (typeof WARDROBE_MODES)[number];

export type StylistPreferences = {
  considerWeather: boolean;
  styleExperiment: StyleExperiment;
  wardrobeMode: WardrobeMode;
  avoidRepeatedOutfits: boolean;
  dailyStylistEnabled: boolean;
  dailyStylistTime: string;
  timezone: string;
};

export const DEFAULT_STYLIST_PREFERENCES: StylistPreferences = {
  considerWeather: true,
  styleExperiment: 'balanced',
  wardrobeMode: 'owned-only',
  avoidRepeatedOutfits: true,
  dailyStylistEnabled: false,
  dailyStylistTime: '09:00',
  timezone: 'Europe/Moscow',
};

export const STYLE_EXPERIMENT_LABELS: Record<StyleExperiment, string> = {
  familiar: 'Привычные',
  balanced: 'Баланс',
  bold: 'Смелее',
};

export const STYLE_EXPERIMENT_OUTFIT_LABELS: Record<StyleExperiment, string> = {
  familiar: 'Привычный',
  balanced: 'Баланс',
  bold: 'Смелее',
};

export const WARDROBE_MODE_LABELS: Record<WardrobeMode, string> = {
  'owned-only': 'Только из моего гардероба',
  'allow-suggestions': 'Можно предлагать недостающие вещи',
};
