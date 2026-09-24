import { PrikinBrandHeader } from '@/components/prikin/prikin-brand-header';
import { PrikinHomeLayout } from '@/constants/prikin-home-tokens';

export function HomeBrandHeader() {
  return <PrikinBrandHeader compact logoWidth={PrikinHomeLayout.logoWidth} />;
}
