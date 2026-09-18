import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { REMEMBER_ME_KEY } from '../../services/api';

export const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(
    () => localStorage.getItem(REMEMBER_ME_KEY) === 'true'
  );
  const [localError, setLocalError] = useState(null);

  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);

    if (!email || !password) {
      setLocalError('Please fill in both email and password.');
      return;
    }

    try {
      const data = await login(email, password, rememberMe);
      if (data?.user?.is_staff && !data?.organization) {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        'Invalid email or password.';
      setLocalError(msg);
    }
  };

  return (
    <div className="auth-card">
      <h2 style={{ marginBottom: '1rem', textAlign: 'center' }}>Sign In</h2>

      {localError && <div className="alert alert-error">{localError}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.75rem 0' }}>
          <input
            id="remember"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          <label htmlFor="remember" style={{ fontWeight: 'normal' }}>
            Remember me
          </label>
        </div>

        <button
          type="submit"
          className="btn-primary"
          style={{ width: '100%', marginTop: '0.5rem' }}
          disabled={isLoading}
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div style={{ marginTop: '1rem', fontSize: '0.85rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div>
          Don't have an account? <Link to="/register" style={{ textDecoration: 'underline' }}>Register</Link>
        </div>
        <div>
          <Link to="/password-reset" style={{ textDecoration: 'underline' }}>Forgot your password?</Link>
        </div>
      </div>
    </div>
  );
};
