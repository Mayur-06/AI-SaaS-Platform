import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { extractErrorMessage } from '../../services/api';
import { AuthLayout } from './AuthLayout';

export const RegisterForm = () => {
  const [searchParams] = useSearchParams();
  const inviteTokenFromUrl = searchParams.get('invite_token') || searchParams.get('token') || '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [organizationName, setOrganizationName] = useState('');
  const [inviteToken, setInviteToken] = useState(inviteTokenFromUrl);
  const [localError, setLocalError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const { register, isLoading } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (inviteTokenFromUrl) {
      setInviteToken(inviteTokenFromUrl);
    }
  }, [inviteTokenFromUrl]);

  const clearFieldError = (field) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (localError) setLocalError(null);
  };

  const validateForm = () => {
    const errors = {};
    const trimmedEmail = email.trim();
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!trimmedEmail) {
      errors.email = 'Email address is required.';
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!inviteToken) {
      const trimmedOrg = organizationName.trim();
      if (!trimmedOrg) {
        errors.organizationName = 'Organization name is required.';
      } else if (trimmedOrg.length < 2) {
        errors.organizationName = 'Organization name must be at least 2 characters.';
      }
    }

    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters long.';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Confirm password is required.';
    } else if (password && password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);

    if (!validateForm()) {
      return;
    }

    try {
      await register({
        email: email.trim(),
        password,
        confirm_password: confirmPassword,
        organization_name: inviteToken ? undefined : organizationName.trim(),
        invite_token: inviteToken || undefined,
      });
      navigate('/dashboard');
    } catch (err) {
      const { message } = extractErrorMessage(err);
      const lower = (message || '').toLowerCase();
      if (lower.includes('email')) {
        setFieldErrors((prev) => ({ ...prev, email: message }));
      } else if (lower.includes('password')) {
        setFieldErrors((prev) => ({ ...prev, password: message }));
      } else if (lower.includes('organization')) {
        setFieldErrors((prev) => ({ ...prev, organizationName: message }));
      } else {
        setLocalError(message || 'Registration failed.');
      }
    }
  };

  const getInputClass = (hasError) =>
    `w-full px-3.5 py-2.5 border rounded-lg text-sm bg-white placeholder-gray-400 text-[#292929]
     focus:outline-none transition-all duration-150 ${
       hasError
         ? 'border-red-500 focus:ring-2 focus:ring-red-400/30'
         : 'border-gray-200 focus:ring-2 focus:ring-[#b2c147] focus:border-transparent'
     }`;

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
            : 'Start for free'}
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

      <form noValidate onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-semibold text-[#292929]">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearFieldError('email');
            }}
            placeholder="you@company.com"
            className={getInputClass(!!fieldErrors.email)}
          />
          {fieldErrors.email && (
            <p className="text-xs text-red-600 mt-1">{fieldErrors.email}</p>
          )}
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
              value={organizationName}
              onChange={(e) => {
                setOrganizationName(e.target.value);
                clearFieldError('organizationName');
              }}
              placeholder="Acme Corp"
              className={getInputClass(!!fieldErrors.organizationName)}
            />
            {fieldErrors.organizationName && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.organizationName}</p>
            )}
          </div>
        )}

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-semibold text-[#292929]">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearFieldError('password');
              }}
              placeholder="Min 8 characters"
              className={`${getInputClass(!!fieldErrors.password)} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {fieldErrors.password && (
            <p className="text-xs text-red-600 mt-1">{fieldErrors.password}</p>
          )}
        </div>

        {/* Confirm password */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirmPassword" className="text-sm font-semibold text-[#292929]">
            Confirm password
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                clearFieldError('confirmPassword');
              }}
              placeholder="Repeat password"
              className={`${getInputClass(!!fieldErrors.confirmPassword)} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {fieldErrors.confirmPassword && (
            <p className="text-xs text-red-600 mt-1">{fieldErrors.confirmPassword}</p>
          )}
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
