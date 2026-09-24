/** Home screen layout — anchored to 01_Home_VECTOR_PREVIEW.png @ 390×838 pt (780×1676 @2x). */

export const PRIKIN_HOME_REFERENCE_SCREEN_WIDTH = 390;

export const PrikinHomeLayout = {
  /** Screen edge → card edge (reference x=12 @390). */
  cardHorizontalMargin: 12,
  /** Reference card inner width @390. */
  referenceCardWidth: 366,
  /** Extra inset for header only (12 + 10 = 22 pt logo/city left). */
  headerExtraHorizontalInset: 10,
  headerBlockGap: 4,
  logoWidth: 121,
  logoBottomGap: 0,
  logoToLocationGap: 0,
  headerWeatherBlockGap: 2,
  headerLeftColumnFlex: 0.58,
  headerRightColumnFlex: 0.42,
  dayMessageWidth: 132,
  weatherSymbolSize: 28,
  greetingTopPadding: 0,
  greetingBottomPadding: 0,
  /** Greeting bottom → today card (reference ~10pt). */
  headerToCardsGap: 10,
  cardStackGap: 10,
  /** First card → community divider (reference ~15pt). */
  communitySectionTopGap: 15,
  cardRadius: 18,
  cardPaddingHorizontal: 16,
  cardPaddingTop: 15,
  cardPaddingBottom: 14,
  cardTitleToContentGap: 8,
  cardTitleToButtonGap: 8,
  cardInnerGap: 6,
  referenceTodayCardMinHeight: 187,
  referenceFirstItemCardMinHeight: 186,
  locationFontSize: 15,
  locationLineHeight: 20,
  temperatureFontSize: 28,
  temperatureLineHeight: 32,
  feelsLikeFontSize: 12,
  feelsLikeLineHeight: 16,
  greetingFontSize: 22,
  greetingLineHeight: 26,
  sectionCardTitleFontSize: 22,
  sectionCardTitleLineHeight: 26,
  cardMessageFontSize: 18,
  cardMessageLineHeight: 22,
  cardBodyFontSize: 15,
  cardBodyLineHeight: 20,
  cardCopyInnerGap: 4,
  permissionTitleFontSize: 15,
  permissionTitleLineHeight: 20,
  permissionHintFontSize: 12,
  permissionHintLineHeight: 16,
  wornSectionTitleFontSize: 22,
  wornSectionBodyFontSize: 15,
  wornSectionTitleBodyGap: 8,
  wornEmptyTextMaxWidthRatio: 0.72,
  wornEmptyAccentWidth: 48,
  todayCardRowGap: 8,
  outfitIllustrationWidth: 120,
  outfitIllustrationAspectRatio: 190 / 180,
  firstItemCardRowGap: 8,
  hangerIllustrationWidth: 108,
  hangerIllustrationAspectRatio: 180 / 190,
  homePrimaryButtonMinHeight: 44,
  homePrimaryButtonPaddingVertical: 0,
  homePrimaryButtonHorizontalInset: 10,
  /** Expands CTA to ~10pt inset from card outer edge (reference x≈22.5 @390). */
  homePrimaryButtonBleedHorizontal: 6,
  homePrimaryButtonLabelFontSize: 16,
  homePrimaryButtonLabelLineHeight: 20,
  homePrimaryButtonIconSize: 18,
  homePrimaryButtonRadius: 22,
  homePrimaryButtonContentGap: 6,
} as const;

/** @deprecated Use cardHorizontalMargin */
export const contentHorizontalPadding = PrikinHomeLayout.cardHorizontalMargin;

export function getHomeCardContentWidth(screenWidth: number): number {
  const margins = PrikinHomeLayout.cardHorizontalMargin * 2;
  const available = screenWidth - margins;
  return Math.min(available, PrikinHomeLayout.referenceCardWidth);
}
