import { StyleSheet, Text, View } from 'react-native';

import { PrikinIllustration } from '@/components/prikin/prikin-illustration';
import { PRIKIN_HOME_FIRST_ITEM_HANGER_SVG } from '@/components/prikin/illustrations';
import { PrikinPrimaryButton } from '@/components/prikin/prikin-primary-button';
import { PrikinColors, PrikinHomeRadii, PrikinSpacing } from '@/constants/prikin-tokens';

type FirstWardrobeItemCardProps = {
  onAddFirstItem: () => void;
};

export function FirstWardrobeItemCard({ onAddFirstItem }: FirstWardrobeItemCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardHeading}>Начнём с первой вещи</Text>
      <View style={styles.row}>
        <PrikinIllustration
          xml={PRIKIN_HOME_FIRST_ITEM_HANGER_SVG}
          width={96}
          aspectRatio={130 / 80}
          accessibilityLabel="Иллюстрация вешалки"
          style={styles.illustration}
        />
        <Text style={styles.hint}>Сфотографируй то, что любишь носить.</Text>
      </View>
      <PrikinPrimaryButton
        label="Добавить первую вещь"
        showPlusIcon
        size="compact"
        onPress={onAddFirstItem}
        style={styles.button}
      />
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
  hint: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    lineHeight: 18,
    color: PrikinColors.textSecondary,
  },
  button: {
    alignSelf: 'stretch',
  },
});
