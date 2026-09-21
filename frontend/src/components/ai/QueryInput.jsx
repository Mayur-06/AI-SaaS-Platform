import React, { useState, useEffect } from 'react';
import { Send, RotateCcw, AlertTriangle, Lock, Cpu, X, Sparkles } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../ui/Select';

const SUGGESTIONS = [
  'What is our refund policy?',
  'Explain our pricing tiers',
  'Summarize company guidelines',
];

const MODEL_CONFIGS = [
  { value: 'auto', label: 'Auto-Routing (Optimized)', minTier: 'free' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Fast)', minTier: 'free' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Pro)', minTier: 'pro' },
  { value: 'gpt-4', label: 'GPT-4 (Enterprise)', minTier: 'enterprise' },
];

const TIER_RANK = { free: 0, pro: 1, enterprise: 2 };

export const QueryInput = ({
  onSubmit,
  status,
  lastFailedPrompt,
  onRetry,
  quotaWarning,
  externalPrompt,
  onPromptLoaded,
}) => {
  const { role, organization } = useAuthStore();
  const isViewer = role === 'viewer';
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('auto');

  // Normalize organization plan name and compute allowed models
  const currentPlanName = (
    (typeof organization?.plan === 'string' ? organization.plan : organization?.plan?.name) || 'free'
  ).toLowerCase().trim();

  const userTierRank = TIER_RANK[currentPlanName] ?? 0;

  const isModelPermitted = (minTier) => {
    return userTierRank >= (TIER_RANK[minTier] ?? 0);
  };

  // Reset model to auto if currently selected model exceeds tier
  useEffect(() => {
    if (model !== 'auto') {
      const opt = MODEL_CONFIGS.find((m) => m.value === model);
      if (opt && !isModelPermitted(opt.minTier)) {
        setModel('auto');
      }
    }
  }, [currentPlanName]);

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
    await onSubmit(prompt.trim(), model === 'auto' ? undefined : model);
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
    <Card variant="bordered" className="shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#b2c147]/20 text-[#292929] flex items-center justify-center font-bold">
            <Sparkles size={16} />
          </div>
          <div>
            <h3
              style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
              className="text-base font-bold text-[#292929] tracking-tight"
            >
              Ask AI Assistant
            </h3>
            <p className="text-[11px] text-gray-500">
              Grounded with semantic vector retrieval & live model routing
            </p>
          </div>
        </div>

        {prompt.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            disabled={status === 'loading'}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors cursor-pointer px-2 py-1 rounded-md hover:bg-gray-100"
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

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Textarea */}
        <div className="flex flex-col gap-1.5">
          <textarea
            id="prompt-text"
            rows={3}
            placeholder="Type your query here... e.g. 'What is our refund policy?' or 'Explain our pricing tiers.'"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={status === 'loading' || isViewer}
            className="w-full px-3.5 py-3 border border-gray-200 rounded-xl text-sm bg-white placeholder-gray-400 text-[#292929]
                       focus:outline-none focus:ring-2 focus:ring-[#b2c147] focus:border-transparent transition-all
                       disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed resize-y min-h-[85px]"
          />

          {/* Quick Starter Suggestions */}
          {!prompt && !isViewer && (
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[10px] text-gray-400 font-medium uppercase font-mono tracking-wider">Try:</span>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setPrompt(s)}
                  className="text-[11px] text-gray-600 bg-gray-100 hover:bg-[#b2c147]/20 hover:text-[#292929] px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                >
                  &ldquo;{s}&rdquo;
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Model Selector & Actions Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          {/* Target Model Override */}
          <div className="flex items-center gap-2 max-w-xs w-full">
            <Cpu size={14} className="text-gray-400 shrink-0" />
            <Select value={model} onValueChange={setModel} disabled={status === 'loading' || isViewer}>
              <SelectTrigger className="w-full h-8 text-xs">
                <SelectValue placeholder="Auto-Routing (Optimized)" />
              </SelectTrigger>
              <SelectContent>
                {MODEL_CONFIGS.map((opt) => {
                  const allowed = isModelPermitted(opt.minTier);
                  return (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      disabled={!allowed}
                      className={!allowed ? 'opacity-40 cursor-not-allowed' : ''}
                    >
                      <div className="flex items-center justify-between w-full gap-2">
                        <span>{opt.label}</span>
                        {!allowed && (
                          <span className="text-[9px] font-mono uppercase bg-gray-100 text-gray-500 px-1 py-0.5 rounded border border-gray-200 shrink-0">
                            {opt.minTier} only 🔒
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
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
                  <span className="text-[10px] opacity-60 font-mono hidden sm:inline">Ctrl+↵</span>
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

