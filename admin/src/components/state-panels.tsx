import { ApiError } from '../types/admin-api';

export function ErrorBanner({ error }: { error: unknown }) {
  if (!error) {
    return null;
  }

  if (error instanceof ApiError) {
    if (error.code === 'rate_limited') {
      return (
        <div className="banner banner-warning">
          Слишком много запросов.{' '}
          {error.retryAfterSeconds ? `Повторите через ${error.retryAfterSeconds} сек.` : ''}
        </div>
      );
    }

    if (error.code === 'unauthorized') {
      return <div className="banner banner-warning">Сессия истекла. Войдите снова.</div>;
    }

    if (error.code === 'forbidden') {
      return <div className="banner banner-warning">Недостаточно прав.</div>;
    }

    if (error.code === 'network') {
      return <div className="banner banner-error">Сервер недоступен.</div>;
    }

    return <div className="banner banner-error">{error.message}</div>;
  }

  return <div className="banner banner-error">Неожиданная ошибка.</div>;
}

export function LoadingState({ label = 'Загрузка…' }: { label?: string }) {
  return <div className="page-message">{label}</div>;
}

export function EmptyState({ label }: { label: string }) {
  return <div className="empty-state">{label}</div>;
}
