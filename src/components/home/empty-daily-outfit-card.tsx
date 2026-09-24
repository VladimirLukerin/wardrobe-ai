import { StyleSheet, Text, View } from 'react-native';

import { PrikinIllustration } from '@/components/prikin/prikin-illustration';
import { PRIKIN_OUTFITS_EMPTY_CLOTHES_SVG } from '@/components/prikin/illustrations';
import { PrikinHomeLayout } from '@/constants/prikin-home-tokens';
import { PrikinColors } from '@/constants/prikin-tokens';

export function EmptyDailyOutfitCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.cardHeading}>Твой образ на сегодня</Text>
      <View style={styles.row}>
        <PrikinIllustration
          xml={PRIKIN_OUTFITS_EMPTY_CLOTHES_SVG}
          width={PrikinHomeLayout.outfitIllustrationWidth}
          aspectRatio={PrikinHomeLayout.outfitIllustrationAspectRatio}
          accessibilityLabel="Иллюстрация рубашки и брюк на бумаге"
          style={styles.illustration}
        />
        <View style={styles.copy}>
          <Text style={styles.title}>
            Что надеть?{'\n'}Скоро подскажем.
          </Text>
          <Text style={styles.subtitle}>
            Добавь свои вещи — и мы сразу соберём тебе образ под погоду и планы.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: PrikinColors.surface,
    borderRadius: PrikinHomeLayout.cardRadius,
    paddingHorizontal: PrikinHomeLayout.cardPaddingHorizontal,
    paddingVertical: PrikinHomeLayout.cardPaddingVertical,
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
    gap: 10,
  },
  illustration: {
    flexShrink: 0,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  title: {
    fontSize: PrikinHomeLayout.cardMessageFontSize,
    fontWeight: '700',
    lineHeight: PrikinHomeLayout.cardMessageLineHeight,
    color: PrikinColors.textPrimary,
  },
  subtitle: {
    fontSize: PrikinHomeLayout.cardBodyFontSize,
    lineHeight: PrikinHomeLayout.cardBodyLineHeight,
    color: PrikinColors.textSecondary,
  },
});
