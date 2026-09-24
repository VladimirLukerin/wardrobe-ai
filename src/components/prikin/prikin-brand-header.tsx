import type { ReactNode } from 'react';
import { StyleSheet, Text, type TextProps, View } from 'react-native';

import { PrikinColors, PrikinSpacing, PrikinTypography } from '@/constants/prikin-tokens';
import { PrikinLogo } from '@/components/welcome/prikin-logo';

const LOGO_WIDTH = 112;
const LOGO_WIDTH_COMPACT = 100;

export function PrikinBrandHeader({
  compact = false,
  logoWidth,
}: {
  compact?: boolean;
  logoWidth?: number;
}) {
  const width = logoWidth ?? (compact ? LOGO_WIDTH_COMPACT : LOGO_WIDTH);

  return (
    <View style={[styles.header, compact && styles.headerCompact]}>
      <PrikinLogo width={width} />
    </View>
  );
}

export function PrikinHandwritten({
  children,
  style,
  ...props
}: TextProps & { children: string }) {
  return (
    <Text
      {...props}
      style={[styles.handwritten, style]}
      accessibilityRole={props.accessibilityRole ?? 'text'}>
      {children}
    </Text>
  );
}

export function PrikinTerracottaDot() {
  return <View style={styles.dot} accessibilityElementsHidden importantForAccessibility="no" />;
}

export function PrikinPaperSurface({ children }: { children: ReactNode }) {
  return <View style={styles.paper}>{children}</View>;
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 4,
    paddingBottom: PrikinSpacing.sectionGap / 2,
    alignItems: 'flex-start',
  },
  headerCompact: {
    paddingTop: 0,
    paddingBottom: 0,
  },
  handwritten: {
    ...PrikinTypography.handwritten,
    fontFamily: 'Caveat',
    color: PrikinColors.textPrimary,
    textDecorationLine: 'underline',
    textDecorationColor: PrikinColors.accent,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PrikinColors.accent,
  },
  paper: {
    backgroundColor: PrikinColors.paper,
    borderRadius: 16,
    padding: PrikinSpacing.cardPadding,
  },
});
