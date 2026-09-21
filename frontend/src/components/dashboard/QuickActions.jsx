import React, { useState } from 'react';
import { Sparkles, Send, Check, Copy } from 'lucide-react';
import { aiService } from '../../services/aiService';
import { useAuthStore } from '../../store/authStore';
import { extractErrorMessage } from '../../services/api';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { toast } from 'sonner';
import { copyToClipboard } from '../../lib/utils';

export const QuickActions = ({ onQueryComplete }) => {
  const { role } = useAuthStore();
  const isViewer = role === 'viewer';
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim() || isViewer) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await aiService.queryAI(prompt);
      setResult(res);
      setPrompt('');
      if (onQueryComplete) onQueryComplete();
    } catch (err) {
      const { message, code } = extractErrorMessage(err);
      setError(`[${code || 'ERROR'}] ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    const text = result?.response || result?.answer || result?.response_text || '';
    if (!text) {
      toast.error('Nothing to copy');
      return;
    }
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      toast.success('Response copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <Card variant="dark" className="relative overflow-hidden shadow-xl">
      {/* Subtle lime ambient glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-[#b2c147]/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#b2c147]/20 text-[#b2c147] flex items-center justify-center">
            <Sparkles size={16} />
          </div>
          <div>
            <h3
              style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
              className="text-lg font-bold text-white tracking-tight"
            >
              Quick AI Query
            </h3>
            <p className="text-xs text-gray-400">
              Run prompt synthesis against your organization&apos;s active knowledge base
            </p>
          </div>
        </div>

        <span className="text-[11px] font-mono text-[#b2c147] bg-[#b2c147]/10 border border-[#b2c147]/20 px-2.5 py-0.5 rounded-full hidden sm:inline-block">
          Semantic Cache Enabled
        </span>
      </div>

      {/* Error alert */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Viewer read-only warning */}
      {isViewer && (
        <div className="mb-4 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs italic">
          Viewer accounts are read-only. Query execution requires Member, Admin, or Owner privileges.
        </div>
      )}

      {/* Query Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder={
                isViewer
                  ? 'Read-only mode (queries restricted to Member/Admin/Owner)...'
                  : 'Ask anything (e.g. "What is multi-tenancy in SaaS?" or "Summarize Q3 revenue")...'
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isLoading || isViewer}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#b2c147] focus:border-transparent transition-all disabled:opacity-50"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={isLoading || !prompt.trim() || isViewer}
            className="sm:w-auto w-full flex items-center gap-2 py-3 px-5 text-sm shrink-0"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin w-4 h-4 text-[#292929]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Processing…</span>
              </>
            ) : (
              <>
                <span>Send Query</span>
                <Send size={14} />
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Result Output Panel */}
      {result && (
        <div className="mt-5 p-4 sm:p-5 rounded-xl bg-black/40 border border-white/10 space-y-3 animate-fade-up">
          {/* Metadata Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs pb-3 border-b border-white/10">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="dark">{result.model_used}</Badge>
              <Badge variant={result.cache_hit ? 'lime' : 'gray'}>
                {result.cache_hit ? 'CACHE HIT' : 'LIVE LLM'}
              </Badge>
              <span className="font-mono text-gray-400">
                {result.latency_ms}ms
              </span>
              <span className="font-mono text-[#b2c147]">
                ${Number(result.estimated_cost).toFixed(5)}
              </span>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-white px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
            >
              {copied ? <Check size={12} className="text-[#b2c147]" /> : <Copy size={12} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Response Text */}
          <div className="text-sm text-gray-200 leading-relaxed font-sans whitespace-pre-wrap selection:bg-[#b2c147] selection:text-[#292929]">
            {result.response}
          </div>
        </div>
      )}
    </Card>
  );
};
