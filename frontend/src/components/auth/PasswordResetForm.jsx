import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../../services/authService';

export const PasswordResetForm = () => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [receivedTokenHint, setReceivedTokenHint] = useState(null);

  const handleStep1Submit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    try {
      const res = await authService.requestPasswordReset(email);
      setMessage(res.message || 'Password reset requested.');
      if (res.token) {
        setReceivedTokenHint(res.token);
        setToken(res.token);
      }
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to request reset.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStep2Submit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authService.confirmPasswordReset(token, newPassword, confirmPassword);
      setMessage(res.message || 'Password has been reset successfully!');
      setStep(1);
      setEmail('');
      setToken('');
      setNewPassword('');
      setConfirmPassword('');
      setReceivedTokenHint(null);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <h2 style={{ marginBottom: '1rem', textAlign: 'center' }}>Reset Password</h2>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {step === 1 ? (
        <form onSubmit={handleStep1Submit}>
          <p style={{ fontSize: '0.9rem', marginBottom: '1rem', color: '#555' }}>
            Step 1: Enter your account email to receive a password reset token.
          </p>

          <div className="form-group">
            <label htmlFor="reset-email">Email Address</label>
            <input
              id="reset-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={isLoading}
          >
            {isLoading ? 'Requesting...' : 'Request Reset Token'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleStep2Submit}>
          <p style={{ fontSize: '0.9rem', marginBottom: '1rem', color: '#555' }}>
            Step 2: Enter the reset token and your new password.
          </p>

          {receivedTokenHint && (
            <div className="alert alert-info" style={{ wordBreak: 'break-all' }}>
              <strong>Demo Token:</strong> <code>{receivedTokenHint}</code>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="token">Reset Token</label>
            <input
              id="token"
              type="text"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste token here"
            />
          </div>

          <div className="form-group">
            <label htmlFor="new-password">New Password</label>
            <input
              id="new-password"
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 8 characters"
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirm-reset-password">Confirm New Password</label>
            <input
              id="confirm-reset-password"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setStep(1)}
              style={{ flex: 1 }}
              disabled={isLoading}
            >
              Back
            </button>
            <button
              type="submit"
              className="btn-primary"
              style={{ flex: 2 }}
              disabled={isLoading}
            >
              {isLoading ? 'Resetting...' : 'Confirm Reset'}
            </button>
          </div>
        </form>
      )}

      <div style={{ marginTop: '1.5rem', fontSize: '0.85rem', textAlign: 'center' }}>
        Remember your password? <Link to="/login" style={{ textDecoration: 'underline' }}>Back to Sign In</Link>
      </div>
    </div>
  );
};
