import { useEffect, useState } from 'react';
import { Settings, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { api } from '@/services/api';
import type { HealthResponse } from '@/types/api';

export function SettingsPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.health()
      .then(h => { setHealth(h); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  return (
    <div className="page" style={{ maxWidth: 700 }}>
      <div className="flex items-center gap-2 mb-4">
        <Settings size={20} style={{ color: 'var(--color-primary)' }} />
        <h1 style={{ fontSize: '1.25rem', margin: 0 }}>Settings & Configuration</h1>
      </div>
      <p className="text-sm text-muted mb-6">
        ReCodeX reads configuration from the <code>.env</code> file in the server root.
        No credentials are stored in the browser.
      </p>

      {loading && <div className="flex items-center gap-2 text-muted"><span className="spinner" /> Checking backend…</div>}
      {error && <div className="alert alert-error"><XCircle size={16} /> Cannot reach backend: {error}</div>}

      {health && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Backend */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Backend Status</span>
              <span className="badge badge-success">v{health.version}</span>
            </div>
            <div className="text-sm" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="flex items-center gap-2">
                <CheckCircle size={14} style={{ color: 'var(--color-success)' }} />
                API reachable — environment: <strong>{health.env}</strong>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Feature Status</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <FeatureRow
                name="Code Execution"
                enabled={health.features.execution}
                enabledMsg="Execution provider is configured and ready."
                disabledMsg="Set JUDGE0_BASE_URL in your .env file. You can use a self-hosted Judge0 instance or a compatible service."
                link="https://judge0.com"
                linkLabel="Judge0 Documentation"
              />
              <FeatureRow
                name="AI Assistant (Groq)"
                enabled={health.features.ai}
                enabledMsg="GROQ_API_KEY is configured. AI features are available."
                disabledMsg="Set GROQ_API_KEY and GROQ_MODEL in your .env file. Get a free key at console.groq.com."
                link="https://console.groq.com"
                linkLabel="Groq Console"
              />
            </div>
          </div>

          {/* Environment guide */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Configuration Guide</span>
            </div>
            <div className="text-sm" style={{ lineHeight: 1.8 }}>
              <p>Copy <code>.env.example</code> to <code>.env</code> in the project root and fill in your values:</p>
              <pre style={{
                background: 'var(--color-surface)',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                marginTop: 10,
                fontSize: '0.8rem',
                overflowX: 'auto',
              }}>
{`GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile

JUDGE0_BASE_URL=https://your-judge0-instance.com
JUDGE0_API_KEY=  # leave empty if not required`}
              </pre>
              <p className="text-muted mt-3">
                Secrets are never logged, exposed to the browser, or sent to the AI provider.
              </p>
            </div>
          </div>

          {/* Limitations note */}
          <div className="alert alert-info">
            <span>ℹ</span>
            <div>
              <strong>MVP Limitations:</strong> This is an unauthenticated stateless MVP.
              No user accounts, project history, or database are implemented.
              All code and results exist only for the current session.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FeatureRow({
  name, enabled, enabledMsg, disabledMsg, link, linkLabel,
}: {
  name: string;
  enabled: boolean;
  enabledMsg: string;
  disabledMsg: string;
  link?: string;
  linkLabel?: string;
}) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      {enabled
        ? <CheckCircle size={18} style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: 1 }} />
        : <XCircle size={18} style={{ color: 'var(--color-error)', flexShrink: 0, marginTop: 1 }} />
      }
      <div>
        <div style={{ fontWeight: 500, color: 'var(--color-heading)', marginBottom: 2 }}>{name}</div>
        <div className="text-sm text-muted">{enabled ? enabledMsg : disabledMsg}</div>
        {!enabled && link && (
          <a href={link} target="_blank" rel="noreferrer" className="text-sm flex items-center gap-1 mt-1" style={{ color: 'var(--color-primary)' }}>
            {linkLabel} <ExternalLink size={11} />
          </a>
        )}
      </div>
    </div>
  );
}
