export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('ru-RU');
}

export function accountTypeLabel(type: 'guest' | 'protected'): string {
  return type === 'protected' ? 'Protected' : 'Guest';
}
