import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { extractErrorMessage } from '../../services/api';

export const RegisterForm = () => {
  const [searchParams] = useSearchParams();
  const inviteTokenFromUrl = searchParams.get('invite_token') || searchParams.get('token') || '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [inviteToken, setInviteToken] = useState(inviteTokenFromUrl);
  const [localError, setLocalError] = useState(null);

  const { register, isLoading } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (inviteTokenFromUrl) {
      setInviteToken(inviteTokenFromUrl);
    }
  }, [inviteTokenFromUrl]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }

    if (!inviteToken && !organizationName.trim()) {
      setLocalError('Organization name is required when creating a new organization.');
      return;
    }

    try {
      await register({
        email,
        password,
        confirm_password: confirmPassword,
        organization_name: inviteToken ? undefined : organizationName,
        invite_token: inviteToken || undefined,
      });
      navigate('/dashboard');
    } catch (err) {
      const { message } = extractErrorMessage(err);
      setLocalError(message || 'Registration failed.');
    }
  };

  return (
    <div className="auth-card">
      <h2 style={{ marginBottom: '1rem', textAlign: 'center' }}>
        {inviteToken ? 'Accept Invitation & Register' : 'Create an Account'}
      </h2>

      {inviteToken && (
        <div className="alert alert-info">
          Joining an existing organization with invite token: <code>{inviteToken.slice(0, 10)}...</code>
        </div>
      )}

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

        {!inviteToken && (
          <div className="form-group">
            <label htmlFor="org">Organization Name</label>
            <input
              id="org"
              type="text"
              required
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="Acme Corp"
            />
          </div>
        )}

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 characters"
          />
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            id="confirmPassword"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat password"
          />
        </div>

        <button
          type="submit"
          className="btn-primary"
          style={{ width: '100%', marginTop: '0.5rem' }}
          disabled={isLoading}
        >
          {isLoading ? 'Creating account...' : inviteToken ? 'Accept & Join' : 'Create Organization'}
        </button>
      </form>

      <div style={{ marginTop: '1rem', fontSize: '0.85rem', textAlign: 'center' }}>
        Already have an account? <Link to="/login" style={{ textDecoration: 'underline' }}>Sign In</Link>
      </div>
    </div>
  );
};
