import React, { useState } from 'react';
import { Send, RotateCcw, AlertTriangle, Lock, Cpu } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

export const QueryInput = ({
  onSubmit,
  status,
  lastFailedPrompt,
  onRetry,
  quotaWarning,
}) => {
  const { role } = useAuthStore();
  const isViewer = role === 'viewer';
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim() || status === 'loading' || isViewer) return;
    await onSubmit(prompt, model || undefined);
  };

  return (
    <Card variant="bordered" className="shadow-sm relative overflow-hidden">
      {/* Subtle top accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-[#b2c147]" />

      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100">
        <div>
          <h3
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-lg font-bold text-[#292929] tracking-tight"
          >
            Submit AI Query
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Grounded vector retrieval across organization documents with semantic caching
          </p>
        </div>
      </div>

      {/* Viewer read-only notification */}
      {isViewer && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 text-xs flex items-start gap-2.5">
          <Lock size={16} className="text-gray-500 shrink-0 mt-0.5" />
          <div>
            <strong className="text-[#292929]">Read-Only Mode:</strong> Your account role is{' '}
            <span className="font-mono font-semibold uppercase">VIEWER</span>. Submitting queries
            is restricted to Members, Admins, and Owners. You can browse cached queries and documents below.
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
          <label
            htmlFor="prompt-text"
            className="text-xs font-semibold uppercase tracking-wider text-[#292929] font-mono"
          >
            Prompt / Question
          </label>
          <textarea
            id="prompt-text"
            rows={4}
            placeholder="Type your prompt here... Relevant documents in your organization's store will be automatically cited."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={status === 'loading' || isViewer}
            className="w-full px-3.5 py-3 border border-gray-200 rounded-xl text-sm bg-white placeholder-gray-400 text-[#292929]
                       focus:outline-none focus:ring-2 focus:ring-[#b2c147] focus:border-transparent transition-all
                       disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed resize-y min-h-[100px]"
          />
        </div>

        {/* Model Selector */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="model-select"
            className="text-xs font-semibold uppercase tracking-wider text-gray-600 font-mono flex items-center gap-1.5"
          >
            <Cpu size={14} className="text-gray-500" />
            <span>Target Model (Optional Override)</span>
          </label>
          <div className="relative">
            <select
              id="model-select"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={status === 'loading' || isViewer}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-[#292929]
                         focus:outline-none focus:ring-2 focus:ring-[#b2c147] focus:border-transparent transition-all
                         disabled:bg-gray-50 disabled:text-gray-400 appearance-none cursor-pointer"
            >
              <option value="">Auto-Routing (Optimized by Plan Tier & Latency)</option>
              <option value="gemini-2.5-flash">Gemini 2.5 Flash (Default / High Speed)</option>
              <option value="gpt-4o-mini">GPT-4o Mini (Pro Tier)</option>
              <option value="gpt-4">GPT-4 (Enterprise Tier)</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
              ▼
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2">
          <Button
            type="submit"
            variant="primary"
            disabled={status === 'loading' || !prompt.trim() || isViewer}
            className="flex items-center gap-2"
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
                <span>Submit Query</span>
                <Send size={14} />
              </>
            )}
          </Button>

          {status === 'error' && onRetry && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={onRetry}
              className="flex items-center gap-1.5"
            >
              <RotateCcw size={13} />
              <span>Retry Query</span>
            </Button>
          )}

          {lastFailedPrompt && status === 'error' && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setPrompt(lastFailedPrompt)}
            >
              Restore Last Prompt
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
};
