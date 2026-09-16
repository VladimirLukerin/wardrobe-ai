export function getTimeGreeting(date: Date = new Date()): string {
  const hour = date.getHours();

  if (hour >= 5 && hour < 12) {
    return 'Доброе утро';
  }

  if (hour >= 12 && hour < 18) {
    return 'Добрый день';
  }

  return 'Добрый вечер';
}

export function formatGreeting(displayName?: string | null): string {
  const greeting = getTimeGreeting();

  if (displayName && displayName.trim().length > 0) {
    return `${greeting}, ${displayName.trim()}`;
  }

  return greeting;
}
