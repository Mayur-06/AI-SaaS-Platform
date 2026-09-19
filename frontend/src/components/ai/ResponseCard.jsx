import React, { useState } from 'react';
import { Bot, Copy, Check, AlertCircle, FileText, Sparkles } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

export const ResponseCard = ({ data, errorInfo, isLoading }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!data?.response) return;
    navigator.clipboard.writeText(data.response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <Card variant="dark" className="border border-white/10 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#b2c147]/20 text-[#b2c147] flex items-center justify-center animate-pulse">
            <Bot size={18} />
          </div>
          <div>
            <h3
              style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
              className="text-base font-bold text-white tracking-tight"
            >
              Generating Grounded Response…
            </h3>
            <p className="text-xs text-gray-400">
              Retrieving relevant vector chunks and synthesizing answer through model routing pipeline
            </p>
          </div>
        </div>

        {/* Skeleton lines */}
        <div className="mt-5 space-y-2.5 opacity-40">
          <div className="h-3 bg-white/20 rounded w-11/12 animate-pulse" />
          <div className="h-3 bg-white/20 rounded w-full animate-pulse" />
          <div className="h-3 bg-white/20 rounded w-3/4 animate-pulse" />
        </div>
      </Card>
    );
  }

  if (errorInfo) {
    return (
      <Card variant="bordered" className="border-red-200 bg-red-50/40 shadow-sm">
        <div className="flex items-center gap-2.5 text-red-700 mb-3">
          <AlertCircle size={18} />
          <h3
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-base font-bold tracking-tight"
          >
            Query Execution Failed
          </h3>
        </div>

        <div className="space-y-2 text-xs text-red-800">
          <div>
            <strong>Error:</strong> {errorInfo.message}
          </div>
          {errorInfo.code && (
            <div>
              <strong>Code:</strong>{' '}
              <code className="font-mono bg-red-100/80 px-1.5 py-0.5 rounded">
                {errorInfo.code}
              </code>
            </div>
          )}
          {errorInfo.requestId && (
            <div>
              <strong>Request ID:</strong>{' '}
              <code className="font-mono bg-red-100/80 px-1.5 py-0.5 rounded">
                {errorInfo.requestId}
              </code>
            </div>
          )}
          {errorInfo.rateLimitReset && (
            <div>
              <strong>Rate Limit Resets In:</strong> {errorInfo.rateLimitReset} seconds
            </div>
          )}
        </div>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card variant="bordered" className="text-center py-10 border-dashed border-gray-200">
        <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-2.5">
          <Bot size={20} />
        </div>
        <h3
          style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
          className="text-base font-bold text-[#292929] mb-1"
        >
          Awaiting Query
        </h3>
        <p className="text-xs text-gray-500 max-w-sm mx-auto">
          Enter a prompt above to view model output, grounded knowledge citations, and token telemetry.
        </p>
      </Card>
    );
  }

  return (
    <Card variant="dark" className="border border-white/10 shadow-xl relative overflow-hidden">
      {/* Subtle lime ambient light */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-[#b2c147]/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Header Bar with Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#b2c147] text-[#292929] flex items-center justify-center font-bold text-xs">
            <Sparkles size={14} />
          </div>
          <span
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-base font-bold text-white tracking-tight"
          >
            Synthesized Answer
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {data.isHistorical && (
            <span className="text-[11px] font-mono font-medium text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
              Historical Query
            </span>
          )}
          <Badge variant="dark">{data.model_used || data.model || 'Auto'}</Badge>
          {data.provider && (
            <Badge variant="gray" className="uppercase text-[10px]">
              {data.provider}
            </Badge>
          )}
          <Badge variant={data.cache_hit ? 'lime' : 'gray'}>
            {data.cache_hit ? '⚡ CACHE HIT' : '🔄 LIVE LLM'}
          </Badge>
          <span className="text-xs font-mono text-gray-300 bg-white/5 px-2 py-0.5 rounded border border-white/5">
            ⏱️ {data.latency_ms ?? 0} ms
          </span>
          <span className="text-xs font-mono text-[#b2c147] bg-[#b2c147]/10 px-2 py-0.5 rounded font-semibold border border-[#b2c147]/20">
            ${Number(data.estimated_cost || 0).toFixed(5)}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-white px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors ml-1 cursor-pointer border border-white/5"
          >
            {copied ? <Check size={12} className="text-[#b2c147]" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Usage Warning Banner if any */}
      {data.usage_warning && (
        <div className="mb-4 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
          <strong>Usage Warning:</strong> {data.usage_warning}
        </div>
      )}

      {/* Query Prompt (Self-Contained Query-Response Pair) */}
      {data.query && (
        <div className="mb-4 p-3.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs space-y-1">
          <div className="flex items-center justify-between text-gray-400 font-mono text-[10px] uppercase tracking-wider">
            <span>Query Prompt</span>
            {data.created_at && (
              <span>{new Date(data.created_at).toLocaleString()}</span>
            )}
          </div>
          <p className="text-white font-medium text-sm leading-relaxed">
            {data.query}
          </p>
        </div>
      )}

      {/* Main Response Output */}
      <div className="space-y-1 mb-4">
        <span className="text-gray-400 font-mono text-[10px] uppercase tracking-wider block">
          Model Response
        </span>
        <div className="text-sm text-gray-200 leading-relaxed font-sans whitespace-pre-wrap selection:bg-[#b2c147] selection:text-[#292929] bg-black/40 p-4 sm:p-5 rounded-xl border border-white/10">
          {data.response || data.answer}
        </div>
      </div>

      {/* Token & Telemetry Breakdown Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/10 text-xs text-gray-400 font-mono">
        <div>
          <span className="text-gray-500 block text-[10px] uppercase">Prompt Tokens</span>
          <span className="text-white font-semibold">
            {data.tokens?.prompt_tokens ?? data.input_tokens ?? '-'}
          </span>
        </div>
        <div>
          <span className="text-gray-500 block text-[10px] uppercase">Completion Tokens</span>
          <span className="text-white font-semibold">
            {data.tokens?.completion_tokens ?? data.output_tokens ?? '-'}
          </span>
        </div>
        <div>
          <span className="text-gray-500 block text-[10px] uppercase">Total Tokens</span>
          <span className="text-white font-semibold">
            {data.tokens?.total_tokens ?? (Number(data.input_tokens || 0) + Number(data.output_tokens || 0)) ?? '-'}
          </span>
        </div>
        <div>
          <span className="text-gray-500 block text-[10px] uppercase">Request ID</span>
          <span className="text-gray-300 truncate block font-mono text-[11px]" title={data.request_id}>
            {data.request_id || '-'}
          </span>
        </div>
      </div>

      {/* Cited RAG Chunks */}
      {data.cited_chunks && data.cited_chunks.length > 0 && (
        <div className="pt-4 border-t border-white/10 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#b2c147] uppercase tracking-wider font-mono">
            <FileText size={14} />
            <span>Cited Knowledge Sources ({data.cited_chunks.length})</span>
          </div>

          <div className="space-y-2.5">
            {data.cited_chunks.map((chunk, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-300 space-y-1.5"
              >
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="font-semibold text-white">
                    📄 {chunk.document_title || 'Organization Document'}{' '}
                    {chunk.chunk_index !== undefined ? `[Chunk #${chunk.chunk_index}]` : ''}
                  </span>
                  {chunk.score && (
                    <span className="text-[#b2c147] font-semibold bg-[#b2c147]/10 px-2 py-0.5 rounded">
                      Match: {(chunk.score * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
                <p className="text-gray-400 font-sans italic text-xs leading-relaxed">
                  &ldquo;{chunk.content}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};
