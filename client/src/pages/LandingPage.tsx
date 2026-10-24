import { useNavigate } from 'react-router-dom';
import {
  Zap, Code2, BarChart2, GitCompare, Gauge,
  Play, Brain, Shield, TrendingUp, ArrowRight, ShieldCheck, FileText, Lock
} from 'lucide-react';

const FEATURES = [
  {
    icon: ShieldCheck,
    name: 'Proof-Carrying Optimization',
    desc: 'Every accepted optimization ships with a cryptographically-hashed Proof Report — source snapshots, SHA-256 fingerprints, per-version execution outcomes, and a correctness verdict. Never trust an AI suggestion without evidence.',
    highlight: true,
  },
  {
    icon: Play,
    name: 'Secure Code Execution',
    desc: 'Run Python, C, C++, JavaScript, and more in an isolated sandbox. Never executed in-process.',
  },
  {
    icon: BarChart2,
    name: 'Static Code Analysis',
    desc: 'AST-based rules detect nested loops, string concat patterns, unsafe C functions, and more.',
  },
  {
    icon: Brain,
    name: 'AI Explanations & Optimization',
    desc: 'Groq-powered AI explains errors, estimates complexity, and proposes optimized candidates.',
  },
  {
    icon: GitCompare,
    name: 'Green Diff Verification',
    desc: 'Side-by-side diff with actual execution comparison. Never trusts AI output blindly.',
  },
  {
    icon: TrendingUp,
    name: 'Complexity Estimation',
    desc: 'Heuristic O(n), O(n²) and similar estimates with documented confidence and limitations.',
  },
  {
    icon: Shield,
    name: 'Explainable Green Score',
    desc: 'Transparent 0–100 score from documented components. No fake metrics or default values.',
  },
];

const HOW_IT_WORKS = [
  { step: '01', title: 'Write', desc: 'Edit code in the Monaco-powered playground with language-specific highlighting.' },
  { step: '02', title: 'Run', desc: 'Execute in an isolated Judge0-compatible sandbox. See stdout, stderr, and timing.' },
  { step: '03', title: 'Optimize', desc: 'Request an AI candidate, inspect the diff, and verify correctness with actual tests.' },
  { step: '04', title: 'Evolve', desc: 'Accept verified improvements. Track complexity, Green Score, and benchmark trends.' },
];

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing">
      {/* Nav */}
      <header className="landing-nav">
        <div className="flex items-center gap-2">
          <div className="logo-icon">
            <Zap size={18} strokeWidth={2.5} />
          </div>
          <span className="logo-text">Re<span>Code</span>X</span>
        </div>
        <button
          id="open-playground-nav"
          className="btn btn-primary btn-sm"
          onClick={() => navigate('/playground')}
        >
          Open Playground
          <ArrowRight size={14} />
        </button>
      </header>

      {/* Hero */}
      <section className="landing-hero">
        <div className="hero-tagline">Write. Run. Optimize. Evolve.</div>
        <h1 className="hero-title">
          The AI coding workspace that<br />
          <span className="accent">verifies before it trusts</span>
        </h1>
        <p className="hero-desc">
          ReCodeX combines a Monaco-powered playground, secure code execution, deterministic
          static analysis, and Groq AI — but never accepts an optimization until it's been
          run through identical test inputs and proven correct.
        </p>
        <div className="flex items-center gap-3" style={{ justifyContent: 'center' }}>
          <button
            id="open-playground-hero"
            className="btn btn-primary btn-lg"
            onClick={() => navigate('/playground')}
          >
            Open Playground
            <ArrowRight size={16} />
          </button>
          <button
            id="see-features"
            className="btn btn-secondary btn-lg"
            onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
          >
            See Features
          </button>
        </div>
      </section>

      {/* How it works */}
      <section style={{ maxWidth: 960, margin: '0 auto', padding: '60px 24px 0' }}>
        <h2 style={{ textAlign: 'center', fontSize: '1.5rem', marginBottom: 40 }}>How It Works</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 20 }}>
          {HOW_IT_WORKS.map(({ step, title, desc }) => (
            <div key={step} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{
                fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)',
                letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>{step}</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-heading)' }}>{title}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-muted)', lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Proof-Carrying Optimization Spotlight */}
      <section style={{
        maxWidth: 960,
        margin: '60px auto 0',
        padding: '0 24px',
      }}>
        <div style={{
          background: 'linear-gradient(135deg, var(--color-surface) 0%, color-mix(in srgb, var(--color-primary) 8%, var(--color-surface)) 100%)',
          border: '1px solid color-mix(in srgb, var(--color-primary) 30%, var(--color-border))',
          borderRadius: 16,
          padding: '40px 48px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 48,
          alignItems: 'center',
        }}>
          {/* Left: copy */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                background: 'var(--color-primary)',
                borderRadius: 10,
                width: 40, height: 40,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <ShieldCheck size={20} color="#fff" />
              </div>
              <span style={{
                fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: 'var(--color-primary)',
              }}>New Feature</span>
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-heading)', margin: 0, lineHeight: 1.3 }}>
              Proof-Carrying Optimization
            </h2>
            <p style={{ color: 'var(--color-muted)', lineHeight: 1.7, margin: 0 }}>
              Every accepted optimization now ships with a tamper-evident <strong style={{ color: 'var(--color-text)' }}>Proof Report</strong>:
              source snapshots, SHA-256 cryptographic fingerprints, per-version execution outcomes,
              and a correctness verdict — all kept strictly separate from the performance verdict.
            </p>
            <p style={{ color: 'var(--color-muted)', lineHeight: 1.7, margin: 0 }}>
              Export the report as JSON or a standalone HTML certificate. Share it. Archive it.
              Never accept an AI optimization without evidence.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
              <button
                id="pco-try-it-btn"
                className="btn btn-primary"
                onClick={() => navigate('/green-diff')}
              >
                <ShieldCheck size={15} /> Try It — Green Diff
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Right: proof report mini-preview */}
          <div style={{
            background: 'var(--color-surface-2, #1e1e2e)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            fontSize: '0.8125rem',
            fontFamily: 'monospace',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <ShieldCheck size={14} style={{ color: 'var(--color-success, #22c55e)' }} />
              <span style={{ fontWeight: 600, color: 'var(--color-heading)', fontFamily: 'inherit' }}>Proof Report</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginLeft: 'auto' }}>proof_a3f9...</span>
            </div>
            {[
              { icon: Lock, label: 'Correctness', value: 'Verified for tested cases', color: 'var(--color-success, #22c55e)' },
              { icon: TrendingUp, label: 'Performance', value: 'Improvement (−0.032s)', color: 'var(--color-primary)' },
              { icon: FileText, label: 'Original SHA-256', value: 'a3f9c2e1d4b87...', color: 'var(--color-muted)' },
              { icon: FileText, label: 'Candidate SHA-256', value: '8d1e4a9f3c026...', color: 'var(--color-muted)' },
            ].map(({ icon: RowIcon, label, value, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <RowIcon size={13} style={{ color, marginTop: 2, flexShrink: 0 }} />
                <div>
                  <span style={{ color: 'var(--color-muted)' }}>{label}: </span>
                  <span style={{ color }}>{value}</span>
                </div>
              </div>
            ))}
            <div style={{
              marginTop: 4,
              padding: '6px 10px',
              background: 'color-mix(in srgb, var(--color-success, #22c55e) 10%, transparent)',
              borderRadius: 6,
              color: 'var(--color-success, #22c55e)',
              fontSize: '0.75rem',
              fontFamily: 'sans-serif',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Lock size={11} /> Secrets Redacted · Provider: onlinecompiler
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="features-grid">
        {FEATURES.map(({ icon: Icon, name, desc, highlight }: any) => (
          <div
            key={name}
            className="feature-card"
            style={highlight ? {
              gridColumn: 'span 2',
              border: '1px solid color-mix(in srgb, var(--color-primary) 40%, var(--color-border))',
              background: 'color-mix(in srgb, var(--color-primary) 5%, var(--color-surface))',
            } : undefined}
          >
            <div className="feature-icon" style={highlight ? { background: 'var(--color-primary)', color: '#fff' } : undefined}>
              <Icon size={20} />
            </div>
            <div className="feature-name">{name}</div>
            <div className="feature-desc">{desc}</div>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section style={{ textAlign: 'center', padding: '80px 24px 100px' }}>
        <h2 style={{ fontSize: '1.75rem', marginBottom: 12 }}>Ready to write better code?</h2>
        <p style={{ color: 'var(--color-muted)', marginBottom: 28 }}>
          No account required. Start coding immediately.
        </p>
        <button
          id="open-playground-cta"
          className="btn btn-primary btn-lg"
          onClick={() => navigate('/playground')}
        >
          Open Playground
          <ArrowRight size={16} />
        </button>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--color-border)',
        padding: '20px 48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        fontSize: '0.8125rem',
        color: 'var(--color-muted)',
      }}>
        <span>© 2024 ReCodeX. MVP — no authentication, stateless.</span>
        <div className="flex gap-3">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/playground')}><Code2 size={14} /> Playground</button>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/analysis')}><BarChart2 size={14} /> Analysis</button>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/green-diff')}><GitCompare size={14} /> Green Diff</button>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/benchmark')}><Gauge size={14} /> Benchmark</button>
        </div>
      </footer>
    </div>
  );
}
