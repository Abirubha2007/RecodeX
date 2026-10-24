import { useState, useCallback } from 'react';
import { X, Brain, Zap, MessageSquare, GitCompare, TestTube, CheckCircle, AlertTriangle } from 'lucide-react';
import type { ExecuteResponse, OptimizationResult } from '@/types/api';
import { api } from '@/services/api';
import { useNavigate } from 'react-router-dom';

interface Props {
  code: string;
  language: string;
  executeResult: ExecuteResponse | null;
  onAcceptOptimization: (code: string) => void;
  onClose: () => void;
}

type AIMode = 'explain' | 'error' | 'optimize' | 'edge_cases';

export function AIAssistantPanel({ code, language, executeResult, onAcceptOptimization, onClose }: Props) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AIMode>('explain');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [optimization, setOptimization] = useState<OptimizationResult | null>(null);
  const [optimizationWarning, setOptimizationWarning] = useState<string>('');
  const [accepted, setAccepted] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    setExplanation(null);
    setSuggestions([]);
    setOptimization(null);
    setAccepted(false);

    try {
      if (mode === 'optimize') {
        const resp = await api.optimize({ language, source_code: code });
        setOptimization(resp.result);
        setOptimizationWarning(resp.warning);
      } else {
        const context = mode === 'error'
          ? (executeResult?.stderr || executeResult?.compile_output || 'No error output available')
          : undefined;
        const resp = await api.explain({
          language,
          source_code: code,
          context,
          explain_type: mode,
        });
        setExplanation(resp.explanation);
        setSuggestions(resp.suggestions);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [mode, code, language, executeResult]);

  const handleAccept = () => {
    if (!optimization) return;
    onAcceptOptimization(optimization.optimized_code);
    setAccepted(true);
  };

  const handleSendToGreenDiff = () => {
    // We navigate to green-diff and pass state via sessionStorage
    if (!optimization) return;
    sessionStorage.setItem('greenDiffOriginal', code);
    sessionStorage.setItem('greenDiffCandidate', optimization.optimized_code);
    sessionStorage.setItem('greenDiffLanguage', language);
    navigate('/green-diff');
  };

  const MODES: { id: AIMode; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'explain',    label: 'Explain Code',     icon: <MessageSquare size={13} />, desc: 'What does this code do?' },
    { id: 'error',      label: 'Explain Error',    icon: <AlertTriangle size={13} />, desc: 'Explain the last error' },
    { id: 'optimize',   label: 'Optimize',         icon: <Zap size={13} />,           desc: 'Suggest optimization' },
    { id: 'edge_cases', label: 'Edge Cases',       icon: <TestTube size={13} />,      desc: 'Suggest test inputs' },
  ];

  return (
    <div style={{
      width: 380,
      borderLeft: '1px solid var(--color-border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: 'var(--color-bg)',
    }}>
      {/* Header */}
      <div className="console-header" style={{ justifyContent: 'space-between' }}>
        <div className="flex items-center gap-2">
          <Brain size={16} style={{ color: 'var(--color-primary)' }} />
          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-heading)' }}>
            AI Assistant
          </span>
          <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>Groq</span>
        </div>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={14} /></button>
      </div>

      {/* Mode selector */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {MODES.map(m => (
          <button
            key={m.id}
            id={`ai-mode-${m.id}`}
            className={`btn btn-sm ${mode === m.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setMode(m.id); setExplanation(null); setOptimization(null); setError(null); }}
            title={m.desc}
          >
            {m.icon}
            {m.label}
          </button>
        ))}
      </div>

      {/* Action button */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--color-border)' }}>
        <button
          id="ai-run-btn"
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={run}
          disabled={loading || !code.trim()}
        >
          {loading ? <span className="spinner" /> : <Brain size={14} />}
          {loading ? 'Thinking…' : `${MODES.find(m => m.id === mode)?.label}`}
        </button>
        {mode === 'error' && !executeResult?.stderr && !executeResult?.compile_output && (
          <div className="text-xs text-muted mt-1">Run your code first to capture error output.</div>
        )}
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error && (
          <div className="alert alert-error" style={{ fontSize: '0.8rem' }}>
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        {/* Explanation result */}
        {explanation && (
          <div>
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
              fontSize: '0.8125rem',
              lineHeight: 1.7,
              color: 'var(--color-body)',
              whiteSpace: 'pre-wrap',
              maxHeight: 400,
              overflow: 'auto',
            }}>
              {explanation}
            </div>
            {suggestions.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div className="text-xs text-muted mb-2">Quick suggestions:</div>
                {suggestions.map((s, i) => (
                  <div key={i} style={{
                    padding: '6px 10px',
                    background: 'var(--color-primary-ghost)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    color: 'var(--color-primary-dark)',
                    marginBottom: 4,
                  }}>• {s}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Optimization result */}
        {optimization && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="alert alert-warning" style={{ fontSize: '0.8rem' }}>
              <AlertTriangle size={13} />
              {optimizationWarning}
            </div>

            <div className="card" style={{ padding: '12px 14px' }}>
              <div className="text-xs text-muted mb-1">Summary</div>
              <div className="text-sm" style={{ fontWeight: 500 }}>{optimization.summary}</div>
            </div>

            <div className="card" style={{ padding: '12px 14px' }}>
              <div className="text-xs text-muted mb-2">Changes</div>
              {optimization.changes.map((c, i) => (
                <div key={i} style={{ fontSize: '0.8rem', marginBottom: 4 }}>• {c}</div>
              ))}
            </div>

            <div className="card" style={{ padding: '12px 14px' }}>
              <div className="text-xs text-muted mb-1">Expected Complexity</div>
              <code style={{ fontSize: '0.875rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                {optimization.expected_complexity}
              </code>
            </div>

            <div className="card" style={{ padding: '12px 14px' }}>
              <div className="text-xs text-muted mb-1">Optimized Code</div>
              <pre style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                background: 'var(--color-surface)',
                padding: 8,
                borderRadius: 'var(--radius-sm)',
                overflow: 'auto',
                maxHeight: 200,
                color: 'var(--color-body)',
              }}>
                {optimization.optimized_code}
              </pre>
            </div>

            {/* Action buttons */}
            {accepted ? (
              <div className="alert alert-success" style={{ fontSize: '0.8rem' }}>
                <CheckCircle size={13} /> Code accepted into editor.
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  id="ai-accept-btn"
                  className="btn btn-primary btn-sm"
                  onClick={handleAccept}
                  title="Replace editor code with this candidate"
                >
                  <CheckCircle size={13} /> Accept into Editor
                </button>
                <button
                  id="ai-green-diff-btn"
                  className="btn btn-secondary btn-sm"
                  onClick={handleSendToGreenDiff}
                  title="Verify in Green Diff before accepting"
                >
                  <GitCompare size={13} /> Open in Green Diff
                </button>
              </div>
            )}

            {optimization.limitations && (
              <div className="text-xs text-muted" style={{ fontStyle: 'italic' }}>
                ⚠ {optimization.limitations}
              </div>
            )}
          </div>
        )}

        {!explanation && !optimization && !error && !loading && (
          <div style={{ textAlign: 'center', color: 'var(--color-placeholder)', padding: '32px 0', fontSize: '0.875rem' }}>
            Select a mode and click the button to ask the AI assistant.
          </div>
        )}
      </div>
    </div>
  );
}
