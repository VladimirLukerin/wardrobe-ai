import { useLocationBootstrap } from '@/hooks/use-location-bootstrap';

type LocationBootstrapLifecycleProps = {
  enabled: boolean;
};

export function LocationBootstrapLifecycle({ enabled }: LocationBootstrapLifecycleProps) {
  useLocationBootstrap(enabled);
  return null;
}
