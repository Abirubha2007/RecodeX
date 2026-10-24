import { useState, useCallback } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { GitCompare, Play, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { api } from '@/services/api';
import type { CompareResponse } from '@/types/api';

const VERDICT_STYLES = {
  improvement: { bg: 'var(--color-success-bg)', color: 'var(--color-success)', icon: CheckCircle },
  equivalent:  { bg: 'var(--color-info-bg)',    color: 'var(--color-info)',    icon: Info },
  regression:  { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)', icon: AlertTriangle },
  failed:      { bg: 'var(--color-error-bg)',   color: 'var(--color-error)',   icon: XCircle },
  unverified:  { bg: 'var(--color-surface-2)',  color: 'var(--color-muted)',   icon: AlertTriangle },
};

export function GreenDiffPage() {
  const [language, setLanguage] = useState('python');
  const [original, setOriginal] = useState('');
  const [candidate, setCandidate] = useState('');
  const [testInput, setTestInput] = useState('');
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCompare = useCallback(async () => {
    if (!original.trim() || !candidate.trim()) {
      setError('Provide both original and candidate code.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await api.compare({
        language,
        original_code: original,
        candidate_code: candidate,
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
          disabled={loading || !original.trim() || !candidate.trim()}
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
          Original (Left)
          <span className="badge badge-neutral" style={{ marginLeft: 8 }}>editable</span>
        </div>
        <div style={{ flex: 1, padding: '6px 16px' }}>
          Candidate (Right)
          <span className="badge badge-primary" style={{ marginLeft: 8 }}>editable</span>
        </div>
      </div>

      {/* DiffEditor */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <DiffEditor
          height="100%"
          language={language === 'cpp' ? 'cpp' : language}
          original={original}
          modified={candidate}
          onMount={(editor) => {
            // Monitor changes in both editors
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}
