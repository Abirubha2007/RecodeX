import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, FileText, Copy, Check, GitCompare,
  XCircle, Lock, TrendingUp, AlertTriangle,
} from 'lucide-react';
import { proofReportStore } from '@/services/proofReportStore';
import type { ProofReport } from '@/types/api';
import { api } from '@/services/api';

/* ── helpers ─────────────────────────────────────────────────────────── */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildClientHtml(rep: ProofReport): string {
  // Escape all user-supplied content; never embed secrets
  const id       = escapeHtml(rep.id);
  const ts       = escapeHtml(rep.timestamp);
  const lang     = escapeHtml(rep.language);
  const provider = escapeHtml(rep.execution_provider.provider);
  const compiler = escapeHtml(rep.execution_provider.compiler);
  const origCode = escapeHtml(rep.source.original.code);
  const candCode = escapeHtml(rep.source.candidate.code);
  const origSha  = escapeHtml(rep.source.original.sha256);
  const candSha  = escapeHtml(rep.source.candidate.sha256);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ReCodeX Proof Report — ${id}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; background: #f9fafb; color: #111827; }
    .wrap { max-width: 860px; margin: 40px auto; padding: 0 24px 60px; }
    h1 { font-size: 1.5rem; margin-bottom: 4px; color: #0f172a; }
    .meta { color: #64748b; font-size: 0.875rem; margin-bottom: 24px; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px 24px; margin-bottom: 16px; }
    .card h2 { font-size: 1rem; margin: 0 0 12px; color: #0f172a; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; }
    .badge-success { background: #ecfdf5; color: #059669; }
    .badge-warning { background: #fffbeb; color: #d97706; }
    .badge-error   { background: #fef2f2; color: #dc2626; }
    .badge-neutral { background: #f1f5f9; color: #64748b; }
    pre { background: #1e293b; color: #e2e8f0; padding: 14px 16px; border-radius: 8px; overflow-x: auto; font-size: 0.8125rem; line-height: 1.6; white-space: pre-wrap; word-break: break-all; }
    .kv { display: flex; gap: 8px; margin-bottom: 6px; font-size: 0.875rem; }
    .kv strong { color: #0f172a; min-width: 180px; flex-shrink: 0; }
    .disclaimer { font-size: 0.8rem; color: #94a3b8; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px; }
    .redacted { font-style: italic; color: #94a3b8; }
  </style>
</head>
<body>
<div class="wrap">
  <h1>🔒 ReCodeX Proof Report</h1>
  <p class="meta">
    Report ID: <strong>${id}</strong> &nbsp;|&nbsp;
    Timestamp: <strong>${ts}</strong> &nbsp;|&nbsp;
    Language: <strong>${lang}</strong> &nbsp;|&nbsp;
    Provider: <strong>${provider}</strong> (${compiler})
  </p>

  <div class="card">
    <h2>Correctness</h2>
    <div class="kv"><strong>Status:</strong> <span class="badge badge-${rep.correctness.status === 'verified' ? 'success' : rep.correctness.status === 'failed' ? 'error' : 'neutral'}">${escapeHtml(rep.correctness.label)}</span></div>
    <div class="kv"><strong>Outputs match:</strong> ${rep.correctness.outputs_match ? 'Yes' : 'No'}</div>
    <div class="kv"><strong>Details:</strong> ${escapeHtml(rep.correctness.details)}</div>
  </div>

  <div class="card">
    <h2>Performance</h2>
    <div class="kv"><strong>Verdict:</strong> <span class="badge badge-${rep.performance.verdict === 'improvement' ? 'success' : rep.performance.verdict === 'regression' ? 'warning' : 'neutral'}">${escapeHtml(rep.performance.label)}</span></div>
    ${rep.performance.time_delta_seconds != null ? `<div class="kv"><strong>Time delta:</strong> ${rep.performance.time_delta_seconds.toFixed(3)}s</div>` : ''}
    ${rep.performance.memory_delta_kb   != null ? `<div class="kv"><strong>Memory delta:</strong> ${rep.performance.memory_delta_kb} KB</div>` : ''}
    <div class="kv"><strong>Details:</strong> ${escapeHtml(rep.performance.details)}</div>
  </div>

  <div class="card">
    <h2>Cryptographic Hashes</h2>
    <div class="kv"><strong>Original SHA-256:</strong> <code>${origSha}</code> (${rep.source.original.bytes} bytes)</div>
    <div class="kv"><strong>Candidate SHA-256:</strong> <code>${candSha}</code> (${rep.source.candidate.bytes} bytes)</div>
  </div>

  <div class="card">
    <h2>Test Inputs</h2>
    <pre>${rep.test_inputs.length > 0 ? escapeHtml(rep.test_inputs.join('\n')) : '(no explicit inputs)'}</pre>
  </div>

  <div class="card">
    <h2>Original Source</h2>
    <pre>${origCode}</pre>
  </div>

  <div class="card">
    <h2>Candidate Source</h2>
    <pre>${candCode}</pre>
  </div>

  ${rep.missing_metrics.length > 0 ? `
  <div class="card">
    <h2>Missing Evidence Metrics</h2>
    <ul>${rep.missing_metrics.map(m => `<li>${escapeHtml(m)}</li>`).join('')}</ul>
  </div>` : ''}

  ${rep.unresolved_risks.length > 0 ? `
  <div class="card">
    <h2>Unresolved Risks</h2>
    <ul>${rep.unresolved_risks.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
  </div>` : ''}

  <div class="card">
    <h2>Limitations</h2>
    <ul>${rep.limitations.map(l => `<li>${escapeHtml(l)}</li>`).join('')}</ul>
    <p class="redacted">API keys, environment variables, and secrets are excluded from this report.</p>
  </div>

  <p class="disclaimer">
    This report confirms the candidate produced equivalent outputs for the tested inputs.
    It is not a formal mathematical proof of equivalence for all possible inputs.
    Generated by ReCodeX — stateless MVP.
  </p>
</div>
</body>
</html>`;
}

/* ── component ───────────────────────────────────────────────────────── */

export function ProofReportPage() {
  const navigate = useNavigate();
  const [report, setReport]   = useState<ProofReport | null>(proofReportStore.get());
  const [copied, setCopied]   = useState(false);
  const [htmlLoading, setHtmlLoading] = useState(false);

  // Subscribe to store updates (if user navigates here before report arrives)
  useEffect(() => {
    const unsub = proofReportStore.subscribe(r => setReport(r));
    return unsub;
  }, []);

  /* Download HTML — try server endpoint, fall back to client-side builder */
  const handleDownloadHtml = useCallback(async () => {
    if (!report) return;
    setHtmlLoading(true);
    let htmlContent: string;
    try {
      htmlContent = await api.compareReportHtml({
        language:       report.language,
        original_code:  report.source.original.code,
        candidate_code: report.source.candidate.code,
        test_inputs:    report.test_inputs,
      });
    } catch {
      htmlContent = buildClientHtml(report);
    }
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: `proof-report-${report.id}.html` });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setHtmlLoading(false);
  }, [report]);

  /* Copy JSON */
  const handleCopyJson = useCallback(async () => {
    if (!report) return;
    await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [report]);

  /* ── Empty state ─────────────────────────────────────────────────── */
  if (!report) {
    return (
      <div className="page" style={{ maxWidth: 600, textAlign: 'center', paddingTop: 80 }}>
        <ShieldCheck size={48} style={{ color: 'var(--color-primary-light)', margin: '0 auto 16px' }} />
        <h1 style={{ fontSize: '1.5rem', marginBottom: 8 }}>No Proof Report yet</h1>
        <p className="text-muted" style={{ marginBottom: 28, lineHeight: 1.7 }}>
          A Proof Report is generated automatically after a successful Green Diff verification.
          Run a comparison first, then return here to view and download the evidence.
        </p>
        <button
          id="goto-green-diff-btn"
          className="btn btn-primary"
          onClick={() => navigate('/green-diff')}
        >
          <GitCompare size={16} /> Go to Green Diff
        </button>
      </div>
    );
  }

  /* ── Status helpers ──────────────────────────────────────────────── */
  const corBadge = report.correctness.status === 'verified'
    ? 'badge-success'
    : report.correctness.status === 'failed'
    ? 'badge-error'
    : 'badge-neutral';

  const perfBadge = report.performance.verdict === 'improvement'
    ? 'badge-success'
    : report.performance.verdict === 'regression'
    ? 'badge-warning'
    : 'badge-neutral';

  const corIcon = report.correctness.status === 'verified'
    ? <ShieldCheck size={20} style={{ color: 'var(--color-success)' }} />
    : report.correctness.status === 'failed'
    ? <XCircle size={20} style={{ color: 'var(--color-error)' }} />
    : <AlertTriangle size={20} style={{ color: 'var(--color-warning)' }} />;

  /* ── Report view ─────────────────────────────────────────────────── */
  return (
    <div className="page" style={{ maxWidth: 900 }}>
      {/* Page header */}
      <div className="flex items-center gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
        <div className="flex items-center gap-2">
          {corIcon}
          <h1 style={{ fontSize: '1.25rem', margin: 0 }}>Proof Report</h1>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>
            {report.id}
          </span>
        </div>

        <div className="flex gap-2" style={{ marginLeft: 'auto' }}>
          <button
            id="copy-report-json-btn"
            className="btn btn-sm btn-ghost"
            onClick={handleCopyJson}
            title="Copy report JSON to clipboard"
          >
            {copied ? <Check size={13} style={{ color: 'var(--color-success)' }} /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy JSON'}
          </button>

          <button
            id="export-report-html-btn"
            className="btn btn-sm btn-primary"
            onClick={handleDownloadHtml}
            disabled={htmlLoading}
            title="Download standalone HTML proof certificate"
          >
            {htmlLoading ? <span className="spinner" style={{ width: 13, height: 13 }} /> : <FileText size={13} />}
            Download HTML
          </button>
        </div>
      </div>

      {/* Metadata row */}
      <div className="text-xs text-muted mb-4" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span>Timestamp: <strong>{report.timestamp}</strong></span>
        <span>Language: <strong>{report.language}</strong></span>
        <span>Provider: <strong>{report.execution_provider.provider}</strong> ({report.execution_provider.compiler})</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Lock size={11} /> Secrets redacted: ✓
        </span>
      </div>

      {/* Correctness + Performance */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div className="card" style={{ flex: '1 1 260px' }}>
          <div className="card-header">
            <span className="card-title">Correctness</span>
            <span className={`badge ${corBadge}`}>{report.correctness.label}</span>
          </div>
          <div className="text-sm" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>Outputs match: <strong>{report.correctness.outputs_match ? 'Yes' : 'No'}</strong></div>
            <div className="text-muted">{report.correctness.details}</div>
          </div>
        </div>

        <div className="card" style={{ flex: '1 1 260px' }}>
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp size={15} /> Performance
            </span>
            <span className={`badge ${perfBadge}`}>{report.performance.label}</span>
          </div>
          <div className="text-sm" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {report.performance.time_delta_seconds != null && (
              <div>Time delta: <strong style={{ color: report.performance.time_delta_seconds < 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                {report.performance.time_delta_seconds > 0 ? '+' : ''}{report.performance.time_delta_seconds.toFixed(3)}s
              </strong></div>
            )}
            {report.performance.memory_delta_kb != null && (
              <div>Memory delta: <strong>{report.performance.memory_delta_kb > 0 ? '+' : ''}{report.performance.memory_delta_kb} KB</strong></div>
            )}
            <div className="text-muted">{report.performance.details}</div>
          </div>
        </div>
      </div>

      {/* Hashes */}
      <div className="card mb-4">
        <div className="card-header">
          <span className="card-title">Cryptographic Hashes</span>
        </div>
        <div style={{
          background: 'var(--color-surface-2)',
          padding: '10px 14px',
          borderRadius: 6,
          fontSize: '0.75rem',
          fontFamily: 'var(--font-mono)',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}>
          <div>
            <strong style={{ color: 'var(--color-heading)' }}>Original SHA-256:</strong>{' '}
            <span style={{ color: 'var(--color-muted)', wordBreak: 'break-all' }}>{report.source.original.sha256}</span>{' '}
            ({report.source.original.bytes} bytes)
          </div>
          <div>
            <strong style={{ color: 'var(--color-heading)' }}>Candidate SHA-256:</strong>{' '}
            <span style={{ color: 'var(--color-muted)', wordBreak: 'break-all' }}>{report.source.candidate.sha256}</span>{' '}
            ({report.source.candidate.bytes} bytes)
          </div>
        </div>
      </div>

      {/* Test inputs */}
      <div className="card mb-4">
        <div className="card-header">
          <span className="card-title">Test Inputs</span>
          <span className="badge badge-neutral">{report.test_inputs.length} input(s)</span>
        </div>
        {report.test_inputs.length === 0
          ? <p className="text-sm text-muted">No explicit stdin inputs were provided.</p>
          : (
            <pre style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              padding: '10px 14px',
              fontSize: '0.8125rem',
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}>
              {report.test_inputs.join('\n')}
            </pre>
          )
        }
      </div>

      {/* Execution outcomes */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        {(['original', 'candidate'] as const).map(key => {
          const exec = report.executions[key];
          return (
            <div key={key} className="card" style={{ flex: '1 1 260px' }}>
              <div className="card-header">
                <span className="card-title" style={{ textTransform: 'capitalize' }}>{key}</span>
                <span className={`badge badge-${exec.status === 'accepted' ? 'success' : 'error'}`}>{exec.status}</span>
              </div>
              <div className="text-sm" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {exec.time_seconds != null && <div>Time: <strong>{exec.time_seconds.toFixed(3)}s</strong></div>}
                {exec.memory_kb    != null && <div>Memory: <strong>{exec.memory_kb} KB</strong></div>}
                {exec.stdout_sample && (
                  <div>
                    <div className="text-xs text-muted mb-1">Output sample:</div>
                    <pre style={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 4,
                      padding: '6px 10px',
                      fontSize: '0.75rem',
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}>{exec.stdout_sample}</pre>
                  </div>
                )}
                {exec.stderr_sample && (
                  <div>
                    <div className="text-xs text-muted mb-1" style={{ color: 'var(--color-error)' }}>Error sample:</div>
                    <pre style={{
                      background: 'var(--color-error-bg)',
                      border: '1px solid var(--color-error)',
                      borderRadius: 4,
                      padding: '6px 10px',
                      fontSize: '0.75rem',
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      color: 'var(--color-error)',
                    }}>{exec.stderr_sample}</pre>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Missing metrics / Unresolved risks */}
      {(report.missing_metrics.length > 0 || report.unresolved_risks.length > 0) && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
          {report.missing_metrics.length > 0 && (
            <div className="card" style={{ flex: '1 1 260px' }}>
              <div className="card-header">
                <span className="card-title" style={{ color: 'var(--color-warning)' }}>Missing Evidence Metrics</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 16, color: 'var(--color-muted)', fontSize: '0.875rem' }}>
                {report.missing_metrics.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          )}
          {report.unresolved_risks.length > 0 && (
            <div className="card" style={{ flex: '1 1 260px' }}>
              <div className="card-header">
                <span className="card-title" style={{ color: 'var(--color-error)' }}>Unresolved Risks</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 16, color: 'var(--color-muted)', fontSize: '0.875rem' }}>
                {report.unresolved_risks.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Limitations */}
      {report.limitations.length > 0 && (
        <details className="mb-4" style={{ fontSize: '0.875rem', color: 'var(--color-muted)' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 500 }}>Verification Limitations</summary>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            {report.limitations.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </details>
      )}

      {/* Disclaimer */}
      <div className="alert alert-info" style={{ fontSize: '0.8125rem' }}>
        <Lock size={14} />
        <div>
          This report confirms the candidate produced equivalent outputs for the tested inputs.
          It is not a formal mathematical proof of equivalence for all possible inputs.
          API keys, environment variables, and secrets are excluded.
        </div>
      </div>
    </div>
  );
}
