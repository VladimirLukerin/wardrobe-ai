import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { PrikinIllustration } from '@/components/prikin/prikin-illustration';
import { PRIKIN_WARDROBE_EMPTY_HANGER_SVG } from '@/components/prikin/illustrations';
import { PrikinPrimaryButton } from '@/components/prikin/prikin-primary-button';
import { getHomeCardContentWidth, PrikinHomeLayout } from '@/constants/prikin-home-tokens';
import { PrikinColors } from '@/constants/prikin-tokens';

type FirstWardrobeItemCardProps = {
  onAddFirstItem: () => void;
};

export function FirstWardrobeItemCard({ onAddFirstItem }: FirstWardrobeItemCardProps) {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = getHomeCardContentWidth(screenWidth);

  return (
    <View
      style={[styles.card, { width: cardWidth, minHeight: PrikinHomeLayout.referenceFirstItemCardMinHeight }]}>
      <Text style={styles.cardHeading}>Начнём с первой вещи</Text>
      <View style={styles.row}>
        <PrikinIllustration
          xml={PRIKIN_WARDROBE_EMPTY_HANGER_SVG}
          width={PrikinHomeLayout.hangerIllustrationWidth}
          aspectRatio={PrikinHomeLayout.hangerIllustrationAspectRatio}
          accessibilityLabel="Иллюстрация вешалки на бумаге"
          style={styles.illustration}
        />
        <Text style={styles.hint}>Сфотографируй то, что любишь носить.</Text>
      </View>
      <PrikinPrimaryButton
        label="Добавить первую вещь"
        showPlusIcon
        size="home"
        onPress={onAddFirstItem}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'center',
    backgroundColor: PrikinColors.surface,
    borderRadius: PrikinHomeLayout.cardRadius,
    paddingHorizontal: PrikinHomeLayout.cardPaddingHorizontal,
    paddingTop: PrikinHomeLayout.cardPaddingTop,
    paddingBottom: PrikinHomeLayout.cardPaddingBottom,
    gap: PrikinHomeLayout.cardTitleToContentGap,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PrikinColors.borderSubtle,
  },
  cardHeading: {
    fontSize: PrikinHomeLayout.sectionCardTitleFontSize,
    fontWeight: '700',
    lineHeight: PrikinHomeLayout.sectionCardTitleLineHeight,
    color: PrikinColors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PrikinHomeLayout.firstItemCardRowGap,
  },
  illustration: {
    flexShrink: 0,
  },
  hint: {
    flex: 1,
    minWidth: 0,
    fontSize: PrikinHomeLayout.cardBodyFontSize,
    lineHeight: PrikinHomeLayout.cardBodyLineHeight,
    color: PrikinColors.textSecondary,
  },
  button: {
    alignSelf: 'stretch',
    marginHorizontal: -PrikinHomeLayout.homePrimaryButtonBleedHorizontal,
    marginTop: PrikinHomeLayout.cardTitleToButtonGap,
  },
});
