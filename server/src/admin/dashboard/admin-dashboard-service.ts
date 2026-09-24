import { getDatabase } from '../../db/database';

export type AdminDashboardMetrics = {
  totalUsers: number;
  guestUsers: number;
  protectedUsers: number;
  totalWardrobeItems: number;
  totalSavedOutfits: number;
  totalFamilyRelationships: number;
};

export function getAdminDashboardMetrics(): AdminDashboardMetrics {
  const db = getDatabase();

  const totalUsers = (db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number })
    .count;

  const guestUsers = (
    db
      .prepare(
        'SELECT COUNT(*) AS count FROM users WHERE email_verified = 0 AND phone_verified = 0',
      )
      .get() as { count: number }
  ).count;

  const protectedUsers = (
    db
      .prepare(
        'SELECT COUNT(*) AS count FROM users WHERE email_verified = 1 OR phone_verified = 1',
      )
      .get() as { count: number }
  ).count;

  const totalWardrobeItems = (
    db
      .prepare('SELECT COUNT(*) AS count FROM wardrobe_items WHERE deleted_at IS NULL')
      .get() as { count: number }
  ).count;

  const totalSavedOutfits = (
    db
      .prepare('SELECT COUNT(*) AS count FROM saved_outfits WHERE deleted_at IS NULL')
      .get() as { count: number }
  ).count;

  const totalFamilyRelationships = (
    db.prepare('SELECT COUNT(*) AS count FROM family_members').get() as { count: number }
  ).count;

  return {
    totalUsers,
    guestUsers,
    protectedUsers,
    totalWardrobeItems,
    totalSavedOutfits,
    totalFamilyRelationships,
  };
}
