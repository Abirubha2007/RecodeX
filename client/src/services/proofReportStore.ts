/**
 * proofReportStore.ts
 *
 * Lightweight in-memory store that passes the latest ProofReport from
 * GreenDiffPage → ProofReportPage within the same browser session.
 *
 * No localStorage is used to avoid persisting stale reports across reloads.
 * The store is intentionally simple: one listener, one report.
 */
import type { ProofReport } from '@/types/api';

type Listener = (report: ProofReport | null) => void;

let current: ProofReport | null = null;
const listeners = new Set<Listener>();

export const proofReportStore = {
  get(): ProofReport | null {
    return current;
  },

  set(report: ProofReport | null): void {
    current = report;
    listeners.forEach(l => l(report));
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
