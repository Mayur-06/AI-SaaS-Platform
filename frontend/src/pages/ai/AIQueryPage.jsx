import React, { useState } from 'react';
import { QueryInput } from '../../components/ai/QueryInput';
import { ResponseCard } from '../../components/ai/ResponseCard';
import { QueryHistory } from '../../components/ai/QueryHistory';
import { DocumentPanel } from '../../components/ai/DocumentPanel';
import { aiService } from '../../services/aiService';
import { extractErrorMessage } from '../../services/api';

export const AIQueryPage = () => {
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

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 'bold' }}>AI Query & RAG Knowledge Hub</h1>
        <p style={{ color: '#666', fontSize: '0.9rem' }}>
          Query external LLMs with organization-scoped RAG retrieval, semantic caching, and dynamic model fallback.
        </p>
      </div>

      {/* Query Input Section */}
      <div style={{ marginBottom: '1.5rem' }}>
        <QueryInput
          onSubmit={handleRunQuery}
          status={queryStatus}
          lastFailedPrompt={lastPrompt}
          onRetry={handleRetry}
          quotaWarning={quotaWarning}
        />
      </div>

      {/* Response Panel */}
      <div style={{ marginBottom: '1.5rem' }}>
        <ResponseCard
          data={responseResult}
          errorInfo={errorInfo}
          isLoading={queryStatus === 'loading'}
        />
      </div>

      {/* RAG Knowledge Base Panel */}
      <div style={{ marginBottom: '1.5rem' }}>
        <DocumentPanel />
      </div>

      {/* Query History */}
      <div>
        <QueryHistory refreshTrigger={refreshHistoryTrigger} />
      </div>
    </div>
  );
};
