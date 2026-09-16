/** Local calendar date key (YYYY-MM-DD) for duplicate detection by device timezone. */
export function getLocalCalendarDateKey(isoOrDate: string | Date): string {
  const date = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function isSameLocalCalendarDay(a: string | Date, b: string | Date): boolean {
  return getLocalCalendarDateKey(a) === getLocalCalendarDateKey(b);
}

export function formatWearEventDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();

  if (isSameLocalCalendarDay(date, now)) {
    return 'Сегодня';
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameLocalCalendarDay(date, yesterday)) {
    return 'Вчера';
  }

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
}

export function getLocalDayDifference(pastIso: string, now: Date = new Date()): number {
  const past = new Date(pastIso);
  const pastStart = new Date(past.getFullYear(), past.getMonth(), past.getDate());
  const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return Math.floor((nowStart.getTime() - pastStart.getTime()) / 86_400_000);
}

function formatDaysAgo(days: number): string {
  const mod10 = days % 10;
  const mod100 = days % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${days} день назад`;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return `${days} дня назад`;
  }

  return `${days} дней назад`;
}

export function formatLastWornRelative(iso: string): string {
  const dayDifference = getLocalDayDifference(iso);

  if (dayDifference <= 0) {
    return 'Сегодня';
  }

  if (dayDifference === 1) {
    return 'Вчера';
  }

  if (dayDifference <= 30) {
    return formatDaysAgo(dayDifference);
  }

  return formatWearEventDate(iso);
}

export function getWearRecencyLabel(lastWornAt: string | null): string {
  if (!lastWornAt) {
    return 'Ещё не носили';
  }

  const dayDifference = getLocalDayDifference(lastWornAt);

  if (dayDifference <= 7) {
    return 'Носили недавно';
  }

  if (dayDifference <= 30) {
    return 'Давно не надевали';
  }

  return 'Очень давно не надевали';
}
