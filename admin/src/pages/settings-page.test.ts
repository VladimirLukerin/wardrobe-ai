import { describe, expect, it } from 'vitest';

import { canMutateAdminSettings } from '../auth/admin-settings-permissions';

describe('admin settings permissions', () => {
  it('allows admin and owner to mutate', () => {
    expect(canMutateAdminSettings('admin')).toBe(true);
    expect(canMutateAdminSettings('owner')).toBe(true);
  });

  it('blocks viewer mutations in UI', () => {
    expect(canMutateAdminSettings('viewer')).toBe(false);
    expect(canMutateAdminSettings(undefined)).toBe(false);
  });
});
