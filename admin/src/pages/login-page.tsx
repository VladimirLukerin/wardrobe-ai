import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/auth-context';
import { ErrorBanner } from '../components/state-panels';
import { ApiError } from '../types/admin-api';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  const redirectTo =
    (location.state as { from?: string } | null)?.from && (location.state as { from?: string }).from !== '/login'
      ? (location.state as { from: string }).from
      : '/';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await login(email.trim(), password);
      navigate(redirectTo, { replace: true });
    } catch (submitError) {
      if (submitError instanceof ApiError && submitError.code === 'unauthorized') {
        setError(new ApiError('Неверный email или пароль.', 401, 'validation'));
      } else {
        setError(submitError);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={(event) => void handleSubmit(event)}>
        <div className="brand-block compact">
          <div className="brand-title">ПРИКИНЬ</div>
          <div className="brand-subtitle">Admin sign in</div>
        </div>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <ErrorBanner error={error} />

        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? 'Вход…' : 'Войти'}
        </button>
      </form>
    </div>
  );
}
