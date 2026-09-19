import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../../services/authService';
import { extractErrorMessage } from '../../services/api';
import { AuthLayout } from './AuthLayout';

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
  const [fieldErrors, setFieldErrors] = useState({});

  const clearFieldError = (field) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (error) setError(null);
  };

  const handleStep1Submit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const errors = {};
    const trimmedEmail = email.trim();
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail) {
      errors.email = 'Email address is required.';
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      errors.email = 'Please enter a valid email address.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);

    try {
      const res = await authService.requestPasswordReset(trimmedEmail);
      setMessage(res.message || 'Password reset requested.');
      if (res.token) {
        setReceivedTokenHint(res.token);
        setToken(res.token);
      }
      setFieldErrors({});
      setStep(2);
    } catch (err) {
      const { message } = extractErrorMessage(err);
      setError(message || 'Failed to request reset.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStep2Submit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const errors = {};
    if (!token.trim()) {
      errors.token = 'Reset token is required.';
    }
    if (!newPassword) {
      errors.newPassword = 'New password is required.';
    } else if (newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters long.';
    }
    if (!confirmPassword) {
      errors.confirmPassword = 'Confirm new password is required.';
    } else if (newPassword && newPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);
    try {
      const res = await authService.confirmPasswordReset(token.trim(), newPassword, confirmPassword);
      setMessage(res.message || 'Password has been reset successfully!');
      setStep(1);
      setEmail('');
      setToken('');
      setNewPassword('');
      setConfirmPassword('');
      setReceivedTokenHint(null);
      setFieldErrors({});
    } catch (err) {
      const { message } = extractErrorMessage(err);
      setError(message || 'Failed to reset password.');
    } finally {
      setIsLoading(false);
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
    <AuthLayout quote="Your knowledge, finally within reach.">
      {/* Heading */}
      <div className="mb-7">
        <h1
          style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
          className="text-3xl font-bold text-[#292929] mb-2"
        >
          Reset your password
        </h1>
        <p className="text-sm text-gray-500">
          {step === 1
            ? 'Enter your email and we\'ll send you a reset token.'
            : 'Enter the token you received and set a new password.'}
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors duration-200
                ${step >= s
                  ? 'bg-[#b2c147] text-[#292929]'
                  : 'bg-gray-100 text-gray-400'}`}
            >
              {s}
            </div>
            {s < 2 && (
              <div className={`h-px w-8 transition-colors duration-200 ${step > s ? 'bg-[#b2c147]' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
        <span className="ml-2 text-xs text-gray-400">
          {step === 1 ? 'Request token' : 'Set new password'}
        </span>
      </div>

      {/* Success message */}
      {message && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
          {message}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* ── STEP 1 ── */}
      {step === 1 ? (
        <form noValidate onSubmit={handleStep1Submit} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reset-email" className="text-sm font-semibold text-[#292929]">
              Email address
            </label>
            <input
              id="reset-email"
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

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 px-4 py-2.5 bg-[#b2c147] text-[#292929] font-semibold text-sm
                       rounded-lg hover:brightness-110 active:scale-[0.99]
                       transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-[#b2c147] focus:ring-offset-2"
          >
            {isLoading ? 'Sending…' : 'Request Reset Token →'}
          </button>
        </form>
      ) : (
        /* ── STEP 2 ── */
        <form noValidate onSubmit={handleStep2Submit} className="space-y-4">
          {/* Dev token hint */}
          {receivedTokenHint && (
            <div className="px-4 py-3 rounded-lg bg-[#b2c147]/10 border border-[#b2c147]/30 text-[#292929] text-sm break-all">
              <span className="font-semibold">Demo token: </span>
              <code className="font-mono text-xs">{receivedTokenHint}</code>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="token" className="text-sm font-semibold text-[#292929]">
              Reset token
            </label>
            <input
              id="token"
              type="text"
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                clearFieldError('token');
              }}
              placeholder="Paste token here"
              className={getInputClass(!!fieldErrors.token)}
            />
            {fieldErrors.token && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.token}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-password" className="text-sm font-semibold text-[#292929]">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                clearFieldError('newPassword');
              }}
              placeholder="Min 8 characters"
              className={getInputClass(!!fieldErrors.newPassword)}
            />
            {fieldErrors.newPassword && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.newPassword}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirm-reset-password" className="text-sm font-semibold text-[#292929]">
              Confirm new password
            </label>
            <input
              id="confirm-reset-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                clearFieldError('confirmPassword');
              }}
              placeholder="Confirm new password"
              className={getInputClass(!!fieldErrors.confirmPassword)}
            />
            {fieldErrors.confirmPassword && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.confirmPassword}</p>
            )}
          </div>

          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 bg-white border border-gray-200 text-[#292929] font-semibold text-sm
                         rounded-lg hover:bg-gray-50 transition-all duration-150
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Back
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-[2] px-4 py-2.5 bg-[#b2c147] text-[#292929] font-semibold text-sm
                         rounded-lg hover:brightness-110 active:scale-[0.99]
                         transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed
                         focus:outline-none focus:ring-2 focus:ring-[#b2c147] focus:ring-offset-2"
            >
              {isLoading ? 'Resetting…' : 'Confirm Reset →'}
            </button>
          </div>
        </form>
      )}

      {/* Footer */}
      <p className="mt-6 text-sm text-center text-gray-500">
        Remember your password?{' '}
        <Link
          to="/login"
          className="text-[#292929] font-semibold hover:text-[#b2c147] transition-colors duration-150 no-underline"
        >
          Back to Sign In
        </Link>
      </p>
    </AuthLayout>
  );
};
