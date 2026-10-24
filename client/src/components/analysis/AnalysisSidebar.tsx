import { useState, useCallback } from 'react';
import { X, Leaf, Info, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type { AnalyzeResponse, ExecuteResponse } from '@/types/api';
import { api } from '@/services/api';
import type { GreenScoreResponse } from '@/types/api';

interface Props {
  result: AnalyzeResponse | null;
  code: string;
  language: string;
  executeResult: ExecuteResponse | null;
  onClose: () => void;
}

export function AnalysisSidebar({ result, code, language, executeResult, onClose }: Props) {
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const [greenScore, setGreenScore] = useState<GreenScoreResponse | null>(null);
  const [loadingScore, setLoadingScore] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);

  const fetchGreenScore = useCallback(async () => {
    if (!result) return;
    setLoadingScore(true);
    setScoreError(null);
    try {
      const r = await api.greenScore({
        language,
        source_code: code,
        execute_result: executeResult || undefined,
        analyze_result: result,
      });
      setGreenScore(r);
    } catch (e: any) {
      setScoreError(e.message);
    } finally {
      setLoadingScore(false);
    }
  }, [result, language, code, executeResult]);

  const scoreClass = (s?: number) => {
    if (s == null) return '';
    if (s >= 70) return 'good';
    if (s >= 40) return 'ok';
    return 'poor';
  };

  return (
    <div className="analysis-sidebar">
      <div className="console-header" style={{ justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-heading)' }}>
          Analysis Results
        </span>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close">
          <X size={14} />
        </button>
      </div>

      <div className="analysis-panel">
        {!result && (
          <div style={{ textAlign: 'center', color: 'var(--color-placeholder)', padding: '32px 0' }}>
            Click Analyze to see results.
          </div>
        )}

        {result && (
          <>
            {/* Complexity */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Complexity</span>
                <span className={`badge badge-${result.complexity.confidence === 'high' ? 'success' : result.complexity.confidence === 'medium' ? 'warning' : 'neutral'}`}>
                  {result.complexity.confidence}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                <div>
                  <div className="text-xs text-muted">Time</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1rem', color: 'var(--color-primary)' }}>
                    {result.complexity.estimated_time_complexity}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted">Space</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1rem', color: 'var(--color-heading)' }}>
                    {result.complexity.estimated_auxiliary_space}
                  </div>
                </div>
              </div>
              <div className="text-xs text-muted">{result.complexity.reasoning}</div>
              <div className="alert alert-info mt-2" style={{ fontSize: '0.75rem', padding: '6px 10px' }}>
                <Info size={11} /> {result.complexity.limitations}
              </div>
            </div>

            {/* Green Score */}
            <div className="card">
              <div className="card-header">
                <span className="card-title"><Leaf size={14} /> Green Score</span>
              </div>
              {!greenScore ? (
                <div>
                  <p className="text-sm text-muted mb-3">
                    Compute an explainable environmental efficiency score.
                    {!executeResult && ' Run your code first for a more complete score.'}
                  </p>
                  {scoreError && <div className="alert alert-error mb-2" style={{ fontSize: '0.8rem' }}>{scoreError}</div>}
                  <button
                    id="calc-green-score-btn"
                    className="btn btn-secondary btn-sm"
                    onClick={fetchGreenScore}
                    disabled={loadingScore}
                  >
                    {loadingScore ? <span className="spinner" /> : <Leaf size={13} />}
                    {loadingScore ? 'Calculating…' : 'Calculate Score'}
                  </button>
                </div>
              ) : (
                <div>
                  <div className={`score-circle ${scoreClass(greenScore.overall_score ?? undefined)}`} style={{ marginBottom: 12 }}>
                    <span className="score-value">
                      {greenScore.overall_score != null ? greenScore.overall_score : '—'}
                    </span>
                    <span className="score-label">/100</span>
                  </div>

                  {Object.values(greenScore.components).map(comp => (
                    <div key={comp.label} className="score-bar-item" style={{ marginBottom: 8 }}>
                      <span className="score-bar-label">{comp.label}</span>
                      <div className="score-bar-track">
                        <div
                          className="score-bar-fill"
                          style={{ width: `${comp.score ?? 0}%` }}
                        />
                      </div>
                      <span className="score-bar-value">
                        {comp.score != null ? `${comp.score}` : 'N/A'}
                      </span>
                    </div>
                  ))}

                  <div className="text-xs text-muted mt-2">{greenScore.score_explanation}</div>
                  <details className="mt-2" style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                    <summary style={{ cursor: 'pointer' }}>Limitations</summary>
                    <ul style={{ paddingLeft: 14, marginTop: 4 }}>
                      {greenScore.limitations.map((l, i) => <li key={i}>{l}</li>)}
                    </ul>
                  </details>
                </div>
              )}
            </div>

            {/* Findings */}
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 8, color: 'var(--color-heading)' }}>
                Findings ({result.findings.length})
              </div>
              {result.findings.length === 0 ? (
                <div className="alert alert-success" style={{ fontSize: '0.8rem' }}>
                  ✓ No issues detected by static analysis.
                </div>
              ) : (
                result.findings.map(f => (
                  <div key={f.rule_id + (f.line || '')} className="finding-item" style={{ marginBottom: 8 }}>
                    <div
                      className="finding-header"
                      onClick={() => setExpandedFinding(expandedFinding === f.rule_id ? null : f.rule_id)}
                    >
                      <AlertCircle size={13} style={{
                        color: f.severity === 'error' ? 'var(--color-error)'
                          : f.severity === 'warning' ? 'var(--color-warning)'
                          : 'var(--color-info)'
                      }} />
                      <span style={{ fontSize: '0.8rem', fontWeight: 500, flex: 1 }}>{f.title}</span>
                      {f.line && <span className="text-xs text-muted">L{f.line}</span>}
                      {expandedFinding === f.rule_id
                        ? <ChevronUp size={12} />
                        : <ChevronDown size={12} />
                      }
                    </div>
                    {expandedFinding === f.rule_id && (
                      <div className="finding-body">
                        <p style={{ fontSize: '0.8rem' }}>{f.explanation}</p>
                        <div className="finding-suggestion" style={{ fontSize: '0.75rem' }}>
                          {f.suggestion}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
