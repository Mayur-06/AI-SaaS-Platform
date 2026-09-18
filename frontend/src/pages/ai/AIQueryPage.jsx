import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Database, History, Columns2, Rows3 } from 'lucide-react';
import { QueryInput } from '../../components/ai/QueryInput';
import { ResponseCard } from '../../components/ai/ResponseCard';
import { QueryHistory } from '../../components/ai/QueryHistory';
import { DocumentPanel } from '../../components/ai/DocumentPanel';
import { aiService } from '../../services/aiService';
import { extractErrorMessage } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export const AIQueryPage = () => {
  const { user, organization } = useAuthStore();
  const [queryStatus, setQueryStatus] = useState('idle');
  const [responseResult, setResponseResult] = useState(null);
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);
  const [errorInfo, setErrorInfo] = useState(null);

  const [promptToLoad, setPromptToLoad] = useState('');
  const [lastPrompt, setLastPrompt] = useState('');
  const [lastModel, setLastModel] = useState(undefined);
  const [refreshHistoryTrigger, setRefreshHistoryTrigger] = useState(0);
  const [quotaWarning, setQuotaWarning] = useState(null);

  // Right sidebar tab: 'knowledge' | 'history' | 'both'
  const [sidebarTab, setSidebarTab] = useState('both');
  const [docCount, setDocCount] = useState(0);

  const handleRunQuery = async (prompt, model) => {
    setQueryStatus('loading');
    setErrorInfo(null);
    setResponseResult(null);
    setSelectedHistoryId(null);
    setLastPrompt(prompt);
    setLastModel(model);

    try {
      const data = await aiService.queryAI(prompt, model);
      const formattedResult = {
        ...data,
        query: prompt,
        response: data.response || data.answer,
        answer: data.response || data.answer,
        model_used: data.model_used || data.model,
        tokens: data.tokens || {
          prompt_tokens: data.input_tokens || 0,
          completion_tokens: data.output_tokens || 0,
          total_tokens: (data.input_tokens || 0) + (data.output_tokens || 0),
        },
        isHistorical: false,
      };

      setResponseResult(formattedResult);
      setQueryStatus('success');

      if (data.usage_warning) {
        setQuotaWarning(data.usage_warning);
      }
      setRefreshHistoryTrigger((prev) => prev + 1);
    } catch (err) {
      const extracted = extractErrorMessage(err);
      setErrorInfo(extracted);
      setQueryStatus('error');
      if (extracted.usageWarning) {
        setQuotaWarning(extracted.usageWarning);
      }
    }
  };

  const handleSelectHistoryQuery = (item) => {
    if (!item) return;

    setSelectedHistoryId(item.id);
    setErrorInfo(null);
    setQueryStatus('success');

    // Populate response card with the self-contained historical query-response pair
    setResponseResult({
      id: item.id,
      query: item.query_text,
      response: item.response_text,
      answer: item.response_text,
      model_used: item.model_used,
      model: item.model_used,
      cache_hit: item.cache_hit,
      latency_ms: item.latency_ms,
      estimated_cost: item.estimated_cost,
      tokens: {
        prompt_tokens: item.input_tokens || 0,
        completion_tokens: item.output_tokens || 0,
        total_tokens:
          item.total_tokens ??
          ((item.input_tokens || 0) + (item.output_tokens || 0)),
      },
      input_tokens: item.input_tokens || 0,
      output_tokens: item.output_tokens || 0,
      request_id: item.id,
      created_at: item.created_at,
      isHistorical: true,
    });
  };

  const handleReusePrompt = (text) => {
    setPromptToLoad(text);
  };

  const handleRetry = () => {
    if (lastPrompt) {
      handleRunQuery(lastPrompt, lastModel);
    }
  };

  if (!organization && user?.is_staff) {
    return (
      <Card variant="bordered" className="max-w-xl mx-auto text-center py-12 px-6 shadow-sm space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center mx-auto">
          <ShieldAlert size={24} />
        </div>
        <h2
          style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
          className="text-2xl font-bold text-[#292929]"
        >
          Superadmin Console Mode
        </h2>
        <p className="text-xs text-gray-500 leading-relaxed max-w-md mx-auto">
          AI Queries and RAG Knowledge Bases are scoped to tenant organizations. You are currently logged in as a <strong>Platform Superadmin</strong> without an active tenant organization context.
        </p>
        <div className="pt-2">
          <Link to="/admin" className="no-underline">
            <Button variant="dark" size="md">
              Go to Superadmin Console →
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
        <div>
          <h1
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-2xl sm:text-3xl font-extrabold text-[#292929] tracking-tight"
          >
            AI Query & Knowledge Base
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Grounded vector retrieval across organization documents with sub-millisecond semantic caching and citation telemetry.
          </p>
        </div>

        {/* Right Sidebar Controls */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200 self-start sm:self-auto text-xs">
          <button
            type="button"
            onClick={() => setSidebarTab('knowledge')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              sidebarTab === 'knowledge'
                ? 'bg-white text-[#292929] shadow-xs'
                : 'text-gray-500 hover:text-[#292929]'
            }`}
            title="Show Knowledge Base card"
          >
            <Database size={13} />
            <span>Knowledge Base {docCount > 0 ? `(${docCount})` : ''}</span>
          </button>

          <button
            type="button"
            onClick={() => setSidebarTab('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              sidebarTab === 'history'
                ? 'bg-white text-[#292929] shadow-xs'
                : 'text-gray-500 hover:text-[#292929]'
            }`}
            title="Show Query History panel"
          >
            <History size={13} />
            <span>Past Queries</span>
          </button>

          <button
            type="button"
            onClick={() => setSidebarTab('both')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              sidebarTab === 'both'
                ? 'bg-white text-[#292929] shadow-xs'
                : 'text-gray-500 hover:text-[#292929]'
            }`}
            title="Show both Knowledge Base and History"
          >
            <Columns2 size={13} />
            <span className="hidden md:inline">Both</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Responsive Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (Cols 1-7): Query Input at Top + Response Card Below */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Input box + send button at top */}
          <QueryInput
            onSubmit={handleRunQuery}
            status={queryStatus}
            lastFailedPrompt={lastPrompt}
            onRetry={handleRetry}
            quotaWarning={quotaWarning}
            externalPrompt={promptToLoad}
            onPromptLoaded={() => setPromptToLoad('')}
          />

          {/* 2. Response card below (with all metadata badges and cited sources) */}
          <ResponseCard
            data={responseResult}
            errorInfo={errorInfo}
            isLoading={queryStatus === 'loading'}
          />
        </div>

        {/* Right Column (Cols 8-12): Knowledge Base Card & Past 10 Query History */}
        <div className="lg:col-span-5 space-y-6">
          {/* Knowledge Base Card (Upload + Previous Uploaded Documents) */}
          {(sidebarTab === 'knowledge' || sidebarTab === 'both') && (
            <DocumentPanel
              onDocumentsChange={(docs) => setDocCount(docs.length)}
            />
          )}

          {/* Query History Panel (Past 10, clickable to re-view response) */}
          {(sidebarTab === 'history' || sidebarTab === 'both') && (
            <QueryHistory
              selectedId={selectedHistoryId}
              onSelectQuery={handleSelectHistoryQuery}
              onReusePrompt={handleReusePrompt}
              refreshTrigger={refreshHistoryTrigger}
              isSidebar={true}
            />
          )}
        </div>
      </div>
    </div>
  );
};
