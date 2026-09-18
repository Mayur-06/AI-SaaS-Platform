import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import { extractErrorMessage } from '../../services/api';

export const RoutingConfig = () => {
  const [plans, setPlans] = useState([]);
  const [models, setModels] = useState([]);
  const [rules, setRules] = useState([]);
  const [permittedModels, setPermittedModels] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [savingPlan, setSavingPlan] = useState(null);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string, plan: string }
  const [editedRules, setEditedRules] = useState({}); // planName -> { primaryModelId, fallbackModelIds, timeoutSeconds }

  const loadRouting = async () => {
    setIsLoading(true);
    try {
      const data = await adminService.getRouting();
      if (data) {
        setPlans(data.plans || []);
        setModels(data.models || []);
        setRules(data.rules || []);
        setPermittedModels(data.permitted_models || {});

        const initialEdits = {};
        (data.rules || []).forEach((r) => {
          initialEdits[r.plan_name] = {
            primaryModelId: r.primary_model?.id || '',
            fallbackModelIds: (r.fallback_models || []).map((fb) => fb.id),
            timeoutSeconds: r.timeout_seconds || 10,
          };
        });
        setEditedRules(initialEdits);
      }
    } catch (err) {
      const { message } = extractErrorMessage(err);
      setFeedback({ type: 'error', message: `Failed to load routing configuration: ${message}` });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRouting();
  }, []);

  const handlePrimaryChange = (planName, modelId) => {
    setEditedRules((prev) => ({
      ...prev,
      [planName]: {
        ...prev[planName],
        primaryModelId: modelId,
      },
    }));
  };

  const handleFallbackToggle = (planName, modelId) => {
    setEditedRules((prev) => {
      const current = prev[planName] || { fallbackModelIds: [] };
      const currentFbs = current.fallbackModelIds || [];
      const newFbs = currentFbs.includes(modelId)
        ? currentFbs.filter((id) => id !== modelId)
        : [...currentFbs, modelId];
      return {
        ...prev,
        [planName]: {
          ...current,
          fallbackModelIds: newFbs,
        },
      };
    });
  };

  const handleTimeoutChange = (planName, val) => {
    const num = Math.max(1, Math.min(60, parseInt(val, 10) || 10));
    setEditedRules((prev) => ({
      ...prev,
      [planName]: {
        ...prev[planName],
        timeoutSeconds: num,
      },
    }));
  };

  const handleSave = async (planName) => {
    setFeedback(null);
    const config = editedRules[planName];
    if (!config || !config.primaryModelId) {
      setFeedback({ type: 'error', plan: planName, message: 'Please select a primary model.' });
      return;
    }

    // Client-side validation for plan-permitted models (§11.8)
    const selectedPrimary = models.find((m) => m.id === config.primaryModelId);
    const allowed = permittedModels[planName.toLowerCase()] || [];
    if (selectedPrimary && allowed.length > 0 && !allowed.includes(selectedPrimary.name)) {
      setFeedback({
        type: 'error',
        plan: planName,
        message: `Validation Error: Model "${selectedPrimary.name}" is not permitted for the ${planName.toUpperCase()} tier. Permitted models: ${allowed.join(', ')}.`,
      });
      return;
    }

    if (selectedPrimary && !selectedPrimary.is_active) {
      setFeedback({
        type: 'error',
        plan: planName,
        message: `Validation Error: Model "${selectedPrimary.name}" is currently inactive.`,
      });
      return;
    }

    setSavingPlan(planName);
    try {
      const res = await adminService.updateRouting({
        plan_name: planName,
        primary_model_id: config.primaryModelId,
        fallback_model_ids: config.fallbackModelIds || [],
        timeout_seconds: config.timeoutSeconds || 10,
      });

      setFeedback({
        type: 'success',
        plan: planName,
        message: res.message || `Successfully updated routing configuration for ${planName.toUpperCase()} tier!`,
      });
      loadRouting();
    } catch (err) {
      const { message } = extractErrorMessage(err);
      setFeedback({ type: 'error', plan: planName, message: `Update failed: ${message}` });
    } finally {
      setSavingPlan(null);
    }
  };

  const activeModels = models.filter((m) => m.is_active);

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3>Dynamic Model Routing & Circuit Breaker Configuration</h3>
          <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
            Editable multi-tier model routing with ordered fallback chains and automated circuit breakers (Ref: §9.2, §11.8).
          </p>
        </div>
        <button onClick={loadRouting} disabled={isLoading} style={{ padding: '0.25rem 0.6rem', fontSize: '0.85rem' }}>
          {isLoading ? 'Reloading...' : 'Reload Config'}
        </button>
      </div>

      {feedback && (
        <div
          className={`alert ${feedback.type === 'success' ? 'alert-success' : 'alert-error'}`}
          style={{ marginBottom: '1rem' }}
        >
          {feedback.message}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: '15%' }}>Plan Tier</th>
              <th style={{ width: '25%' }}>Primary Model</th>
              <th style={{ width: '30%' }}>Fallback Sequence</th>
              <th style={{ width: '15%' }}>Timeout (sec)</th>
              <th style={{ width: '15%' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {['free', 'pro', 'enterprise'].map((planName) => {
              const currentEdit = editedRules[planName] || {
                primaryModelId: '',
                fallbackModelIds: [],
                timeoutSeconds: 10,
              };
              const allowedNames = permittedModels[planName] || [];
              const isSaving = savingPlan === planName;

              return (
                <tr key={planName}>
                  <td>
                    <strong>{planName.toUpperCase()}</strong>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>
                      Allowed: {allowedNames.join(', ') || 'Any active'}
                    </div>
                  </td>

                  <td>
                    <select
                      value={currentEdit.primaryModelId}
                      onChange={(e) => handlePrimaryChange(planName, e.target.value)}
                      disabled={isLoading || isSaving}
                      style={{ padding: '0.3rem', width: '100%' }}
                    >
                      <option value="">-- Select Primary Model --</option>
                      {activeModels.map((m) => {
                        const isPermitted = allowedNames.length === 0 || allowedNames.includes(m.name);
                        return (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.provider}){isPermitted ? '' : ' [Tier restricted]'}
                          </option>
                        );
                      })}
                    </select>
                  </td>

                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      {activeModels
                        .filter((m) => m.id !== currentEdit.primaryModelId)
                        .map((m) => {
                          const checked = (currentEdit.fallbackModelIds || []).includes(m.id);
                          return (
                            <label
                              key={m.id}
                              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer' }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleFallbackToggle(planName, m.id)}
                                disabled={isLoading || isSaving}
                              />
                              <span>{m.name} <span style={{ color: '#888' }}>({m.provider})</span></span>
                            </label>
                          );
                        })}
                    </div>
                  </td>

                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={currentEdit.timeoutSeconds}
                        onChange={(e) => handleTimeoutChange(planName, e.target.value)}
                        disabled={isLoading || isSaving}
                        style={{ width: '60px', padding: '0.25rem 0.4rem' }}
                      />
                      <span style={{ fontSize: '0.8rem', color: '#666' }}>s</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#237804', marginTop: '4px' }}>
                      ⚡ Circuit breaker active (3 errors)
                    </div>
                  </td>

                  <td>
                    <button
                      onClick={() => handleSave(planName)}
                      disabled={isLoading || isSaving}
                      style={{ padding: '0.3rem 0.75rem', fontSize: '0.85rem' }}
                    >
                      {isSaving ? 'Saving...' : 'Save Tier'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '0.85rem', color: '#475569' }}>
        <strong>Reliability & Fallback Rules (Fix #3 / §11.8):</strong>
        <ul style={{ marginTop: '0.25rem', paddingLeft: '1.2rem', lineHeight: '1.4' }}>
          <li>Primary models execute first. If a model fails or exceeds its timeout, the system automatically attempts the next fallback in order.</li>
          <li>Circuit breakers trip after 3 consecutive failures within a 60-second window, skipping degraded providers to minimize client latency.</li>
          <li>Plan tier enforcement guarantees tenants on restricted plans cannot be assigned unauthorized LLM models.</li>
        </ul>
      </div>
    </div>
  );
};
