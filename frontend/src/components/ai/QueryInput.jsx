import React, { useState, useEffect } from 'react';
import { Send, RotateCcw, AlertTriangle, Lock, Cpu, X } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

export const QueryInput = ({
  onSubmit,
  status,
  lastFailedPrompt,
  onRetry,
  quotaWarning,
  externalPrompt,
  onPromptLoaded,
}) => {
  const { role } = useAuthStore();
  const isViewer = role === 'viewer';
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('');

  // Sync external prompt when loaded from history
  useEffect(() => {
    if (externalPrompt !== undefined && externalPrompt !== null) {
      setPrompt(externalPrompt);
      if (onPromptLoaded) onPromptLoaded();
    }
  }, [externalPrompt, onPromptLoaded]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || status === 'loading' || isViewer) return;
    await onSubmit(prompt.trim(), model || undefined);
  };

  const handleKeyDown = (e) => {
    // Ctrl+Enter or Cmd+Enter to submit
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleClear = () => {
    setPrompt('');
  };

  return (
    <Card variant="bordered" className="shadow-sm relative overflow-hidden">
      {/* Subtle accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-[#b2c147]" />

      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100">
        <div>
          <h3
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-lg font-bold text-[#292929] tracking-tight"
          >
            Input Box
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Type your natural language query or question. Press <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-gray-100 border border-gray-200 rounded">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-gray-100 border border-gray-200 rounded">Enter</kbd> to send.
          </p>
        </div>

        {prompt.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            disabled={status === 'loading'}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
          >
            <X size={13} />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Viewer read-only notification */}
      {isViewer && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 text-xs flex items-start gap-2.5">
          <Lock size={16} className="text-gray-500 shrink-0 mt-0.5" />
          <div>
            <strong className="text-[#292929]">Read-Only Mode:</strong> Your account role is{' '}
            <span className="font-mono font-semibold uppercase">VIEWER</span>. Submitting queries
            is restricted to Members, Admins, and Owners. You can browse past queries and responses.
          </div>
        </div>
      )}

      {/* Quota warning */}
      {quotaWarning && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-600 shrink-0" />
          <span>
            <strong>Quota Warning:</strong>{' '}
            {quotaWarning === 'approaching_limit'
              ? 'You have consumed 80%+ of your organization’s monthly query limit.'
              : quotaWarning}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Textarea */}
        <div className="flex flex-col gap-1.5">
          <textarea
            id="prompt-text"
            rows={4}
            placeholder="Type your query here... e.g. 'What is our refund policy?' or 'Explain our pricing tiers.'"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={status === 'loading' || isViewer}
            className="w-full px-3.5 py-3 border border-gray-200 rounded-xl text-sm bg-white placeholder-gray-400 text-[#292929]
                       focus:outline-none focus:ring-2 focus:ring-[#b2c147] focus:border-transparent transition-all
                       disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed resize-y min-h-[90px]"
          />
        </div>

        {/* Model Selector & Actions Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          {/* Target Model Override */}
          <div className="flex items-center gap-2 max-w-xs w-full">
            <Cpu size={14} className="text-gray-400 shrink-0" />
            <div className="relative w-full">
              <select
                id="model-select"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={status === 'loading' || isViewer}
                className="w-full px-3 py-1.5 pr-8 border border-gray-200 rounded-lg text-xs bg-white text-[#292929]
                           focus:outline-none focus:ring-2 focus:ring-[#b2c147] focus:border-transparent transition-all
                           disabled:bg-gray-50 disabled:text-gray-400 appearance-none cursor-pointer"
              >
                <option value="">Auto-Routing (Optimized)</option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fast)</option>
                <option value="gpt-4o-mini">GPT-4o Mini (Pro)</option>
                <option value="gpt-4">GPT-4 (Enterprise)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-400 text-[10px]">
                ▼
              </div>
            </div>
          </div>

          {/* Form Action Buttons */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {lastFailedPrompt && status === 'error' && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setPrompt(lastFailedPrompt)}
              >
                Restore Last
              </Button>
            )}

            {status === 'error' && onRetry && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={onRetry}
                className="flex items-center gap-1.5"
              >
                <RotateCcw size={13} />
                <span>Retry</span>
              </Button>
            )}

            <Button
              type="submit"
              variant="primary"
              disabled={status === 'loading' || !prompt.trim() || isViewer}
              className="flex items-center gap-2 px-4"
            >
              {status === 'loading' ? (
                <>
                  <svg className="animate-spin w-4 h-4 text-[#292929]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Synthesizing Answer…</span>
                </>
              ) : (
                <>
                  <span>Send Query</span>
                  <Send size={14} />
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
};

