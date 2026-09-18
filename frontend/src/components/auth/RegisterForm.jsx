import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { extractErrorMessage } from '../../services/api';
import { AuthLayout } from './AuthLayout';

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

  const inputClass = `w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm
    bg-white placeholder-gray-400 text-[#292929]
    focus:outline-none focus:ring-2 focus:ring-[#b2c147] focus:border-transparent
    transition-shadow duration-150`;

  return (
    <AuthLayout quote="Clarity is not about having less information. It's about understanding more of it.">
      {/* Heading */}
      <div className="mb-7">
        <h1
          style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
          className="text-3xl font-bold text-[#292929] mb-2"
        >
          {inviteToken ? 'Accept Invitation' : 'Create your account'}
        </h1>
        <p className="text-sm text-gray-500">
          {inviteToken
            ? 'You were invited to join an organization on Hapy.'
            : 'Start for free — no credit card required.'}
        </p>
      </div>

      {/* Invite token notice */}
      {inviteToken && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-[#b2c147]/10 border border-[#b2c147]/30 text-[#292929] text-sm">
          Joining with invite token:{' '}
          <code className="font-mono text-xs bg-black/5 px-1.5 py-0.5 rounded">
            {inviteToken.slice(0, 12)}…
          </code>
        </div>
      )}

      {/* Error */}
      {localError && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {localError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-semibold text-[#292929]">
            Email address
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className={inputClass}
          />
        </div>

        {/* Organization name (only when not using invite) */}
        {!inviteToken && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="org" className="text-sm font-semibold text-[#292929]">
              Organization name
            </label>
            <input
              id="org"
              type="text"
              required
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="Acme Corp"
              className={inputClass}
            />
          </div>
        )}

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-semibold text-[#292929]">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 characters"
            className={inputClass}
          />
        </div>

        {/* Confirm password */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirmPassword" className="text-sm font-semibold text-[#292929]">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat password"
            className={inputClass}
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-2 px-4 py-2.5 bg-[#b2c147] text-[#292929] font-semibold text-sm
                     rounded-lg hover:brightness-110 active:scale-[0.99]
                     transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-[#b2c147] focus:ring-offset-2"
        >
          {isLoading
            ? 'Creating account…'
            : inviteToken
            ? 'Accept & Join →'
            : 'Create Organization →'}
        </button>
      </form>

      {/* Footer link */}
      <p className="mt-6 text-sm text-center text-gray-500">
        Already have an account?{' '}
        <Link
          to="/login"
          className="text-[#292929] font-semibold hover:text-[#b2c147] transition-colors duration-150 no-underline"
        >
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
};
