import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Database, History, Columns2, Rows3, BrainCircuit } from 'lucide-react';
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

  // Right sidebar tab: 'knowledge' | 'history' | 'split'
  const [sidebarTab, setSidebarTab] = useState('knowledge');
  const [docCount, setDocCount] = useState(0);
  const [historyCount, setHistoryCount] = useState(0);
  const [mobileSection, setMobileSection] = useState('query');

  const handleRunQuery = async (prompt, model) => {
    setQueryStatus('loading');
    setErrorInfo(null);
    setResponseResult(null);
    setSelectedHistoryId(null);
    setLastPrompt(prompt);
    setLastModel(model);
    setMobileSection('query');

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
    setMobileSection('query');
  };

  const handleReusePrompt = (text) => {
    setPromptToLoad(text);
    setMobileSection('query');
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

        {/* Status Indicator */}
        <div className="flex items-center gap-2 text-xs font-mono text-gray-500 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl self-start sm:self-auto shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-[#b2c147]" />
          <span>{docCount} {docCount === 1 ? 'doc' : 'docs'} indexed</span>
        </div>
      </div>

      {/* Mobile / Tablet Workspace Section Switcher (< lg) */}
      <div className="flex lg:hidden items-center p-1 bg-gray-200/80 rounded-xl max-w-md w-full mx-auto">
        <button
          type="button"
          onClick={() => setMobileSection('query')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            mobileSection === 'query'
              ? 'bg-white text-[#292929] shadow-xs'
              : 'text-gray-500 hover:text-[#292929]'
          }`}
        >
          <BrainCircuit size={14} />
          <span>Query Console</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileSection('context')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            mobileSection === 'context'
              ? 'bg-white text-[#292929] shadow-xs'
              : 'text-gray-500 hover:text-[#292929]'
          }`}
        >
          <Database size={14} />
          <span>Context &amp; History ({docCount + historyCount})</span>
        </button>
      </div>

      {/* Main 2-Column Responsive Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (Cols 1-7): Query Input at Top + Response Card Below */}
        <div className={`lg:col-span-7 min-w-0 space-y-5 ${mobileSection === 'context' ? 'hidden lg:block' : 'block'}`}>
          {/* 1. Sleek Query Input Console */}
          <QueryInput
            onSubmit={handleRunQuery}
            status={queryStatus}
            lastFailedPrompt={lastPrompt}
            onRetry={handleRetry}
            quotaWarning={quotaWarning}
            externalPrompt={promptToLoad}
            onPromptLoaded={() => setPromptToLoad('')}
          />

          {/* 2. Response Card (with telemetry badges & cited chunks) */}
          <ResponseCard
            data={responseResult}
            errorInfo={errorInfo}
            isLoading={queryStatus === 'loading'}
          />
        </div>

        {/* Right Column (Cols 8-12): Unified Context & History Hub */}
        <div className={`lg:col-span-5 min-w-0 ${mobileSection === 'query' ? 'hidden lg:block' : 'block'}`}>
          <Card variant="bordered" className="shadow-sm p-0 overflow-hidden">
            {/* Header Tabs: Knowledge Base | Past Queries | Split View */}
            <div className="px-4 py-3 bg-gray-50/75 border-b border-gray-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 bg-gray-200/70 p-1 rounded-xl w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setSidebarTab('knowledge')}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    sidebarTab === 'knowledge'
                      ? 'bg-white text-[#292929] shadow-xs'
                      : 'text-gray-500 hover:text-[#292929]'
                  }`}
                >
                  <Database size={13} />
                  <span>Knowledge Base {docCount > 0 ? `(${docCount})` : ''}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSidebarTab('history')}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    sidebarTab === 'history'
                      ? 'bg-white text-[#292929] shadow-xs'
                      : 'text-gray-500 hover:text-[#292929]'
                  }`}
                >
                  <History size={13} />
                  <span>Past Queries {historyCount > 0 ? `(${historyCount})` : ''}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSidebarTab('split')}
                  className={`flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    sidebarTab === 'split'
                      ? 'bg-white text-[#292929] shadow-xs'
                      : 'text-gray-500 hover:text-[#292929]'
                  }`}
                  title="Side-by-side split view"
                >
                  <Columns2 size={13} />
                  <span className="hidden xl:inline">Split</span>
                </button>
              </div>
            </div>

            {/* Hub Body */}
            <div className="p-4 sm:p-5">
              {sidebarTab === 'knowledge' && (
                <DocumentPanel
                  isEmbedded={true}
                  onDocumentsChange={(docs) => setDocCount(docs.length)}
                />
              )}

              {sidebarTab === 'history' && (
                <QueryHistory
                  isEmbedded={true}
                  selectedId={selectedHistoryId}
                  onSelectQuery={handleSelectHistoryQuery}
                  refreshTrigger={refreshHistoryTrigger}
                  onHistoryChange={(items) => setHistoryCount(items.length)}
                />
              )}

              {sidebarTab === 'split' && (
                <div className="space-y-6">
                  <DocumentPanel
                    isEmbedded={true}
                    isSplit={true}
                    onDocumentsChange={(docs) => setDocCount(docs.length)}
                  />
                  <div className="border-t border-gray-100 pt-5">
                    <QueryHistory
                      isEmbedded={true}
                      isSplit={true}
                      selectedId={selectedHistoryId}
                      onSelectQuery={handleSelectHistoryQuery}
                      refreshTrigger={refreshHistoryTrigger}
                      onHistoryChange={(items) => setHistoryCount(items.length)}
                    />
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
