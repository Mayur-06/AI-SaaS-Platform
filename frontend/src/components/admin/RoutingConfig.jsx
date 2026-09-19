import React, { useState, useEffect } from 'react';
import {
  Shuffle,
  Zap,
  Save,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  RefreshCw,
  Clock,
  ArrowRight,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
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
import { Switch } from '../ui/Switch';

export const RoutingConfig = () => {
  const [plans, setPlans] = useState([]);
  const [models, setModels] = useState([]);
  const [rules, setRules] = useState([]);
  const [permittedModels, setPermittedModels] = useState({});
  const [circuitBreakers, setCircuitBreakers] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [savingPlan, setSavingPlan] = useState(null);
  const [testingPlan, setTestingPlan] = useState(null);
  const [resettingPlan, setResettingPlan] = useState(null);
  const [resettingBreakers, setResettingBreakers] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [editedRules, setEditedRules] = useState({});
  const [testResults, setTestResults] = useState({});
  const [simOptions, setSimOptions] = useState({});
  const [expandedSim, setExpandedSim] = useState(null);

  const loadRouting = async () => {
    setIsLoading(true);
    try {
      const data = await adminService.getRouting();
      if (data) {
        setPlans(data.plans || []);
        setModels(data.models || []);
        setRules(data.rules || []);
        setPermittedModels(data.permitted_models || {});
        setCircuitBreakers(data.circuit_breakers || {});

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
      const resp = await adminService.updateRoutingRule(planName, {
        primary_model_id: edit.primaryModelId,
        fallback_model_ids: edit.fallbackModelIds || [],
        timeout_seconds: edit.timeoutSeconds || 10,
      });
      if (resp.circuit_breakers) {
        setCircuitBreakers(resp.circuit_breakers);
      }
      setFeedback({
        type: 'success',
        message: `Routing configuration for ${planName.toUpperCase()} saved successfully.`,
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

  const handleTestCascade = async (planName) => {
    const edit = editedRules[planName] || {};
    const sim = simOptions[planName] || {};
    setTestingPlan(planName);
    setFeedback(null);
    setExpandedSim(planName);

    try {
      const result = await adminService.testRoutingCascade(planName, {
        primary_model_id: edit.primaryModelId,
        fallback_model_ids: edit.fallbackModelIds,
        timeout_seconds: edit.timeoutSeconds,
        simulate_failure: !!sim.simulateFailure,
        simulate_timeout: !!sim.simulateTimeout,
      });

      setTestResults((prev) => ({ ...prev, [planName]: result }));
      if (result.circuit_breakers) {
        setCircuitBreakers(result.circuit_breakers);
      }

      if (result.status === 'success') {
        toast.success(`Cascade test passed! Model: ${result.model_used} (${result.latency_ms}ms)`);
      } else {
        toast.error(`Cascade simulation warning: ${result.message}`);
      }
    } catch (err) {
      const { message } = extractErrorMessage(err);
      setTestResults((prev) => ({
        ...prev,
        [planName]: {
          status: 'error',
          message,
          errors: [message],
        },
      }));
      toast.error(`Test execution failed: ${message}`);
    } finally {
      setTestingPlan(null);
    }
  };

  const handleResetDefaults = async (planName) => {
    setResettingPlan(planName);
    setFeedback(null);
    try {
      const resp = await adminService.resetRoutingRule(planName);
      toast.success(`Reset ${planName} tier to platform defaults.`);
      await loadRouting();
    } catch (err) {
      const { message } = extractErrorMessage(err);
      toast.error(`Failed to reset: ${message}`);
    } finally {
      setResettingPlan(null);
    }
  };

  const handleResetBreakers = async () => {
    setResettingBreakers(true);
    try {
      const resp = await adminService.resetCircuitBreakers();
      if (resp.circuit_breakers) {
        setCircuitBreakers(resp.circuit_breakers);
      }
      toast.success('All circuit breakers reset to healthy.');
    } catch (err) {
      const { message } = extractErrorMessage(err);
      toast.error(`Failed to reset circuit breakers: ${message}`);
    } finally {
      setResettingBreakers(false);
    }
  };

  const activeModels = models.filter((m) => m.is_active);
  const anyBreakersOpen = Object.values(circuitBreakers).some((cb) => cb?.is_open);

  return (
    <Card variant="bordered" className="shadow-sm space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-100 flex-wrap gap-3">
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

        <div className="flex items-center gap-2">
          <span
            className={`text-[11px] font-mono px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
              anyBreakersOpen
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-[#b2c147]/10 border-[#b2c147]/20 text-[#292929]'
            }`}
          >
            <Zap size={12} className={anyBreakersOpen ? 'text-amber-600' : 'text-[#b2c147]'} />
            {anyBreakersOpen ? 'Circuit Breakers: Tripped' : 'Circuit Breakers: All Healthy (0/3)'}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetBreakers}
            disabled={resettingBreakers}
            className="h-7 text-[11px] px-2.5"
          >
            <RotateCcw size={12} className={`mr-1 ${resettingBreakers ? 'animate-spin' : ''}`} />
            Reset Breakers
          </Button>
        </div>
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
              <th className="px-5 py-3.5">Fallback Cascade Order</th>
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
              const isTesting = testingPlan === planName;
              const isResetting = resettingPlan === planName;
              const testResult = testResults[planName];
              const isSimOpen = expandedSim === planName;
              const currentSim = simOptions[planName] || {};

              return (
                <React.Fragment key={planName}>
                  <tr className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-xs text-[#292929]">
                      <div className="flex items-center gap-2">
                        <Badge variant="lime">{planName}</Badge>
                        {testResult && (
                          <button
                            type="button"
                            onClick={() => setExpandedSim(isSimOpen ? null : planName)}
                            className="text-[10px] text-gray-400 hover:text-[#292929] flex items-center gap-0.5"
                          >
                            {isSimOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <Select
                        value={currentEdit.primaryModelId || ''}
                        onValueChange={(val) => handlePrimaryChange(planName, val)}
                        disabled={isLoading || isSaving || isTesting}
                      >
                        <SelectTrigger className="h-8 text-xs min-w-[190px]">
                          <SelectValue placeholder="Select Primary Model" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeModels.map((m) => {
                            const isPermitted = allowedNames.length === 0 || allowedNames.includes(m.name);
                            const key = `${m.provider}:${m.name}`;
                            const cb = circuitBreakers[key];
                            const isOpen = cb?.is_open;
                            return (
                              <SelectItem key={m.id} value={m.id}>
                                <div className="flex items-center justify-between w-full gap-2">
                                  <span>
                                    {m.name} ({m.provider})
                                    {isPermitted ? '' : ' [Tier Restricted]'}
                                  </span>
                                  {isOpen && (
                                    <span className="text-[10px] text-red-500 font-mono font-bold">
                                      [OPEN]
                                    </span>
                                  )}
                                </div>
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
                            const fallbackIndex = (currentEdit.fallbackModelIds || []).indexOf(m.id);
                            const key = `${m.provider}:${m.name}`;
                            const cb = circuitBreakers[key];
                            const isOpen = cb?.is_open;

                            return (
                              <div
                                key={m.id}
                                className="flex items-center gap-2 text-xs text-gray-700 py-0.5"
                              >
                                <Switch
                                  id={`fallback-${planName}-${m.id}`}
                                  checked={checked}
                                  onCheckedChange={() => handleFallbackToggle(planName, m.id)}
                                  disabled={isLoading || isSaving || isTesting}
                                />
                                <label
                                  htmlFor={`fallback-${planName}-${m.id}`}
                                  className="cursor-pointer font-medium text-xs text-[#292929] flex items-center gap-1.5"
                                >
                                  <span>{m.name}</span>
                                  <span className="text-gray-400 font-mono text-[10px]">({m.provider})</span>
                                  {checked && (
                                    <span className="text-[10px] font-mono px-1.5 py-0.2 bg-gray-100 text-gray-600 rounded border border-gray-200">
                                      #{fallbackIndex + 1} Fallback
                                    </span>
                                  )}
                                  {isOpen && (
                                    <span className="text-[9px] font-mono px-1 bg-red-100 text-red-600 rounded">
                                      Breaker Open
                                    </span>
                                  )}
                                </label>
                              </div>
                            );
                          })}
                        {activeModels.filter((m) => m.id !== currentEdit.primaryModelId).length === 0 && (
                          <span className="text-xs text-gray-400 italic">No fallback models available</span>
                        )}
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
                          disabled={isLoading || isSaving || isTesting}
                          className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-xs bg-white text-[#292929] focus:ring-2 focus:ring-[#b2c147] focus:outline-none"
                        />
                        <span className="text-gray-400">sec</span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleSave(planName)}
                          disabled={isLoading || isSaving || isTesting}
                          className="h-8 text-xs font-medium"
                        >
                          <Save size={13} className="mr-1" />
                          {isSaving ? 'Saving…' : 'Save'}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestCascade(planName)}
                          disabled={isLoading || isSaving || isTesting}
                          className="h-8 text-xs font-medium bg-white hover:bg-gray-50 border-gray-200"
                        >
                          <Play size={12} className={`mr-1 text-emerald-600 ${isTesting ? 'animate-pulse' : ''}`} />
                          {isTesting ? 'Testing…' : 'Test Route'}
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResetDefaults(planName)}
                          disabled={isLoading || isSaving || isTesting || isResetting}
                          className="h-8 text-xs text-gray-400 hover:text-gray-700 px-2"
                          title="Reset to recommended tier defaults"
                        >
                          <RotateCcw size={12} />
                        </Button>
                      </div>
                    </td>
                  </tr>

                  {/* Test Cascade Drawer */}
                  {isSimOpen && (
                    <tr className="bg-gray-50/50">
                      <td colSpan={5} className="px-5 py-3.5 border-t border-gray-100">
                        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm space-y-3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-[#292929] flex items-center gap-1.5">
                                <Play size={12} className="text-[#b2c147]" />
                                Cascade Simulation Diagnostic: {planName.toUpperCase()}
                              </span>
                              {testResult && (
                                <Badge variant={testResult.status === 'success' ? 'lime' : 'destructive'}>
                                  {testResult.status === 'success' ? 'Resolved' : 'Failed'}
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-xs">
                              <label className="flex items-center gap-1.5 cursor-pointer text-gray-600">
                                <input
                                  type="checkbox"
                                  checked={!!currentSim.simulateFailure}
                                  onChange={(e) =>
                                    setSimOptions((prev) => ({
                                      ...prev,
                                      [planName]: { ...currentSim, simulateFailure: e.target.checked },
                                    }))
                                  }
                                  className="rounded border-gray-300 text-[#b2c147] focus:ring-[#b2c147]"
                                />
                                <span>Simulate Primary Failure</span>
                              </label>

                              <label className="flex items-center gap-1.5 cursor-pointer text-gray-600">
                                <input
                                  type="checkbox"
                                  checked={!!currentSim.simulateTimeout}
                                  onChange={(e) =>
                                    setSimOptions((prev) => ({
                                      ...prev,
                                      [planName]: { ...currentSim, simulateTimeout: e.target.checked },
                                    }))
                                  }
                                  className="rounded border-gray-300 text-[#b2c147] focus:ring-[#b2c147]"
                                />
                                <span>Simulate Primary Timeout</span>
                              </label>

                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleTestCascade(planName)}
                                disabled={isTesting}
                                className="h-7 text-xs px-2.5"
                              >
                                {isTesting ? 'Simulating…' : 'Run Probe'}
                              </Button>
                            </div>
                          </div>

                          {testResult && (
                            <div className="space-y-2 pt-1 border-t border-gray-100">
                              <div className="text-xs font-mono text-gray-500 flex items-center gap-4 flex-wrap">
                                <span>
                                  Final Model:{' '}
                                  <strong className="text-[#292929]">
                                    {testResult.model_used || 'None'}
                                  </strong>
                                </span>
                                <span>
                                  Attempts:{' '}
                                  <strong className="text-[#292929]">{testResult.attempts || 0}</strong>
                                </span>
                                <span>
                                  Latency:{' '}
                                  <strong className="text-[#292929]">
                                    {testResult.latency_ms !== undefined ? `${testResult.latency_ms}ms` : 'N/A'}
                                  </strong>
                                </span>
                                <span>
                                  Timeout Ceiling:{' '}
                                  <strong className="text-[#292929]">{testResult.timeout_seconds}s</strong>
                                </span>
                              </div>

                              {/* Cascade Execution Stepper */}
                              {testResult.cascade_log && testResult.cascade_log.length > 0 && (
                                <div className="flex items-center gap-2 flex-wrap pt-1.5">
                                  {testResult.cascade_log.map((step, idx) => (
                                    <React.Fragment key={idx}>
                                      {idx > 0 && <ArrowRight size={12} className="text-gray-400" />}
                                      <div
                                        className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 ${
                                          step.status === 'success'
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                            : step.status === 'timeout'
                                            ? 'bg-amber-50 border-amber-200 text-amber-800'
                                            : 'bg-red-50 border-red-200 text-red-800'
                                        }`}
                                      >
                                        <span className="font-mono text-[10px] font-bold">
                                          #{idx + 1}
                                        </span>
                                        <span className="font-semibold">{step.model}</span>
                                        <span className="text-[10px] opacity-75">
                                          ({step.status === 'success' ? `${step.latency_ms}ms` : step.status})
                                        </span>
                                      </div>
                                    </React.Fragment>
                                  ))}
                                </div>
                              )}

                              {testResult.errors && testResult.errors.length > 0 && (
                                <div className="text-[11px] font-mono text-amber-800 bg-amber-50/70 border border-amber-200 p-2 rounded-lg">
                                  <strong>Fallback Diagnostic Log:</strong>
                                  <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                                    {testResult.errors.map((err, i) => (
                                      <li key={i}>{err}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Guidance Note */}
      <div className="p-4 rounded-xl bg-gray-50/80 border border-gray-200/80 text-xs text-gray-600 space-y-1.5 leading-relaxed">
        <strong className="text-[#292929] font-semibold block">Reliability & Circuit Breaker Invariants:</strong>
        <ul className="list-disc list-inside space-y-1 text-gray-500 pl-1">
          <li>
            <strong>Fallback Cascade:</strong> Primary model executes first; if a timeout or API error occurs,
            the request seamlessly cascades to the next configured fallback in real time.
          </li>
          <li>
            <strong>Timeout Ceilings:</strong> Model calls are strictly bounded by the configured per-tier timeout (1–60s)
            via asynchronous non-blocking thread workers.
          </li>
          <li>
            <strong>Dynamic Circuit Breaker:</strong> Automatically trips open after 3 consecutive failures within 60 seconds
            to eliminate user wait times.
          </li>
          <li>
            <strong>Tier Enforcement:</strong> Plan restrictions prevent organizations on lower tiers from invoking unauthorized high-cost models.
          </li>
        </ul>
      </div>
    </Card>
  );
};

