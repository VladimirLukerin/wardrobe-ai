/**
 * Phase 1 design tokens for PRIKIN / Welcome and auth-entry surfaces.
 * Do not use as a global app theme until later redesign phases.
 */

export const PrikinColors = {
  background: '#E8E6DD',
  surface: '#F4F1EA',
  textPrimary: '#171B17',
  textSecondary: '#647482',
  accent: '#A65F45',
  buttonPrimary: '#20251F',
  buttonPrimaryText: '#F4F1EA',
  borderSubtle: 'rgba(155, 162, 140, 0.35)',
  scrim: 'rgba(23, 27, 23, 0.28)',
} as const;

export const PrikinSpacing = {
  welcomeHorizontal: 22,
  welcomeHeroGap: 20,
  welcomeTaglineTop: 12,
  welcomeActionsGap: 16,
  welcomeBottomExtra: 8,
} as const;

export const PrikinRadii = {
  button: 25,
  sheet: 20,
  input: 14,
} as const;

export const PrikinButton = {
  minHeight: 50,
  paddingHorizontal: 20,
} as const;

export const PrikinTypography = {
  buttonLabel: {
    fontSize: 17,
    fontWeight: '600' as const,
    lineHeight: 22,
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

export type AuthSheetOverlayStyle = 'dimmed' | 'transparent';

export function authSheetOverlayStyle(
  overlayStyle: AuthSheetOverlayStyle,
): { backgroundColor: string } {
  return overlayStyle === 'transparent'
    ? { backgroundColor: 'transparent' }
    : { backgroundColor: PrikinColors.scrim };
}
