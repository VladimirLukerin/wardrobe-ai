import { StyleSheet, Text, View } from 'react-native';

import { PrikinIllustration } from '@/components/prikin/prikin-illustration';
import { PRIKIN_HOME_OUTFIT_EMPTY_SVG } from '@/components/prikin/illustrations';
import { PrikinColors, PrikinHomeRadii, PrikinSpacing } from '@/constants/prikin-tokens';

export function EmptyDailyOutfitCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.cardHeading}>Твой образ на сегодня</Text>
      <View style={styles.row}>
        <PrikinIllustration
          xml={PRIKIN_HOME_OUTFIT_EMPTY_SVG}
          width={148}
          aspectRatio={130 / 118}
          accessibilityLabel="Иллюстрация рубашки и брюк"
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
    borderRadius: PrikinHomeRadii.card,
    padding: PrikinSpacing.homeCardPadding,
    gap: PrikinSpacing.homeCardGap,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PrikinColors.borderSubtle,
  },
  cardHeading: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    color: PrikinColors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PrikinSpacing.homeCardGap,
  },
  illustration: {
    flexShrink: 0,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    color: PrikinColors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: PrikinColors.textSecondary,
  },
});
