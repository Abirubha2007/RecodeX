import { useState, useCallback, useRef } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import {
  GitCompare,
  Play,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Download,
  FileText,
  ShieldCheck,
  Copy,
  Check,
} from 'lucide-react';
import { api } from '@/services/api';
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
  const [language, setLanguage] = useState(() => {
    return sessionStorage.getItem('greenDiffLanguage') || 'python';
  });

  const [original, setOriginal] = useState(() => {
    const stored = sessionStorage.getItem('greenDiffOriginal');
    if (stored) {
      sessionStorage.removeItem('greenDiffOriginal');
      return stored;
    }
    return DEFAULT_ORIGINAL_PYTHON;
  });

  const [candidate, setCandidate] = useState(() => {
    const stored = sessionStorage.getItem('greenDiffCandidate');
    if (stored) {
      sessionStorage.removeItem('greenDiffCandidate');
      return stored;
    }
    return DEFAULT_CANDIDATE_PYTHON;
  });

  const [testInput, setTestInput] = useState('');
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const diffEditorRef = useRef<any>(null);
  const initialOriginalRef = useRef(original);
  const initialCandidateRef = useRef(candidate);

  const handleExportJson = useCallback(() => {
    if (!result?.proof_report) return;
    const jsonStr = JSON.stringify(result.proof_report, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proof-report-${result.proof_report.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result]);

  const handleExportHtml = useCallback(async () => {
    if (!result?.proof_report) return;
    const origCode = (
      diffEditorRef.current?.getOriginalEditor()?.getModel()?.getValue() ??
      diffEditorRef.current?.getOriginalEditor()?.getValue?.() ??
      original
    ).trim();
    const candCode = (
      diffEditorRef.current?.getModifiedEditor()?.getModel()?.getValue() ??
      diffEditorRef.current?.getModifiedEditor()?.getValue?.() ??
      candidate
    ).trim();

    try {
      const htmlContent = await api.compareReportHtml({
        language,
        original_code: origCode,
        candidate_code: candCode,
        test_inputs: testInput ? [testInput] : [],
      });
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `proof-report-${result.proof_report.id}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Offline fallback: generate client-side HTML report
      const rep = result.proof_report;
      const htmlDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Proof Report ${rep.id}</title><style>body{font-family:sans-serif;margin:40px;background:#f9fafb;color:#111827}.card{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:24px;max-width:850px;margin:0 auto}pre{background:#1e1e1e;color:#ddd;padding:12px;border-radius:6px;overflow-x:auto}</style></head><body><div class="card"><h1>ReCodeX Proof Report – ${rep.id}</h1><p>Timestamp: ${rep.timestamp} | Language: ${rep.language} | Provider: ${rep.execution_provider.provider}</p><p><strong>Correctness:</strong> ${rep.correctness.label} (${rep.correctness.details})</p><p><strong>Performance:</strong> ${rep.performance.label} (${rep.performance.details})</p><hr><p>Original SHA-256: <code>${rep.source.original.sha256}</code></p><p>Candidate SHA-256: <code>${rep.source.candidate.sha256}</code></p><h3>Original Source</h3><pre>${rep.source.original.code}</pre><h3>Candidate Source</h3><pre>${rep.source.candidate.code}</pre></div></body></html>`;
      const blob = new Blob([htmlDoc], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `proof-report-${rep.id}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [result, language, original, candidate, testInput]);

  const handleCopyJson = useCallback(async () => {
    if (!result?.proof_report) return;
    await navigator.clipboard.writeText(JSON.stringify(result.proof_report, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const handleCompare = useCallback(async () => {
    const origEditor = diffEditorRef.current?.getOriginalEditor();
    const candEditor = diffEditorRef.current?.getModifiedEditor();
    const origCode = (origEditor?.getModel()?.getValue() ?? origEditor?.getValue?.() ?? original).trim();
    const candCode = (candEditor?.getModel()?.getValue() ?? candEditor?.getValue?.() ?? candidate).trim();

    if (!origCode && !candCode) {
      setError('Please provide both original and candidate code.');
      return;
    }
    if (!origCode) {
      setError('Original code cannot be empty.');
      return;
    }
    if (!candCode) {
      setError('Optimized candidate code cannot be empty.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const r = await api.compare({
        language,
        original_code: origCode,
        candidate_code: candCode,
        test_inputs: testInput ? [testInput] : [],
      });
      setResult(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [language, original, candidate, testInput]);

  const verdict = result?.verdict as keyof typeof VERDICT_STYLES | undefined;
  const vStyle = verdict ? VERDICT_STYLES[verdict] : null;
  const VIcon = vStyle?.icon;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Toolbar */}
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
        <span className="text-xs text-muted" style={{ marginLeft: 'auto' }}>
          Both versions are executed with identical inputs
        </span>
      </div>

      {/* Diff editor label bar */}
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

      {/* DiffEditor */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <DiffEditor
          height="100%"
          language={language === 'cpp' ? 'cpp' : language}
          original={initialOriginalRef.current}
          modified={initialCandidateRef.current}
          onMount={(editor) => {
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

      {/* Results */}
      {(result || error) && (
        <div className="diff-results" style={{ maxHeight: 280, overflow: 'auto' }}>
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

              {/* Metrics */}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div className="card" style={{ padding: '12px 16px', flex: '1 1 180px' }}>
                  <div className="text-xs text-muted mb-2">Original</div>
                  <div className="text-sm">
                    <div>Status: <strong>{result.original.status}</strong></div>
                    {result.original.time_seconds != null && <div>Time: <strong>{result.original.time_seconds.toFixed(3)}s</strong></div>}
                    {result.original.memory_kb != null && <div>Memory: <strong>{result.original.memory_kb} KB</strong></div>}
                  </div>
                </div>
                <div className="card" style={{ padding: '12px 16px', flex: '1 1 180px' }}>
                  <div className="text-xs text-muted mb-2">Candidate</div>
                  <div className="text-sm">
                    <div>Status: <strong>{result.candidate.status}</strong></div>
                    {result.candidate.time_seconds != null && <div>Time: <strong>{result.candidate.time_seconds.toFixed(3)}s</strong></div>}
                    {result.candidate.memory_kb != null && <div>Memory: <strong>{result.candidate.memory_kb} KB</strong></div>}
                  </div>
                </div>
                {(result.time_delta_seconds != null || result.memory_delta_kb != null) && (
                  <div className="card" style={{ padding: '12px 16px', flex: '1 1 180px' }}>
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

              {/* Outputs */}
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

              {/* Proof Report Card */}
              {result.proof_report && (
                <div
                  className="card"
                  data-testid="proof-report-card"
                  style={{
                    padding: '16px 20px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  {/* Header bar with ID, timestamp, and Export Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ShieldCheck
                        size={18}
                        style={{
                          color:
                            result.proof_report.correctness.status === 'verified'
                              ? 'var(--color-success)'
                              : result.proof_report.correctness.status === 'failed'
                              ? 'var(--color-error)'
                              : 'var(--color-warning)',
                        }}
                      />
                      <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-heading)' }}>
                        Proof Report
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontFamily: 'monospace' }}>
                        {result.proof_report.id}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        id="copy-report-json-btn"
                        className="btn btn-sm btn-ghost"
                        onClick={handleCopyJson}
                        title="Copy report JSON"
                      >
                        {copied ? <Check size={13} style={{ color: 'var(--color-success)' }} /> : <Copy size={13} />}
                        {copied ? 'Copied' : 'Copy JSON'}
                      </button>
                      <button
                        id="export-report-json-btn"
                        className="btn btn-sm btn-outline"
                        onClick={handleExportJson}
                        title="Export Proof Report to JSON"
                      >
                        <Download size={13} /> Export JSON
                      </button>
                      <button
                        id="export-report-html-btn"
                        className="btn btn-sm btn-primary"
                        onClick={handleExportHtml}
                        title="Export standalone HTML proof certificate"
                      >
                        <FileText size={13} /> Export HTML
                      </button>
                    </div>
                  </div>

                  {/* Status Badges & Metadata */}
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem' }}>
                      <span className="text-muted">Correctness:</span>
                      <span
                        className={`badge ${
                          result.proof_report.correctness.status === 'verified'
                            ? 'badge-success'
                            : result.proof_report.correctness.status === 'failed'
                            ? 'badge-error'
                            : 'badge-neutral'
                        }`}
                      >
                        {result.proof_report.correctness.label}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem' }}>
                      <span className="text-muted">Performance:</span>
                      <span
                        className={`badge ${
                          result.proof_report.performance.verdict === 'improvement'
                            ? 'badge-success'
                            : result.proof_report.performance.verdict === 'regression'
                            ? 'badge-warning'
                            : 'badge-neutral'
                        }`}
                      >
                        {result.proof_report.performance.label}
                      </span>
                    </div>

                    <div style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                      Provider: <strong>{result.proof_report.execution_provider.provider}</strong> ({result.proof_report.execution_provider.compiler}) &bull; Secrets Redacted: ✓
                    </div>
                  </div>

                  {/* Source Proof & Cryptographic Hashes */}
                  <div
                    style={{
                      background: 'var(--color-surface-2)',
                      padding: '10px 14px',
                      borderRadius: 6,
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div>
                      <strong style={{ color: 'var(--color-heading)' }}>Original SHA-256:</strong>{' '}
                      <span style={{ color: 'var(--color-muted)', wordBreak: 'break-all' }}>
                        {result.proof_report.source.original.sha256}
                      </span>{' '}
                      ({result.proof_report.source.original.bytes} bytes)
                    </div>
                    <div>
                      <strong style={{ color: 'var(--color-heading)' }}>Candidate SHA-256:</strong>{' '}
                      <span style={{ color: 'var(--color-muted)', wordBreak: 'break-all' }}>
                        {result.proof_report.source.candidate.sha256}
                      </span>{' '}
                      ({result.proof_report.source.candidate.bytes} bytes)
                    </div>
                  </div>

                  {/* Missing Metrics & Unresolved Risks */}
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.8125rem' }}>
                    {result.proof_report.missing_metrics.length > 0 && (
                      <div style={{ flex: '1 1 260px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-warning)', marginBottom: 4 }}>
                          Missing Evidence Metrics
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 16, color: 'var(--color-muted)' }}>
                          {result.proof_report.missing_metrics.map((m, i) => (
                            <li key={i}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {result.proof_report.unresolved_risks.length > 0 && (
                      <div style={{ flex: '1 1 260px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-error)', marginBottom: 4 }}>
                          Unresolved Risks
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 16, color: 'var(--color-muted)' }}>
                          {result.proof_report.unresolved_risks.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
