import React, { useState } from 'react';
import { Bot, Copy, Check, AlertCircle, FileText, Sparkles, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../ui/Collapsible';
import { SimpleTooltip } from '../ui/Tooltip';

// Lightweight, zero-dependency Markdown parser & renderer
const renderInlineMarkdown = (text) => {
  if (!text) return null;
  const tokens = [];
  const inlineRegex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = inlineRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('`') && token.endsWith('`')) {
      tokens.push(
        <code
          key={key++}
          className="font-mono text-xs text-[#b2c147] bg-white/10 px-1.5 py-0.5 rounded border border-white/5"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      tokens.push(
        <strong key={key++} className="font-bold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      tokens.push(
        <em key={key++} className="italic text-gray-300">
          {token.slice(1, -1)}
        </em>
      );
    }
    lastIndex = inlineRegex.lastIndex;
  }
  if (lastIndex < text.length) {
    tokens.push(text.substring(lastIndex));
  }

  return tokens.length > 0 ? tokens : text;
};

const MarkdownContent = ({ content }) => {
  if (!content) return null;

  const blocks = [];
  const lines = content.split('\n');
  let inCodeBlock = false;
  let codeLang = '';
  let codeLines = [];
  let currentList = null;

  const flushList = () => {
    if (currentList) {
      if (currentList.type === 'ul') {
        blocks.push(
          <ul key={blocks.length} className="list-disc list-inside space-y-1.5 my-2.5 text-gray-200">
            {currentList.items.map((item, idx) => (
              <li key={idx} className="leading-relaxed text-sm">
                {renderInlineMarkdown(item)}
              </li>
            ))}
          </ul>
        );
      } else {
        blocks.push(
          <ol key={blocks.length} className="list-decimal list-inside space-y-1.5 my-2.5 text-gray-200">
            {currentList.items.map((item, idx) => (
              <li key={idx} className="leading-relaxed text-sm">
                {renderInlineMarkdown(item)}
              </li>
            ))}
          </ol>
        );
      }
      currentList = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      flushList();
      if (inCodeBlock) {
        const codeText = codeLines.join('\n');
        blocks.push(
          <div key={blocks.length} className="my-3 rounded-xl bg-black/60 border border-white/10 overflow-hidden">
            {codeLang && (
              <div className="px-3.5 py-1 bg-white/5 border-b border-white/10 text-[10px] font-mono uppercase text-[#b2c147] tracking-wider">
                {codeLang}
              </div>
            )}
            <pre className="p-3.5 text-xs font-mono text-gray-200 overflow-x-auto selection:bg-[#b2c147] selection:text-[#292929]">
              <code>{codeText}</code>
            </pre>
          </div>
        );
        codeLines = [];
        inCodeBlock = false;
        codeLang = '';
      } else {
        inCodeBlock = true;
        codeLang = line.trim().slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    // Headings
    if (trimmed.startsWith('#### ')) {
      flushList();
      blocks.push(
        <h5 key={blocks.length} className="text-xs font-bold text-[#b2c147] uppercase tracking-wide mt-3 mb-1 font-mono">
          {renderInlineMarkdown(trimmed.slice(5))}
        </h5>
      );
      continue;
    }
    if (trimmed.startsWith('### ')) {
      flushList();
      blocks.push(
        <h4 key={blocks.length} className="text-sm font-bold text-white mt-3.5 mb-1.5 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#b2c147] shrink-0" />
          {renderInlineMarkdown(trimmed.slice(4))}
        </h4>
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushList();
      blocks.push(
        <h3 key={blocks.length} className="text-base font-bold text-white mt-4 mb-2 pb-1 border-b border-white/10">
          {renderInlineMarkdown(trimmed.slice(3))}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith('# ')) {
      flushList();
      blocks.push(
        <h2 key={blocks.length} className="text-lg font-bold text-white mt-4 mb-2">
          {renderInlineMarkdown(trimmed.slice(2))}
        </h2>
      );
      continue;
    }

    // Bullet list: - or *
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const itemText = trimmed.slice(2);
      if (!currentList || currentList.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [itemText] };
      } else {
        currentList.items.push(itemText);
      }
      continue;
    }

    // Numbered list: 1. 2. etc.
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      const itemText = numMatch[2];
      if (!currentList || currentList.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [itemText] };
      } else {
        currentList.items.push(itemText);
      }
      continue;
    }

    // Blockquote: >
    if (trimmed.startsWith('> ')) {
      flushList();
      blocks.push(
        <blockquote key={blocks.length} className="border-l-2 border-[#b2c147] pl-3 py-1 my-2 bg-white/[0.02] text-xs text-gray-300 italic">
          {renderInlineMarkdown(trimmed.slice(2))}
        </blockquote>
      );
      continue;
    }

    // Divider: ---
    if (trimmed === '---' || trimmed === '***') {
      flushList();
      blocks.push(<hr key={blocks.length} className="border-white/10 my-3" />);
      continue;
    }

    // Standard paragraph
    flushList();
    blocks.push(
      <p key={blocks.length} className="text-sm text-gray-200 leading-relaxed my-2">
        {renderInlineMarkdown(trimmed)}
      </p>
    );
  }

  flushList();

  if (inCodeBlock && codeLines.length > 0) {
    blocks.push(
      <div key={blocks.length} className="my-3 rounded-xl bg-black/60 border border-white/10 overflow-hidden">
        <pre className="p-3.5 text-xs font-mono text-gray-200 overflow-x-auto">
          <code>{codeLines.join('\n')}</code>
        </pre>
      </div>
    );
  }

  return <div className="space-y-0.5">{blocks}</div>;
};

export const ResponseCard = ({ data, errorInfo, isLoading }) => {
  const [copied, setCopied] = useState(false);
  const [isChunksOpen, setIsChunksOpen] = useState(true);

  const handleCopy = async () => {
    const textToCopy = data?.response || data?.answer || data?.response_text || '';
    if (!textToCopy) {
      toast.error('No response text to copy');
      return;
    }

    let success = false;
    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        success = true;
      } catch (err) {
        // Fallback below
      }
    }

    if (!success) {
      let textArea = null;
      try {
        textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        textArea.setAttribute('readonly', '');
        textArea.setAttribute('aria-hidden', 'true');
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        success = document.execCommand('copy');
      } catch (err) {
        console.error('Fallback copy failed:', err);
      } finally {
        // Guard against browser extensions (e.g. Grammarly) that may have
        // moved the node — removeChild only if it's still our direct child.
        if (textArea && textArea.parentNode === document.body) {
          document.body.removeChild(textArea);
        }
      }
    }

    if (success) {
      setCopied(true);
      toast.success('Response copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('Failed to copy text to clipboard');
    }
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
      <Card variant="bordered" className="text-center py-7 px-5 border-dashed border-gray-200 bg-gray-50/50">
        <div className="w-10 h-10 rounded-2xl bg-white border border-gray-200 text-gray-400 flex items-center justify-center mx-auto mb-2 shadow-2xs">
          <Bot size={20} />
        </div>
        <h3
          style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
          className="text-base font-bold text-[#292929] mb-1"
        >
          Awaiting Query
        </h3>
        <p className="text-xs text-gray-500 max-w-sm mx-auto mb-3">
          Submit a prompt using the box above to receive a grounded answer with cited document chunks and live token telemetry.
        </p>
        <div className="flex items-center justify-center gap-2 flex-wrap text-[11px] text-gray-500 font-mono">
          <span className="bg-white border border-gray-200 px-2.5 py-0.5 rounded-md">
            Sub-ms Semantic Cache
          </span>
          <span className="bg-white border border-gray-200 px-2.5 py-0.5 rounded-md">
            Vector Grounded
          </span>
        </div>
      </Card>
    );
  }

  const rawContent = data.response || data.answer || data.response_text || '';

  return (
    <Card variant="dark" className="border border-white/10 shadow-2xl relative overflow-hidden">
      {/* Subtle Lime Accent Glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-[#b2c147]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar: Essential Status Badges & Action */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#b2c147] text-[#292929] flex items-center justify-center font-bold shadow-sm">
            <Sparkles size={16} />
          </div>
          <div>
            <h3
              style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
              className="text-base font-bold text-white tracking-tight"
            >
              Synthesized Response
            </h3>
            <p className="text-[11px] text-gray-400 font-mono">
              Grounded AI output with vector citations
            </p>
          </div>
        </div>

        {/* Clean, essential badges & copy action */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="dark">{data.model_used || data.model || 'AI Model'}</Badge>
          <Badge variant={data.cache_hit ? 'lime' : 'gray'}>
            {data.cache_hit ? 'CACHE HIT' : 'LIVE LLM'}
          </Badge>
          <SimpleTooltip content="Copy response to clipboard">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors ml-1 cursor-pointer border border-white/10 hover:border-white/20 active:scale-95"
            >
              {copied ? <Check size={13} className="text-[#b2c147]" /> : <Copy size={13} />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </SimpleTooltip>
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

      {/* Main Response Output with Clean Markdown Formatting */}
      <div className="space-y-1 mb-4">
        <span className="text-gray-400 font-mono text-[10px] uppercase tracking-wider block">
          Model Response
        </span>
        <div className="bg-black/40 p-4 sm:p-5 rounded-xl border border-white/10">
          <MarkdownContent content={rawContent} />
        </div>
      </div>

      {/* Cited RAG Chunks (Collapsible) */}
      {data.cited_chunks && data.cited_chunks.length > 0 && (
        <Collapsible
          open={isChunksOpen}
          onOpenChange={setIsChunksOpen}
          className="pt-4 border-t border-white/10 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#b2c147] uppercase tracking-wider font-mono">
              <FileText size={14} />
              <span>Cited Knowledge Sources ({data.cited_chunks.length})</span>
            </div>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer py-1 px-2 rounded hover:bg-white/5"
              >
                <span>{isChunksOpen ? 'Collapse' : 'Expand'}</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${isChunksOpen ? 'rotate-180' : ''}`}
                />
              </button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent className="space-y-2.5">
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
          </CollapsibleContent>
        </Collapsible>
      )}
    </Card>
  );
};
