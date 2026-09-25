import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { REMEMBER_ME_KEY, REMEMBERED_EMAIL_KEY, extractErrorMessage } from '../../services/api';
import { AuthLayout } from './AuthLayout';

export const LoginForm = () => {
  const [rememberMe, setRememberMe] = useState(
    () => localStorage.getItem(REMEMBER_ME_KEY) === 'true'
  );
  const [email, setEmail] = useState(() => {
    const isRemembered = localStorage.getItem(REMEMBER_ME_KEY) === 'true';
    return isRemembered ? (localStorage.getItem(REMEMBERED_EMAIL_KEY) || '') : '';
  });
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

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

    if (!password) {
      errors.password = 'Password is required.';
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
      const data = await login(email.trim(), password, rememberMe);
      if (data?.user?.is_staff) {
        navigate('/admin-console');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      const { message } = extractErrorMessage(err);
      setLocalError(message || 'Invalid email or password.');
    }
  };

  const getInputClass = (hasError) =>
    `w-full px-3.5 py-2.5 border rounded-lg text-sm bg-white placeholder-gray-400 text-[#292929]
     focus:outline-none transition-all duration-150 ${
       hasError
         ? 'border-red-500 focus:ring-2 focus:ring-red-400/30'
         : 'border-gray-200 focus:ring-2 focus:ring-[#b2c147] focus:border-transparent'
     }`;

  const [showPassword, setShowPassword] = useState(false);

  return (
    <AuthLayout quote="The best insights shouldn't be buried under hundreds of pages.">
      {/* Heading */}
      <div className="mb-8">
        <h1
          style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
          className="text-3xl font-bold text-[#292929] mb-2"
        >
          Welcome back
        </h1>
        <p className="text-sm text-gray-500">Sign in to your Hapy account</p>
      </div>

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

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-semibold text-[#292929]">
              Password
            </label>
            <Link
              to="/password-reset"
              className="text-xs text-gray-400 hover:text-[#b2c147] transition-colors duration-150 no-underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearFieldError('password');
              }}
              placeholder="••••••••"
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

        {/* Remember me */}
        <div className="flex items-center gap-2.5">
          <input
            id="remember"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 accent-[#b2c147] cursor-pointer"
          />
          <label htmlFor="remember" className="text-sm text-gray-500 cursor-pointer font-normal">
            Remember me
          </label>
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
          {isLoading ? 'Signing in…' : 'Sign In →'}
        </button>
      </form>

      {/* Footer link */}
      <p className="mt-6 text-sm text-center text-gray-500">
        Don&apos;t have an account?{' '}
        <Link
          to="/register"
          className="text-[#292929] font-semibold hover:text-[#b2c147] transition-colors duration-150 no-underline"
        >
          Create one free
        </Link>
      </p>
    </AuthLayout>
  );
};
