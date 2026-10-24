import { useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { Zap, AlertCircle, Info, X } from 'lucide-react';
import { api } from '@/services/api';
import type { AnalyzeResponse } from '@/types/api';

export function AnalysisPage() {
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState('');
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  const handleAnalyze = useCallback(async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await api.analyze({ language, source_code: code });
      setResult(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [code, language]);

  const severityIcon = (s: string) => {
    if (s === 'error') return <AlertCircle size={14} style={{ color: 'var(--color-error)' }} />;
    if (s === 'warning') return <AlertCircle size={14} style={{ color: 'var(--color-warning)' }} />;
    return <Info size={14} style={{ color: 'var(--color-info)' }} />;
  };

  const severityBadge = (s: string) => {
    const map: Record<string, string> = { error: 'badge-error', warning: 'badge-warning', info: 'badge-info' };
    return `badge ${map[s] || 'badge-neutral'}`;
  };

  const filteredFindings = result?.findings.filter(
    f => severityFilter === 'all' || f.severity === severityFilter
  ) || [];

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Editor half */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--color-border)' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 10, alignItems: 'center', background: 'var(--color-bg)' }}>
          <select
            id="analysis-lang-select"
            className="select"
            style={{ width: 150 }}
            value={language}
            onChange={e => setLanguage(e.target.value)}
          >
            {['python', 'c', 'cpp', 'javascript'].map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <button
            id="analyze-btn"
            className="btn btn-primary"
            onClick={handleAnalyze}
            disabled={loading || !code.trim()}
          >
            {loading ? <span className="spinner" /> : <Zap size={15} />}
            {loading ? 'Analyzing…' : 'Analyze Code'}
          </button>
          <span className="text-xs text-muted" style={{ marginLeft: 'auto' }}>
            Static analysis · No code is executed during analysis
          </span>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Editor
            height="100%"
            language={language === 'cpp' ? 'cpp' : language}
            value={code}
            onChange={v => setCode(v || '')}
            theme="vs"
            options={{
              fontSize: 14,
              fontFamily: "'JetBrains Mono', Consolas, monospace",
              minimap: { enabled: false },
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              padding: { top: 12 },
            }}
          />
        </div>
      </div>

      {/* Results panel */}
      <div style={{ width: 420, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--color-surface)' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-heading)' }}>Analysis Results</span>
          {result && (
            <select
              id="severity-filter"
              className="select"
              style={{ width: 110, marginLeft: 'auto', fontSize: '0.8125rem' }}
              value={severityFilter}
              onChange={e => setSeverityFilter(e.target.value)}
            >
              <option value="all">All ({result.findings.length})</option>
              <option value="error">Errors</option>
              <option value="warning">Warnings</option>
              <option value="info">Info</option>
            </select>
          )}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {error && (
            <div className="alert alert-error">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {!result && !error && (
            <div style={{ textAlign: 'center', color: 'var(--color-placeholder)', padding: '48px 16px' }}>
              <Zap size={32} style={{ margin: '0 auto 12px', color: 'var(--color-primary-light)' }} />
              <p>Enter code and click Analyze to see findings.</p>
            </div>
          )}

          {result && (
            <>
              {/* Complexity */}
              <div className="card">
                <div className="card-header" style={{ marginBottom: 12 }}>
                  <span className="card-title">Complexity Estimate</span>
                  <span className={`badge badge-${result.complexity.confidence === 'high' ? 'success' : result.complexity.confidence === 'medium' ? 'warning' : 'neutral'}`}>
                    {result.complexity.confidence} confidence
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
                  <div>
                    <div className="text-xs text-muted mb-1">Time</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-heading)' }}>
                      {result.complexity.estimated_time_complexity}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted mb-1">Auxiliary Space</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-heading)' }}>
                      {result.complexity.estimated_auxiliary_space}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-muted">{result.complexity.reasoning}</div>
                {result.complexity.assumptions.length > 0 && (
                  <div className="text-xs text-muted mt-2">
                    Assumptions: {result.complexity.assumptions.join('; ')}
                  </div>
                )}
                <div className="alert alert-info mt-3" style={{ fontSize: '0.75rem' }}>
                  <Info size={12} />
                  {result.complexity.limitations}
                </div>
              </div>

              {/* Findings */}
              {filteredFindings.length === 0 ? (
                <div className="alert alert-success">
                  <span>✓</span>
                  No findings for the selected filter. {result.findings.length === 0 ? 'Code looks clean!' : 'Try "All" to see all findings.'}
                </div>
              ) : (
                filteredFindings.map(f => (
                  <div key={f.rule_id + (f.line || '')} className="finding-item">
                    <div
                      className="finding-header"
                      onClick={() => setExpandedFinding(
                        expandedFinding === f.rule_id ? null : f.rule_id
                      )}
                      style={{ cursor: 'pointer' }}
                    >
                      {severityIcon(f.severity)}
                      <span style={{ fontWeight: 500, fontSize: '0.875rem', flex: 1 }}>{f.title}</span>
                      {f.line && <span className="text-xs text-muted">L{f.line}</span>}
                      <span className={severityBadge(f.severity)} style={{ marginLeft: 6 }}>
                        {f.severity}
                      </span>
                      <span className="badge badge-neutral" style={{ marginLeft: 4 }}>{f.confidence}</span>
                    </div>
                    {expandedFinding === f.rule_id && (
                      <div className="finding-body">
                        <p>{f.explanation}</p>
                        <div className="finding-suggestion">
                          <strong>Suggestion:</strong> {f.suggestion}
                        </div>
                        {f.limitations && (
                          <p className="text-xs text-muted mt-2">⚠ {f.limitations}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
