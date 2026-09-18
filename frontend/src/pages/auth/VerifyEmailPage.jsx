import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { authService } from '../../services/authService';
import { extractErrorMessage } from '../../services/api';

export const VerifyEmailPage = () => {
  const { token } = useParams();
  const [status, setStatus] = useState('verifying');
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
    <div className="centered-auth">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <h2 style={{ marginBottom: '1rem' }}>Email Verification</h2>

        {status === 'verifying' && <p>Verifying your email token...</p>}

        {status === 'success' && (
          <div>
            <div className="alert alert-success">{message}</div>
            <Link to="/login" className="btn btn-primary" style={{ display: 'inline-block', marginTop: '1rem' }}>
              Proceed to Sign In
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div>
            <div className="alert alert-error">{message}</div>
            <Link to="/login" style={{ textDecoration: 'underline', marginTop: '1rem', display: 'inline-block' }}>
              Back to Sign In
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
