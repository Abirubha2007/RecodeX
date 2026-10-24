import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock @monaco-editor/react to avoid loading Monaco in tests
vi.mock('@monaco-editor/react', () => ({
  default: ({ onChange, value }: any) => (
    <textarea
      data-testid="monaco-editor"
      value={value || ''}
      onChange={e => onChange?.(e.target.value)}
    />
  ),
  DiffEditor: ({ original, modified, onMount }: any) => (
    <div data-testid="diff-editor">
      <textarea data-testid="diff-original" defaultValue={original} />
      <textarea data-testid="diff-modified" defaultValue={modified} />
    </div>
  ),
}));

// Mock axios
vi.mock('axios', () => {
  const mockAxios: any = {
    create: () => mockAxios,
    get: vi.fn(),
    post: vi.fn(),
    isAxiosError: vi.fn(() => false),
    defaults: { headers: { common: {} } },
  };
  return { default: mockAxios };
});

import { LandingPage } from '@/pages/LandingPage';
import { AnalysisPage } from '@/pages/AnalysisPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { api } from '@/services/api';

// ── Landing Page ──────────────────────────────────────────────────────────────

describe('LandingPage', () => {
  it('renders hero title and tagline', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/Write\. Run\. Optimize\. Evolve\./i)).toBeInTheDocument();
  });

  it('renders Open Playground CTA button', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );
    const btns = screen.getAllByRole('button', { name: /open playground/i });
    expect(btns.length).toBeGreaterThan(0);
  });

  it('renders feature cards', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );
    expect(screen.getByText('Secure Code Execution')).toBeInTheDocument();
    expect(screen.getByText('Explainable Green Score')).toBeInTheDocument();
  });
});

// ── Analysis Page ─────────────────────────────────────────────────────────────

describe('AnalysisPage', () => {
  beforeEach(() => {
    vi.spyOn(api, 'analyze').mockResolvedValue({
      language: 'python',
      findings: [
        {
          rule_id: 'PY001',
          title: 'Nested loop detected',
          severity: 'warning',
          confidence: 'medium',
          line: 2,
          explanation: 'Two nested loops found.',
          suggestion: 'Consider a hash map.',
        },
      ],
      complexity: {
        estimated_time_complexity: 'O(n²)',
        estimated_auxiliary_space: 'O(1)',
        confidence: 'medium',
        reasoning: 'Two nested loops.',
        assumptions: [],
        limitations: 'Heuristic only.',
      },
      analysis_source: 'static',
    });
  });

  it('renders the analyze button', () => {
    render(
      <MemoryRouter>
        <AnalysisPage />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: /analyze code/i })).toBeInTheDocument();
  });

  it('shows complexity result after analyze', async () => {
    render(
      <MemoryRouter>
        <AnalysisPage />
      </MemoryRouter>
    );

    const editor = screen.getByTestId('monaco-editor');
    fireEvent.change(editor, { target: { value: 'for i in range(n):\n  for j in range(n): pass' } });

    const btn = screen.getByRole('button', { name: /analyze code/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByText('O(n²)')).toBeInTheDocument();
    });
  });

  it('shows finding title after analyze', async () => {
    render(
      <MemoryRouter>
        <AnalysisPage />
      </MemoryRouter>
    );

    const editor = screen.getByTestId('monaco-editor');
    fireEvent.change(editor, { target: { value: 'some code' } });
    fireEvent.click(screen.getByRole('button', { name: /analyze code/i }));

    await waitFor(() => {
      expect(screen.getByText('Nested loop detected')).toBeInTheDocument();
    });
  });
});

// ── Settings Page ─────────────────────────────────────────────────────────────

describe('SettingsPage', () => {
  it('shows loading state initially', async () => {
    vi.spyOn(api, 'health').mockResolvedValue({
      status: 'ok',
      version: '1.0.0',
      env: 'development',
      features: { execution: false, ai: false },
    });
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/checking backend/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Feature Status/i)).toBeInTheDocument();
    });
  });

  it('shows feature status after health response', async () => {
    vi.spyOn(api, 'health').mockResolvedValue({
      status: 'ok',
      version: '1.0.0',
      env: 'development',
      features: { execution: true, ai: false },
    });
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText(/Feature Status/i)).toBeInTheDocument();
    });
  });

  it('shows error when backend unreachable', async () => {
    vi.spyOn(api, 'health').mockRejectedValue(new Error('Network Error'));
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText(/cannot reach backend/i)).toBeInTheDocument();
    });
  });
});

// ── API service ───────────────────────────────────────────────────────────────

describe('api service', () => {
  it('is exported', () => {
    expect(api).toBeDefined();
    expect(typeof api.health).toBe('function');
    expect(typeof api.execute).toBe('function');
    expect(typeof api.analyze).toBe('function');
    expect(typeof api.optimize).toBe('function');
    expect(typeof api.compare).toBe('function');
    expect(typeof api.benchmark).toBe('function');
    expect(typeof api.greenScore).toBe('function');
  });
});
