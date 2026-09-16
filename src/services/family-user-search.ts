export type FoundUserProfile = {
  id: string;
  name: string;
};

/**
 * Поиск пользователя по ID для добавления в семью.
 *
 * TODO: заменить на вызов backend API, когда появятся аккаунты.
 * В будущем здесь также можно подтягивать профиль и гардероб пользователя.
 */
export async function findUserById(userId: string): Promise<FoundUserProfile | null> {
  void userId;
  return null;
}
