import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { authService } from '../../services/authService';
import { extractErrorMessage } from '../../services/api';
import { AuthLayout } from '../../components/auth/AuthLayout';

export const VerifyEmailPage = () => {
  const { token } = useParams();
  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'error'
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token in URL.');
      return;
    }

    authService
      .verifyEmail(token)
      .then((res) => {
        setStatus('success');
        setMessage(res.message || 'Your email address has been successfully verified!');
      })
      .catch((err) => {
        setStatus('error');
        const { message } = extractErrorMessage(err);
        setMessage(message || 'Invalid or expired verification token.');
      });
  }, [token]);

  return (
    <AuthLayout quote="Your knowledge, finally within reach.">
      <div className="text-center">
        {/* Icon */}
        <div className="mb-6 inline-flex items-center justify-center w-14 h-14 rounded-full
                        bg-[#b2c147]/10 border border-[#b2c147]/20">
          {status === 'verifying' && (
            <svg className="w-6 h-6 text-[#b2c147] animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          {status === 'success' && (
            <svg className="w-6 h-6 text-[#b2c147]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          )}
          {status === 'error' && (
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>

        {/* Heading */}
        <h1
          style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
          className="text-2xl font-bold text-[#292929] mb-2"
        >
          {status === 'verifying' && 'Verifying your email…'}
          {status === 'success' && 'Email Verified!'}
          {status === 'error' && 'Verification Failed'}
        </h1>

        {/* Message */}
        {message && (
          <p className={`text-sm mb-6 ${status === 'error' ? 'text-red-600' : 'text-gray-500'}`}>
            {message}
          </p>
        )}

        {/* Actions */}
        {status === 'success' && (
          <Link
            to="/login"
            className="inline-flex items-center justify-center px-5 py-2.5
                       bg-[#b2c147] text-[#292929] font-semibold text-sm rounded-lg
                       hover:brightness-110 transition-all duration-150 no-underline"
          >
            Proceed to Sign In →
          </Link>
        )}

        {status === 'error' && (
          <Link
            to="/login"
            className="inline-flex items-center justify-center px-5 py-2.5
                       border border-gray-200 text-[#292929] font-semibold text-sm rounded-lg
                       hover:bg-gray-50 transition-all duration-150 no-underline"
          >
            ← Back to Sign In
          </Link>
        )}
      </div>
    </AuthLayout>
  );
};
