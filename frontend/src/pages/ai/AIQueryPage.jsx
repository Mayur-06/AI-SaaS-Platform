import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
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
  const [errorInfo, setErrorInfo] = useState(null);

  const [lastPrompt, setLastPrompt] = useState('');
  const [lastModel, setLastModel] = useState(undefined);
  const [refreshHistoryTrigger, setRefreshHistoryTrigger] = useState(0);
  const [quotaWarning, setQuotaWarning] = useState(null);

  const handleRunQuery = async (prompt, model) => {
    setQueryStatus('loading');
    setErrorInfo(null);
    setResponseResult(null);
    setLastPrompt(prompt);
    setLastModel(model);

    try {
      const data = await aiService.queryAI(prompt, model);
      setResponseResult(data);
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
    <div className="space-y-8 animate-fade-in">
      {/* Top Header */}
      <div className="pb-2 border-b border-gray-100">
        <h1
          style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
          className="text-2xl sm:text-3xl font-extrabold text-[#292929] tracking-tight"
        >
          AI Query & RAG Knowledge Hub
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-3xl">
          Execute natural language prompts with organization-isolated vector RAG retrieval, sub-millisecond semantic similarity caching, and automated LLM fallback.
        </p>
      </div>

      {/* 2-Column Responsive Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Query Input + Live Output Response */}
        <div className="lg:col-span-6 space-y-6">
          <QueryInput
            onSubmit={handleRunQuery}
            status={queryStatus}
            lastFailedPrompt={lastPrompt}
            onRetry={handleRetry}
            quotaWarning={quotaWarning}
          />

          <ResponseCard
            data={responseResult}
            errorInfo={errorInfo}
            isLoading={queryStatus === 'loading'}
          />
        </div>

        {/* Right Column: RAG Document Knowledge Base */}
        <div className="lg:col-span-6">
          <DocumentPanel />
        </div>

      </div>

      {/* Bottom Full-Width Telemetry & History */}
      <QueryHistory refreshTrigger={refreshHistoryTrigger} />
    </div>
  );
};
