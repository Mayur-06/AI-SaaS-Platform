import React, { useState, useEffect } from 'react';
import { Database, Sliders, Trash2, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { aiService } from '../../services/aiService';
import { extractErrorMessage } from '../../services/api';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '../ui/AlertDialog';

export const CacheStats = ({ userRole, isActive }) => {
  const [stats, setStats] = useState(null);
  const [savedThreshold, setSavedThreshold] = useState(null);
  const [thresholdInput, setThresholdInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPurgeDialogOpen, setIsPurgeDialogOpen] = useState(false);

  const canManage = userRole === 'owner' || userRole === 'admin';

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const [data, threshData] = await Promise.all([
        aiService.getCacheStats().catch(() => null),
        aiService.getCacheThreshold().catch(() => null),
      ]);
      if (data) setStats(data);
      const serverThresh = threshData?.threshold ?? data?.threshold;
      if (serverThresh !== undefined && serverThresh !== null) {
        setSavedThreshold(serverThresh);
        setThresholdInput(String(serverThresh));
      }
    } catch (err) {
      console.error('Error fetching cache stats', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isActive !== false) {
      fetchStats();
    }
  }, [isActive]);

  const handleClearCache = async () => {
    setIsLoading(true);
    try {
      const res = await aiService.clearCache();
      toast.success(res?.message || res?.detail || 'Semantic cache purged successfully.');
      setIsPurgeDialogOpen(false);
      await fetchStats();
    } catch (err) {
      const { message } = extractErrorMessage(err);
      toast.error(`Failed to clear cache: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveThreshold = async (e) => {
    e.preventDefault();
    const val = parseFloat(thresholdInput);
    if (isNaN(val) || val < 0.80 || val > 0.99) {
      toast.error('Match Threshold must be between 0.80 and 0.99.');
      if (savedThreshold !== null) {
        setThresholdInput(String(savedThreshold));
      }
      return;
    }

    setIsLoading(true);
    try {
      const res = await aiService.updateCacheThreshold(val);
      const newThresh = res.threshold ?? val;
      setSavedThreshold(newThresh);
      setThresholdInput(String(newThresh));
      toast.success(`Similarity threshold updated to ${newThresh}.`);
      await fetchStats();
    } catch (err) {
      const { message } = extractErrorMessage(err);
      toast.error(`Failed to update threshold: ${message}`);
      if (savedThreshold !== null) {
        setThresholdInput(String(savedThreshold));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card variant="bordered" className="shadow-sm space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-100 flex-wrap gap-2">
        <div>
          <h3
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-lg font-bold text-[#292929] tracking-tight"
          >
            Semantic Cache Administration
          </h3>
          <p className="text-xs text-gray-500">
            Configure cosine vector distance thresholds and manage cache invalidation
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={fetchStats}
          disabled={isLoading}
          className="flex items-center gap-1.5"
        >
          <RotateCw size={13} className={isLoading ? 'animate-spin text-[#b2c147]' : ''} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* 3 Metric Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-gray-50/80 border border-gray-200/80 space-y-1">
          <div className="text-xs font-mono text-gray-500 uppercase tracking-wider">
            Active Cache Entries
          </div>
          <div
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-2xl font-bold text-[#292929]"
          >
            {stats?.valid_entries ?? stats?.cache_entries_count ?? stats?.total_entries ?? 0}
          </div>
          <div className="text-[11px] text-gray-400 font-mono">Retained in vector store</div>
        </div>

        <div className="p-4 rounded-xl bg-gray-50/80 border border-gray-200/80 space-y-1">
          <div className="text-xs font-mono text-gray-500 uppercase tracking-wider">
            Similarity Threshold
          </div>
          <div
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-2xl font-bold text-[#292929]"
          >
            {savedThreshold !== null ? savedThreshold : (isLoading ? '...' : '—')}
          </div>
          <div className="text-[11px] text-gray-400 font-mono">Cosine similarity required</div>
        </div>

        <div className="p-4 rounded-xl bg-gray-50/80 border border-gray-200/80 space-y-1">
          <div className="text-xs font-mono text-gray-500 uppercase tracking-wider">
            Engine Architecture
          </div>
          <div
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-xl font-bold text-[#292929] truncate"
          >
            Redis + pgvector
          </div>
          <div className="text-[11px] text-gray-400 font-mono">all-MiniLM-L6-v2 (384d)</div>
        </div>
      </div>

      {/* Admin Action Form */}
      {canManage && (
        <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <form noValidate onSubmit={handleSaveThreshold} className="flex items-end gap-2.5">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="cache-threshold"
                className="text-xs font-semibold uppercase tracking-wider text-gray-600 font-mono flex items-center gap-1.5"
              >
                <Sliders size={13} className="text-gray-400" />
                <span>Match Threshold (0.80 - 0.99)</span>
              </label>
              <input
                id="cache-threshold"
                type="number"
                step="0.01"
                min="0.80"
                max="0.99"
                placeholder={savedThreshold !== null ? String(savedThreshold) : '0.95'}
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
                className="w-36 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-[#292929] focus:outline-none focus:ring-2 focus:ring-[#b2c147]"
              />
            </div>
            <Button type="submit" variant="secondary" size="md" disabled={isLoading}>
              Save Threshold
            </Button>
          </form>

          <AlertDialog open={isPurgeDialogOpen} onOpenChange={setIsPurgeDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="danger"
                size="md"
                disabled={isLoading}
                className="flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Trash2 size={14} />
                <span>Purge Cache</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Purge Semantic Cache?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will clear all cached query-response pairs and invalidate all Redis and pgvector cache entries for this organization. Future identical queries will require full model inference.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="danger" onClick={handleClearCache}>
                  Yes, purge cache
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </Card>
  );
};
