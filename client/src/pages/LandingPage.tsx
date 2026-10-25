import { useNavigate } from 'react-router-dom';
import { Play, BarChart2, GitCompare, ArrowRight, Code2, Gauge, FileCheck, Shield, TrendingUp, Brain } from 'lucide-react';
import { ReCodeXLogo } from '@/components/layout/ReCodeXLogo';

const FEATURES = [
  {
    icon: Play,
    name: 'Secure Code Execution',
    desc: 'Run Python, C, C++, JavaScript, and more in an isolated sandbox. Never executed in-process.',
  },
  {
    icon: GitCompare,
    name: 'Green Diff Verification',
    desc: 'Side-by-side diff with actual execution comparison. Never trusts AI output blindly.',
  },
  {
    icon: Brain,
    name: 'AI-Powered Analysis',
    desc: 'Groq AI explains errors, estimates complexity, and proposes optimizations backed by static analysis.',
  },
  {
    icon: Shield,
    name: 'Explainable Green Score',
    desc: 'Transparent 0–100 score from documented components. No fake metrics or default values.',
  },
  {
    icon: FileCheck,
    name: 'Proof Report Certification',
    desc: 'Downloadable JSON evidence bundle and standalone HTML certificates with runtime metrics and source hashes.',
  },
  {
    icon: TrendingUp,
    name: 'Complexity Estimation',
    desc: 'Heuristic Big-O estimates with documented confidence scores and clear boundary limitations.',
  },
];

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing">
      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <header className="landing-nav">
        <ReCodeXLogo wordmark iconSize={32} />

        <nav className="flex gap-2 items-center">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('/analysis')}
          >
            <BarChart2 size={14} /> Analysis
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('/green-diff')}
          >
            <GitCompare size={14} /> Green Diff
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('/benchmark')}
          >
            <Gauge size={14} /> Benchmark
          </button>
          <button
            id="open-playground-nav"
            className="btn btn-primary btn-sm"
            onClick={() => navigate('/playground')}
          >
            Open Playground
            <ArrowRight size={14} />
          </button>
        </nav>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="landing-hero">
        <div className="hero-tagline">Write · Run · Optimize · Verify</div>
        <h1 className="hero-title">
          The AI coding workspace that<br />
          <span className="accent">verifies before it trusts</span>
        </h1>
        <p className="hero-desc">
          ReCodeX combines a Monaco-powered playground, secure code execution, deterministic
          static analysis, and Groq AI&nbsp;— but never accepts an optimization until it's been
          run through identical test inputs and proven correct.
        </p>
        <button
          id="open-playground-hero"
          className="btn btn-primary btn-lg"
          onClick={() => navigate('/playground')}
        >
          Open Playground
          <ArrowRight size={16} />
        </button>
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section id="features" className="features-grid">
        {FEATURES.map(({ icon: Icon, name, desc }) => (
          <div key={name} className="feature-card">
            <div className="feature-icon">
              <Icon size={20} />
            </div>
            <div className="feature-name">{name}</div>
            <div className="feature-desc">{desc}</div>
          </div>
        ))}
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="landing-footer">
        <ReCodeXLogo wordmark iconSize={24} />
        <div className="flex gap-3">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/playground')}>
            <Code2 size={13} /> Playground
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/analysis')}>
            <BarChart2 size={13} /> Analysis
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/green-diff')}>
            <GitCompare size={13} /> Green Diff
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/proof-report')}>
            <FileCheck size={13} /> Proof Report
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/benchmark')}>
            <Gauge size={13} /> Benchmark
          </button>
        </div>
        <span className="text-xs text-muted">© 2024 ReCodeX. MVP — stateless.</span>
      </footer>
    </div>
  );
}
