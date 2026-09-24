// ─── DOM Mutation Safeguard ───────────────────────────────────────────────────
// Third-party browser extensions (Google Translate, Grammarly, password managers)
// or Radix portal detaches can mutate or re-parent DOM nodes outside of React's
// knowledge. Patching removeChild and insertBefore prevents React from throwing
// "NotFoundError: Failed to execute 'removeChild' on 'Node'" crashes.
if (typeof window !== 'undefined' && typeof Node !== 'undefined' && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function (child) {
    if (child && child.parentNode !== this) {
      if (child.parentNode) {
        return child.parentNode.removeChild(child);
      }
      return child;
    }
    return originalRemoveChild.apply(this, arguments);
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (referenceNode.parentNode) {
        return referenceNode.parentNode.insertBefore(newNode, referenceNode);
      }
      return this.appendChild(newNode);
    }
    return originalInsertBefore.apply(this, arguments);
  };
}

import React, { useEffect, Component } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppRoutes } from './routes';
import { useAuthStore } from './store/authStore';
import { TooltipProvider } from './components/ui/Tooltip';
import './index.css';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Frontend ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // If error is a spurious DOM detachment error, don't crash the entire screen
      if (this.state.error?.name === 'NotFoundError' && this.state.error?.message?.includes('removeChild')) {
        return this.props.children;
      }

      return (
        <div style={{ padding: '2rem', maxWidth: '600px', margin: '2rem auto', border: '1px solid #d9363e', borderRadius: '6px', background: '#fff1f0' }}>
          <h2 style={{ color: '#a8071a', marginBottom: '0.5rem' }}>An error occurred while rendering the application</h2>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#fff', padding: '0.75rem', border: '1px solid #ffa39e', borderRadius: '4px', fontSize: '0.85rem' }}>
            {this.state.error?.toString()}
          </pre>
          <div style={{ marginTop: '1rem' }}>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.href = '/login';
              }}
              style={{ padding: '0.5rem 1rem', background: '#222', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Clear Session & Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const App = () => {
  const { initializeAuth } = useAuthStore();

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <BrowserRouter>
      <TooltipProvider delayDuration={200}>
        <AppRoutes />
      </TooltipProvider>
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          style: {
            fontFamily: 'Inter, sans-serif',
            fontSize: '13px',
            borderRadius: '12px',
          },
        }}
      />
    </BrowserRouter>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
