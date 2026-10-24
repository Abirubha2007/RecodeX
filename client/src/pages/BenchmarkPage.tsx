import { useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Gauge, Play, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { api } from '@/services/api';
import type { BenchmarkResponse } from '@/types/api';

export function BenchmarkPage() {
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState('');
  const [inputs, setInputs] = useState<string[]>(['']);
  const [repetitions, setRepetitions] = useState(3);
  const [result, setResult] = useState<BenchmarkResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addInput = () => {
    if (inputs.length < 10) setInputs(i => [...i, '']);
  };

  const removeInput = (idx: number) => {
    setInputs(i => i.filter((_, j) => j !== idx));
  };

  const updateInput = (idx: number, val: string) => {
    setInputs(i => i.map((v, j) => j === idx ? val : v));
  };

  const handleBenchmark = useCallback(async () => {
    const validInputs = inputs.filter(i => i.trim() !== '' || inputs.length === 1);
    if (!code.trim()) { setError('Enter code to benchmark.'); return; }
    setLoading(true);
    setError(null);
    try {
      const r = await api.benchmark({
        language,
        source_code: code,
        inputs: validInputs.length > 0 ? validInputs : [''],
        repetitions,
      });
      setResult(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [language, code, inputs, repetitions]);

  const chartData = result?.results.map(r => ({
    name: r.input_label,
    time_ms: r.time_seconds != null ? +(r.time_seconds * 1000).toFixed(2) : 0,
    memory_kb: r.memory_kb ?? 0,
    status: r.status,
  })) || [];

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="flex items-center gap-2 mb-4">
        <Gauge size={20} style={{ color: 'var(--color-primary)' }} />
        <h1 style={{ fontSize: '1.25rem', margin: 0 }}>Benchmark</h1>
      </div>
      <p className="text-sm text-muted mb-4">
        Run your code against multiple inputs and measure execution time and memory.
        Results are averages across repetitions. Subject to provider variability.
      </p>

      {/* Config */}
      <div className="card mb-4">
        <div className="card-header">
          <span className="card-title">Configuration</span>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <label className="text-xs text-muted" style={{ display: 'block', marginBottom: 4 }}>Language</label>
            <select
              id="bench-lang-select"
              className="select"
              style={{ width: 140 }}
              value={language}
              onChange={e => setLanguage(e.target.value)}
            >
              {['python', 'c', 'cpp', 'javascript', 'java'].map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted" style={{ display: 'block', marginBottom: 4 }}>Repetitions (1–10)</label>
            <input
              id="bench-repetitions"
              type="number"
              className="input"
              style={{ width: 80 }}
              min={1}
              max={10}
              value={repetitions}
              onChange={e => setRepetitions(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
            />
          </div>
        </div>

        <label className="text-xs text-muted" style={{ display: 'block', marginBottom: 6 }}>
          Test Inputs (stdin per run, max 10)
        </label>
        {inputs.map((inp, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <input
              id={`bench-input-${idx}`}
              className="input"
              placeholder={`Input ${idx + 1}`}
              value={inp}
              onChange={e => updateInput(idx, e.target.value)}
            />
            {inputs.length > 1 && (
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeInput(idx)}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
        {inputs.length < 10 && (
          <button className="btn btn-ghost btn-sm" onClick={addInput}>
            <Plus size={13} /> Add Input
          </button>
        )}
      </div>

      {/* Code input */}
      <div className="card mb-4">
        <div className="card-header">
          <span className="card-title">Code</span>
        </div>
        <textarea
          id="bench-code"
          className="textarea"
          style={{ height: 180, fontSize: '0.8125rem' }}
          placeholder="Paste or type your code here…"
          value={code}
          onChange={e => setCode(e.target.value)}
        />
      </div>

      <button
        id="run-benchmark-btn"
        className="btn btn-primary"
        onClick={handleBenchmark}
        disabled={loading || !code.trim()}
      >
        {loading ? <span className="spinner" /> : <Play size={15} />}
        {loading ? 'Benchmarking…' : 'Run Benchmark'}
      </button>

      {/* Error */}
      {error && (
        <div className="alert alert-error mt-4">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={{ marginTop: 24 }}>
          <div className="card mb-4">
            <div className="card-header">
              <span className="card-title">Execution Time (ms)</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="ms" />
                <Tooltip
                  formatter={(v: number) => [`${v}ms`, 'Time']}
                  contentStyle={{ border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 12 }}
                />
                <Bar dataKey="time_ms" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {chartData.some(d => d.memory_kb > 0) && (
            <div className="card mb-4">
              <div className="card-header">
                <span className="card-title">Memory Usage (KB)</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="KB" />
                  <Tooltip
                    formatter={(v: number) => [`${v}KB`, 'Memory']}
                    contentStyle={{ border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 12 }}
                  />
                  <Bar dataKey="memory_kb" fill="var(--color-info)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Raw results table */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Raw Results</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['Input', 'Status', 'Avg Time', 'Avg Memory'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--color-muted)', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.results.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '6px 8px', fontFamily: 'var(--font-mono)' }}>{r.input_label}</td>
                    <td style={{ padding: '6px 8px' }}>
                      <span className={`badge badge-${r.status === 'accepted' ? 'success' : 'error'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px' }}>{r.time_seconds != null ? `${(r.time_seconds * 1000).toFixed(2)}ms` : 'N/A'}</td>
                    <td style={{ padding: '6px 8px' }}>{r.memory_kb != null ? `${r.memory_kb}KB` : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-xs text-muted mt-3">{result.summary}</div>
          {result.limitations.length > 0 && (
            <details className="mt-3" style={{ fontSize: '0.8125rem', color: 'var(--color-muted)' }}>
              <summary style={{ cursor: 'pointer' }}>Limitations</summary>
              <ul style={{ paddingLeft: 16, marginTop: 4 }}>
                {result.limitations.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
