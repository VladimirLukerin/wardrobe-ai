import { SvgXml } from 'react-native-svg';

import { PRIKIN_TAGLINE_SVG } from '@/components/welcome/prikin_tagline_svg';

type PrikinTaglineProps = {
  width: number;
};

export function PrikinTagline({ width }: PrikinTaglineProps) {
  const height = (width * 98) / 498;

  return (
    <SvgXml
      xml={PRIKIN_TAGLINE_SVG}
      width={width}
      height={height}
      accessibilityRole="text"
      accessibilityLabel="Не трать на это силы."
    />
  );
}
