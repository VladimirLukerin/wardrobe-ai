import { SvgXml } from 'react-native-svg';

import { PRIKIN_LOGO_SVG } from '@/components/welcome/prikin_logo_svg';

type PrikinLogoProps = {
  width: number;
};

export function PrikinLogo({ width }: PrikinLogoProps) {
  const height = (width * 134) / 510;

  return (
    <SvgXml
      xml={PRIKIN_LOGO_SVG}
      width={width}
      height={height}
      accessibilityRole="image"
      accessibilityLabel="ПРИКИНЬ"
    />
  );
}
