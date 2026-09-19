import React, { useState, useEffect } from 'react';
import { Shuffle, Zap, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { extractErrorMessage } from '../../services/api';
import { toast } from 'sonner';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../ui/Select';

export const RoutingConfig = () => {
  const [plans, setPlans] = useState([]);
  const [models, setModels] = useState([]);
  const [rules, setRules] = useState([]);
  const [permittedModels, setPermittedModels] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [savingPlan, setSavingPlan] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [editedRules, setEditedRules] = useState({});

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
      const updated = currentFbs.includes(modelId)
        ? currentFbs.filter((id) => id !== modelId)
        : [...currentFbs, modelId];
      return {
        ...prev,
        [planName]: {
          ...current,
          fallbackModelIds: updated,
        },
      };
    });
  };

  const handleTimeoutChange = (planName, value) => {
    const val = parseInt(value, 10) || 10;
    setEditedRules((prev) => ({
      ...prev,
      [planName]: {
        ...prev[planName],
        timeoutSeconds: val,
      },
    }));
  };

  const handleSave = async (planName) => {
    const edit = editedRules[planName];
    if (!edit || !edit.primaryModelId) {
      setFeedback({ type: 'error', message: 'Please designate a primary LLM model.', plan: planName });
      return;
    }

    setSavingPlan(planName);
    setFeedback(null);
    try {
      await adminService.updateRoutingRule(planName, {
        primary_model_id: edit.primaryModelId,
        fallback_model_ids: edit.fallbackModelIds || [],
        timeout_seconds: edit.timeoutSeconds || 10,
      });
      setFeedback({
        type: 'success',
        message: `Routing rules for ${planName} updated. Circuit breaker thresholds applied.`,
        plan: planName,
      });
      toast.success(`Routing rules for ${planName} updated.`);
      await loadRouting();
    } catch (err) {
      const { message } = extractErrorMessage(err);
      setFeedback({ type: 'error', message: `Failed to save rule: ${message}`, plan: planName });
      toast.error(`Failed to save rule: ${message}`);
    } finally {
      setSavingPlan(null);
    }
  };

  const activeModels = models.filter((m) => m.is_active);

  return (
    <Card variant="bordered" className="shadow-sm space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-100 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#b2c147]/15 text-[#292929] flex items-center justify-center">
            <Shuffle size={16} />
          </div>
          <div>
            <h3
              style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
              className="text-lg font-bold text-[#292929] tracking-tight"
            >
              Model Routing & Dynamic Circuit Breakers
            </h3>
            <p className="text-xs text-gray-500">
              Configure per-tier primary model execution order, automated fallbacks, and timeout ceilings
            </p>
          </div>
        </div>

        <span className="text-[11px] font-mono text-[#b2c147] bg-[#b2c147]/10 border border-[#b2c147]/20 px-2.5 py-1 rounded-full">
          ⚡ Circuit Breaker: 3 Consecutive Failures
        </span>
      </div>

      {feedback && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs flex items-center gap-2 ${
            feedback.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-green-50 border-green-200 text-green-800'
          }`}
        >
          {feedback.type === 'error' ? (
            <AlertCircle size={16} className="text-red-600 shrink-0" />
          ) : (
            <CheckCircle2 size={16} className="text-green-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Rules Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50/80 text-xs font-mono text-gray-500 uppercase tracking-wider border-b border-gray-200">
            <tr>
              <th className="px-5 py-3.5">Plan Tier</th>
              <th className="px-5 py-3.5">Primary Model</th>
              <th className="px-5 py-3.5">Fallback Cascade</th>
              <th className="px-5 py-3.5">Timeout</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {plans.map((p) => {
              const planName = p.name || p;
              const currentEdit = editedRules[planName] || {};
              const allowedNames = permittedModels[planName] || [];
              const isSaving = savingPlan === planName;

              return (
                <tr key={planName} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-5 py-3.5 font-semibold text-xs text-[#292929]">
                    <Badge variant="lime">{planName}</Badge>
                  </td>

                  <td className="px-5 py-3.5">
                    <Select
                      value={currentEdit.primaryModelId || ''}
                      onValueChange={(val) => handlePrimaryChange(planName, val)}
                      disabled={isLoading || isSaving}
                    >
                      <SelectTrigger className="h-8 text-xs min-w-[180px]">
                        <SelectValue placeholder="Select Primary Model" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeModels.map((m) => {
                          const isPermitted = allowedNames.length === 0 || allowedNames.includes(m.name);
                          return (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name} ({m.provider}){isPermitted ? '' : ' [Restricted]'}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </td>

                  <td className="px-5 py-3.5">
                    <div className="flex flex-col gap-1.5">
                      {activeModels
                        .filter((m) => m.id !== currentEdit.primaryModelId)
                        .map((m) => {
                          const checked = (currentEdit.fallbackModelIds || []).includes(m.id);
                          return (
                            <label
                              key={m.id}
                              className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleFallbackToggle(planName, m.id)}
                                disabled={isLoading || isSaving}
                                className="w-3.5 h-3.5 rounded border-gray-300 accent-[#b2c147]"
                              />
                              <span>
                                {m.name} <span className="text-gray-400 font-mono text-[10px]">({m.provider})</span>
                              </span>
                            </label>
                          );
                        })}
                    </div>
                  </td>

                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5 font-mono text-xs">
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={currentEdit.timeoutSeconds || 10}
                        onChange={(e) => handleTimeoutChange(planName, e.target.value)}
                        disabled={isLoading || isSaving}
                        className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-xs bg-white text-[#292929] focus:ring-2 focus:ring-[#b2c147] focus:outline-none"
                      />
                      <span className="text-gray-400">sec</span>
                    </div>
                  </td>

                  <td className="px-5 py-3.5 text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleSave(planName)}
                      disabled={isLoading || isSaving}
                    >
                      {isSaving ? 'Saving…' : 'Save Rule'}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Guidance Note */}
      <div className="p-4 rounded-xl bg-gray-50/80 border border-gray-200/80 text-xs text-gray-600 space-y-1.5 leading-relaxed">
        <strong className="text-[#292929] font-semibold block">Reliability & Circuit Breaker Invariants:</strong>
        <ul className="list-disc list-inside space-y-1 text-gray-500 pl-1">
          <li>Primary models execute first; on timeout or HTTP 5xx, the request cascades to the next configured fallback in real time.</li>
          <li>Circuit breakers automatically trip after 3 consecutive failures within a 60-second window to prevent user wait times.</li>
          <li>Plan tier restrictions prevent organizations on lower tiers from invoking unauthorized high-cost models.</li>
        </ul>
      </div>
    </Card>
  );
};
