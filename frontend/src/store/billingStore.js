import { create } from 'zustand';
import { billingService } from '../services/billingService';

export const useBillingStore = create((set, get) => ({
  currentPlan: null,
  availablePlans: [],
  usage: null,
  invoices: [],
  isLoading: false,
  error: null,
  lastFetched: null,

  fetchBillingData: async (force = false) => {
    const state = get();
    if (state.isLoading) return;
    const now = Date.now();
    // Cache for 5 seconds unless forced or data is missing
    if (!force && state.currentPlan && state.usage && state.lastFetched && (now - state.lastFetched < 5000)) {
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const [planData, usageData, invoiceData] = await Promise.all([
        billingService.getPlan().catch(() => null),
        billingService.getUsage().catch(() => null),
        billingService.getInvoices().catch(() => ({ results: [] })),
      ]);

      set({
        currentPlan: planData?.current_plan || null,
        availablePlans: planData?.plans || [],
        usage: usageData,
        invoices: invoiceData?.results || [],
        isLoading: false,
        lastFetched: Date.now(),
      });
    } catch (err) {
      set({ error: err.message || 'Failed to fetch billing data', isLoading: false });
    }
  },

  upgradePlan: async (planId) => {
    set({ isLoading: true });
    try {
      const result = await billingService.upgradePlan(planId);
      set({ currentPlan: result.current_plan, isLoading: false });
      await get().fetchUsage();
    } catch (err) {
      set({ error: err.message || 'Upgrade failed', isLoading: false });
      throw err;
    }
  },

  fetchUsage: async () => {
    try {
      const usage = await billingService.getUsage();
      set({ usage, lastFetched: Date.now() });
    } catch (err) {
      console.error('Failed to refresh usage:', err);
    }
  },

  fetchInvoices: async () => {
    try {
      const res = await billingService.getInvoices();
      set({ invoices: res.results || [] });
    } catch (err) {
      console.error('Failed to refresh invoices:', err);
    }
  },
}));
