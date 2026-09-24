/**
 * PRIKIN design tokens — main app tabs and shared surfaces (Phase 2+).
 * Welcome/auth-entry uses the same palette; extend here for tab screens.
 */

export const PrikinColors = {
  background: '#E8E6DD',
  surface: '#F4F1EA',
  paper: '#DDD5C4',
  textPrimary: '#171B17',
  textSecondary: '#66665E',
  textMuted: '#686D6E',
  accent: '#A65F45',
  buttonPrimary: '#20251F',
  buttonPrimaryText: '#F4F1EA',
  borderSubtle: 'rgba(32, 35, 29, 0.12)',
  divider: 'rgba(32, 35, 29, 0.08)',
  scrim: 'rgba(23, 27, 23, 0.28)',
  profileAvatarCircle: '#EAE6DC',
  profileMutedGreen: '#D4D7C5',
  profileMutedGreenAlt: '#DADCCE',
  tabBarBackground: '#F4F1EA',
  tabInactive: '#66665E',
  tabActive: '#20231D',
} as const;

export const PrikinSpacing = {
  screenHorizontal: 20,
  sectionGap: 20,
  cardPadding: 16,
  welcomeHorizontal: 22,
  welcomeHeroGap: 20,
  welcomeTaglineTop: 12,
  welcomeActionsGap: 16,
  welcomeBottomExtra: 8,
  homeSectionGap: 12,
  homeCardPadding: 12,
  homeCardGap: 10,
} as const;

export const PrikinHomeRadii = {
  card: 16,
  button: 24,
} as const;

export const PrikinRadii = {
  button: 25,
  card: 20,
  sheet: 20,
  input: 14,
  pill: 999,
} as const;

export const PrikinButton = {
  minHeight: 50,
  compactMinHeight: 48,
  paddingHorizontal: 20,
} as const;

export const PrikinTypography = {
  screenTitle: {
    fontSize: 26,
    fontWeight: '700' as const,
    lineHeight: 32,
    color: PrikinColors.textPrimary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
    color: PrikinColors.textPrimary,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
    color: PrikinColors.textPrimary,
  },
  bodySecondary: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
    color: PrikinColors.textSecondary,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
    color: PrikinColors.textSecondary,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 22,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
    lineHeight: 14,
  },
  tabLabelActive: {
    fontSize: 11,
    fontWeight: '700' as const,
    lineHeight: 14,
  },
  handwritten: {
    fontSize: 17,
    lineHeight: 22,
    color: PrikinColors.textPrimary,
  },
  textAction: {
    fontSize: 16,
    fontWeight: '500' as const,
    lineHeight: 22,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
    color: '#DC2626',
  },
} as const;

export const PrikinFontFamily = {
  sans: 'PrikinSans',
  handwritten: 'Caveat',
} as const;

export type AuthSheetOverlayStyle = 'dimmed' | 'transparent';

export function authSheetOverlayStyle(
  overlayStyle: AuthSheetOverlayStyle,
): { backgroundColor: string } {
  return overlayStyle === 'transparent'
    ? { backgroundColor: 'transparent' }
    : { backgroundColor: PrikinColors.scrim };
}
