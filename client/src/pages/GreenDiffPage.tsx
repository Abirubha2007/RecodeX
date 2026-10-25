import { useState, useCallback, useRef } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { useNavigate } from 'react-router-dom';
import {
  GitCompare,
  Play,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  FileCheck,
  ArrowRight,
} from 'lucide-react';
import { api } from '@/services/api';
import { proofReportStore } from '@/services/proofReportStore';
import type { CompareResponse } from '@/types/api';

const DEFAULT_ORIGINAL_PYTHON = `# Original Code (O(n^2) Bubble Sort)
def sort_numbers(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr

numbers = [64, 34, 25, 12, 22, 11, 90]
print("Sorted:", sort_numbers(numbers))
`;

const DEFAULT_CANDIDATE_PYTHON = `# Optimized Candidate (O(n log n) Timsort)
def sort_numbers(arr):
    return sorted(arr)

numbers = [64, 34, 25, 12, 22, 11, 90]
print("Sorted:", sort_numbers(numbers))
`;

const VERDICT_STYLES = {
  improvement: { bg: 'var(--color-success-bg)', color: 'var(--color-success)', icon: CheckCircle },
  equivalent:  { bg: 'var(--color-info-bg)',    color: 'var(--color-info)',    icon: Info },
  regression:  { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)', icon: AlertTriangle },
  failed:      { bg: 'var(--color-error-bg)',   color: 'var(--color-error)',   icon: XCircle },
  unverified:  { bg: 'var(--color-surface-2)',  color: 'var(--color-muted)',   icon: AlertTriangle },
};

export function GreenDiffPage() {
  const navigate = useNavigate();

  const [language, setLanguage] = useState(() =>
    sessionStorage.getItem('greenDiffLanguage') || 'python'
  );

  const [original, setOriginal] = useState(() => {
    const stored = sessionStorage.getItem('greenDiffOriginal');
    if (stored) { sessionStorage.removeItem('greenDiffOriginal'); return stored; }
    return DEFAULT_ORIGINAL_PYTHON;
  });

  const [candidate, setCandidate] = useState(() => {
    const stored = sessionStorage.getItem('greenDiffCandidate');
    if (stored) { sessionStorage.removeItem('greenDiffCandidate'); return stored; }
    return DEFAULT_CANDIDATE_PYTHON;
  });

  const [testInput, setTestInput] = useState('');
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const diffEditorRef = useRef<any>(null);
  const initialOriginalRef = useRef(original);
  const initialCandidateRef = useRef(candidate);

  const handleCompare = useCallback(async () => {
    const origEditor = diffEditorRef.current?.getOriginalEditor();
    const candEditor = diffEditorRef.current?.getModifiedEditor();
    const origCode = (origEditor?.getModel()?.getValue() ?? origEditor?.getValue?.() ?? original).trim();
    const candCode = (candEditor?.getModel()?.getValue() ?? candEditor?.getValue?.() ?? candidate).trim();

    if (!origCode && !candCode) { setError('Please provide both original and candidate code.'); return; }
    if (!origCode)              { setError('Original code cannot be empty.'); return; }
    if (!candCode)              { setError('Optimized candidate code cannot be empty.'); return; }

    setLoading(true);
    setError(null);
    proofReportStore.set(null); // clear stale report before new run

    try {
      const r = await api.compare({
        language,
        original_code: origCode,
        candidate_code: candCode,
        test_inputs: testInput ? [testInput] : [],
      });
      setResult(r);
      // Publish proof report to the store so ProofReportPage can read it
      if (r.proof_report) {
        proofReportStore.set(r.proof_report);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [language, original, candidate, testInput]);

  const verdict = result?.verdict as keyof typeof VERDICT_STYLES | undefined;
  const vStyle  = verdict ? VERDICT_STYLES[verdict] : null;
  const VIcon   = vStyle?.icon;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div className="diff-toolbar">
        <GitCompare size={18} style={{ color: 'var(--color-primary)' }} />
        <span style={{ fontWeight: 600, color: 'var(--color-heading)' }}>Green Diff</span>

        <select
          id="diff-lang-select"
          className="select"
          style={{ width: 150 }}
          value={language}
          onChange={e => setLanguage(e.target.value)}
        >
          {['python', 'c', 'cpp', 'javascript', 'java'].map(l => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>

        <input
          id="diff-test-input"
          className="input"
          style={{ width: 220 }}
          placeholder="Test stdin (optional)"
          value={testInput}
          onChange={e => setTestInput(e.target.value)}
        />

        <button
          id="compare-btn"
          className="btn btn-primary"
          onClick={handleCompare}
          disabled={loading}
        >
          {loading ? <span className="spinner" /> : <Play size={15} />}
          {loading ? 'Comparing…' : 'Verify & Compare'}
        </button>

        {result?.proof_report && (
          <button
            id="view-proof-report-btn"
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/proof-report')}
            title="View the full Proof Report"
          >
            <FileCheck size={14} />
            Proof Report
            <ArrowRight size={13} />
          </button>
        )}

        <span className="text-xs text-muted" style={{ marginLeft: 'auto' }}>
          Both versions executed with identical inputs
        </span>
      </div>

      {/* ── Editor label bar ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        fontSize: '0.8125rem',
        fontWeight: 500,
        color: 'var(--color-muted)',
      }}>
        <div style={{ flex: 1, padding: '6px 16px', borderRight: '1px solid var(--color-border)' }}>
          Original Code
          <span className="badge badge-neutral" style={{ marginLeft: 8 }}>editable</span>
        </div>
        <div style={{ flex: 1, padding: '6px 16px' }}>
          Optimized Candidate
          <span className="badge badge-primary" style={{ marginLeft: 8 }}>editable</span>
        </div>
      </div>

      {/* ── Diff editor ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <DiffEditor
          height="100%"
          language={language}
          original={initialOriginalRef.current}
          modified={initialCandidateRef.current}
          onMount={editor => {
            diffEditorRef.current = editor;
            const origModel = editor.getOriginalEditor().getModel();
            const modModel  = editor.getModifiedEditor().getModel();
            origModel?.onDidChangeContent(() => setOriginal(origModel.getValue()));
            modModel?.onDidChangeContent(() => setCandidate(modModel.getValue()));
          }}
          theme="vs"
          options={{
            fontSize: 14,
            fontFamily: "'JetBrains Mono', Consolas, monospace",
            minimap: { enabled: false },
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 12 },
            renderSideBySide: true,
            originalEditable: true,
          }}
        />
      </div>

      {/* ── Results ──────────────────────────────────────────────────── */}
      {(result || error) && (
        <div className="diff-results" style={{ maxHeight: 260, overflow: 'auto' }}>
          {error && (
            <div className="alert alert-error"><XCircle size={16} />{error}</div>
          )}

          {result && vStyle && VIcon && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Verdict */}
              <div className="alert" style={{ background: vStyle.bg, color: vStyle.color, border: `1px solid ${vStyle.color}40` }}>
                <VIcon size={16} />
                <div>
                  <strong style={{ textTransform: 'capitalize' }}>{result.verdict}</strong>
                  {' — '}{result.explanation}
                </div>
              </div>

              {/* Metrics row */}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {/* Original */}
                <div className="card" style={{ padding: '12px 16px', flex: '1 1 160px' }}>
                  <div className="text-xs text-muted mb-2">Original</div>
                  <div className="text-sm">
                    <div>Status: <strong>{result.original.status}</strong></div>
                    {result.original.time_seconds != null && <div>Time: <strong>{result.original.time_seconds.toFixed(3)}s</strong></div>}
                    {result.original.memory_kb    != null && <div>Memory: <strong>{result.original.memory_kb} KB</strong></div>}
                  </div>
                </div>
                {/* Candidate */}
                <div className="card" style={{ padding: '12px 16px', flex: '1 1 160px' }}>
                  <div className="text-xs text-muted mb-2">Candidate</div>
                  <div className="text-sm">
                    <div>Status: <strong>{result.candidate.status}</strong></div>
                    {result.candidate.time_seconds != null && <div>Time: <strong>{result.candidate.time_seconds.toFixed(3)}s</strong></div>}
                    {result.candidate.memory_kb    != null && <div>Memory: <strong>{result.candidate.memory_kb} KB</strong></div>}
                  </div>
                </div>
                {/* Delta */}
                {(result.time_delta_seconds != null || result.memory_delta_kb != null) && (
                  <div className="card" style={{ padding: '12px 16px', flex: '1 1 160px' }}>
                    <div className="text-xs text-muted mb-2">Delta</div>
                    <div className="text-sm">
                      {result.time_delta_seconds != null && (
                        <div>Time: <strong style={{ color: result.time_delta_seconds < 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                          {result.time_delta_seconds > 0 ? '+' : ''}{result.time_delta_seconds.toFixed(3)}s
                        </strong></div>
                      )}
                      {result.memory_delta_kb != null && (
                        <div>Memory: <strong>{result.memory_delta_kb > 0 ? '+' : ''}{result.memory_delta_kb} KB</strong></div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Output mismatch warning */}
              {!result.outputs_match && (
                <div className="alert alert-error">
                  <XCircle size={14} />
                  Outputs differ — the candidate is not a correct equivalent.
                </div>
              )}

              {/* Limitations */}
              {result.limitations.length > 0 && (
                <details style={{ fontSize: '0.8125rem', color: 'var(--color-muted)' }}>
                  <summary style={{ cursor: 'pointer', marginBottom: 4 }}>Limitations</summary>
                  <ul style={{ paddingLeft: 16 }}>
                    {result.limitations.map((l, i) => <li key={i}>{l}</li>)}
                  </ul>
                </details>
              )}

              {/* Proof Report link */}
              {result.proof_report && (
                <div className="alert alert-success" style={{ justifyContent: 'space-between' }}>
                  <div className="flex items-center gap-2">
                    <FileCheck size={15} />
                    <span>Proof Report generated — <strong>{result.proof_report.id}</strong></span>
                  </div>
                  <button
                    id="goto-proof-report-btn"
                    className="btn btn-sm btn-primary"
                    onClick={() => navigate('/proof-report')}
                  >
                    View Report <ArrowRight size={13} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
