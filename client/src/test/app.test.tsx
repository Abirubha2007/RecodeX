import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock @monaco-editor/react to avoid loading Monaco in tests
vi.mock('@monaco-editor/react', async () => {
  const React = await import('react');
  return {
    default: ({ onChange, value }: any) => (
      <textarea
        data-testid="monaco-editor"
        value={value || ''}
        onChange={e => onChange?.(e.target.value)}
      />
    ),
    DiffEditor: ({ original, modified, onMount, options }: any) => {
      const origRef = React.useRef(original || '');
      const modRef = React.useRef(modified || '');
      const origListeners = React.useRef<(() => void)[]>([]);
      const modListeners = React.useRef<(() => void)[]>([]);

      React.useEffect(() => {
        if (onMount) {
          const fakeEditor = {
            getOriginalEditor: () => ({
              getValue: () => origRef.current,
              getModel: () => ({
                getValue: () => origRef.current,
                setValue: (v: string) => { origRef.current = v; },
                onDidChangeContent: (cb: () => void) => {
                  origListeners.current.push(cb);
                  return { dispose: () => {} };
                },
              }),
            }),
            getModifiedEditor: () => ({
              getValue: () => modRef.current,
              getModel: () => ({
                getValue: () => modRef.current,
                setValue: (v: string) => { modRef.current = v; },
                onDidChangeContent: (cb: () => void) => {
                  modListeners.current.push(cb);
                  return { dispose: () => {} };
                },
              }),
            }),
          };
          onMount(fakeEditor);
        }
      }, [onMount]);

      return (
        <div data-testid="diff-editor" data-original-editable={String(options?.originalEditable)}>
          <textarea
            data-testid="diff-original"
            defaultValue={original}
            readOnly={options?.originalEditable === false}
            onChange={(e) => {
              origRef.current = e.target.value;
              origListeners.current.forEach(cb => cb());
            }}
          />
          <textarea
            data-testid="diff-modified"
            defaultValue={modified}
            onChange={(e) => {
              modRef.current = e.target.value;
              modListeners.current.forEach(cb => cb());
            }}
          />
        </div>
      );
    },
  };
});

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
import { GreenDiffPage } from '@/pages/GreenDiffPage';
import { ProofReportPage } from '@/pages/ProofReportPage';
import { proofReportStore } from '@/services/proofReportStore';
import { api } from '@/services/api';
import type { ProofReport } from '@/types/api';


// â”€â”€ Landing Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('LandingPage', () => {
  it('renders hero title and tagline', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/Write.*Run.*Optimize.*Verify/i)).toBeInTheDocument();
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

// â”€â”€ Analysis Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
        estimated_time_complexity: 'O(nÂ²)',
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
      expect(screen.getByText('O(nÂ²)')).toBeInTheDocument();
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

// â”€â”€ Settings Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ API service â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Green Diff Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('GreenDiffPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders toolbar, clear labels, and editable badges', () => {
    render(
      <MemoryRouter>
        <GreenDiffPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Green Diff')).toBeInTheDocument();
    expect(screen.getByText('Original Code')).toBeInTheDocument();
    expect(screen.getByText('Optimized Candidate')).toBeInTheDocument();

    const editableBadges = screen.getAllByText('editable');
    expect(editableBadges.length).toBe(2);

    expect(screen.getByRole('button', { name: /verify & compare/i })).toBeInTheDocument();
  });

  it('initializes both editors with useful sample Python sort code', () => {
    render(
      <MemoryRouter>
        <GreenDiffPage />
      </MemoryRouter>
    );

    const origEditor = screen.getByTestId('diff-original') as HTMLTextAreaElement;
    const candEditor = screen.getByTestId('diff-modified') as HTMLTextAreaElement;

    expect(origEditor.value).toContain('Bubble Sort');
    expect(origEditor.value).toContain('def sort_numbers(arr):');
    expect(candEditor.value).toContain('Timsort');
    expect(candEditor.value).toContain('return sorted(arr)');
  });

  it('configures Monaco with originalEditable: true and keeps both editors editable', () => {
    render(
      <MemoryRouter>
        <GreenDiffPage />
      </MemoryRouter>
    );

    const diffContainer = screen.getByTestId('diff-editor');
    expect(diffContainer).toHaveAttribute('data-original-editable', 'true');

    const origEditor = screen.getByTestId('diff-original') as HTMLTextAreaElement;
    const candEditor = screen.getByTestId('diff-modified') as HTMLTextAreaElement;

    expect(origEditor).not.toHaveAttribute('readonly');
    expect(candEditor).not.toHaveAttribute('readonly');
  });

  it('ensures editing one editor does not overwrite the other', () => {
    render(
      <MemoryRouter>
        <GreenDiffPage />
      </MemoryRouter>
    );

    const origEditor = screen.getByTestId('diff-original') as HTMLTextAreaElement;
    const candEditor = screen.getByTestId('diff-modified') as HTMLTextAreaElement;

    const originalCandValue = candEditor.value;

    fireEvent.change(origEditor, { target: { value: 'print("unique original text")' } });
    expect(origEditor.value).toBe('print("unique original text")');
    expect(candEditor.value).toBe(originalCandValue);

    fireEvent.change(candEditor, { target: { value: 'print("unique candidate text")' } });
    expect(candEditor.value).toBe('print("unique candidate text")');
    expect(origEditor.value).toBe('print("unique original text")');
  });

  it('shows helpful validation messages when either editor is empty', async () => {
    render(
      <MemoryRouter>
        <GreenDiffPage />
      </MemoryRouter>
    );

    const origEditor = screen.getByTestId('diff-original');
    const compareBtn = screen.getByRole('button', { name: /verify & compare/i });

    // Clear original editor
    fireEvent.change(origEditor, { target: { value: '' } });
    fireEvent.click(compareBtn);

    await waitFor(() => {
      expect(screen.getByText('Original code cannot be empty.')).toBeInTheDocument();
    });

    // Restore original and clear candidate
    fireEvent.change(origEditor, { target: { value: 'print(1)' } });
    const candEditor = screen.getByTestId('diff-modified');
    fireEvent.change(candEditor, { target: { value: '   ' } });
    fireEvent.click(compareBtn);

    await waitFor(() => {
      expect(screen.getByText('Optimized candidate code cannot be empty.')).toBeInTheDocument();
    });
  });

  it('submits actual editor contents and displays comparison results', async () => {
    const compareSpy = vi.spyOn(api, 'compare').mockResolvedValue({
      correctness_verified: true,
      original: { status: 'accepted', stdout: '123\n', time_seconds: 0.05, memory_kb: 12000 },
      candidate: { status: 'accepted', stdout: '123\n', time_seconds: 0.02, memory_kb: 11000 },
      outputs_match: true,
      time_delta_seconds: -0.03,
      memory_delta_kb: -1000,
      verdict: 'improvement',
      explanation: 'Candidate is faster by 0.030s and produces identical output.',
      limitations: ['Exact string matching used.'],
    });

    render(
      <MemoryRouter>
        <GreenDiffPage />
      </MemoryRouter>
    );

    const origEditor = screen.getByTestId('diff-original');
    const candEditor = screen.getByTestId('diff-modified');
    const stdinInput = screen.getByPlaceholderText(/test stdin/i);
    const langSelect = screen.getByRole('combobox');
    const compareBtn = screen.getByRole('button', { name: /verify & compare/i });

    fireEvent.change(langSelect, { target: { value: 'python' } });
    fireEvent.change(stdinInput, { target: { value: 'my-stdin' } });
    fireEvent.change(origEditor, { target: { value: 'def f(): return 123\nprint(f())' } });
    fireEvent.change(candEditor, { target: { value: 'print(123)' } });

    fireEvent.click(compareBtn);

    await waitFor(() => {
      expect(compareSpy).toHaveBeenCalledWith({
        language: 'python',
        original_code: 'def f(): return 123\nprint(f())',
        candidate_code: 'print(123)',
        test_inputs: ['my-stdin'],
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/Candidate is faster by 0.030s and produces identical output./i)).toBeInTheDocument();
      expect(screen.getByText('0.050s')).toBeInTheDocument();
      expect(screen.getByText('0.020s')).toBeInTheDocument();
    });
  });

  it('publishes proof report to the store and shows link to Proof Report page', async () => {
    proofReportStore.set(null);
    const mockProof = makeProofReport();
    vi.spyOn(api, 'compare').mockResolvedValue({
      correctness_verified: true,
      original: { status: 'accepted', stdout: '1 2 3\n', time_seconds: 0.05, memory_kb: 12000 },
      candidate: { status: 'accepted', stdout: '1 2 3\n', time_seconds: 0.02, memory_kb: 11000 },
      outputs_match: true,
      time_delta_seconds: -0.03,
      verdict: 'improvement',
      explanation: 'Faster.',
      limitations: [],
      proof_report: mockProof,
    });

    render(<MemoryRouter><GreenDiffPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /verify & compare/i }));

    await waitFor(() => {
      // Should show the proof report navigation alert/button
      expect(screen.getByText(/Proof Report generated/i)).toBeInTheDocument();
    });

    // Store should have been populated
    expect(proofReportStore.get()).not.toBeNull();
    expect(proofReportStore.get()?.id).toBe('proof_abcdef1234567890');
  });
});

// ── makeProofReport factory ───────────────────────────────────────────────────

const makeProofReport = (overrides: Partial<ProofReport> = {}): ProofReport => ({
  id: 'proof_abcdef1234567890',
  timestamp: '2026-10-24T14:00:00Z',
  language: 'python',
  test_inputs: ['5 3'],
  source: {
    original: { code: 'def sort(a): pass', sha256: 'aaa111', bytes: 17 },
    candidate: { code: 'def sort(a): return sorted(a)', sha256: 'bbb222', bytes: 29 },
  },
  execution_provider: { provider: 'onlinecompiler', compiler: 'python3' },
  executions: {
    original: { status: 'accepted', exit_code: 0, time_seconds: 0.05, memory_kb: 12000, stdout_sample: '1 2 3' },
    candidate: { status: 'accepted', exit_code: 0, time_seconds: 0.02, memory_kb: 11000, stdout_sample: '1 2 3' },
  },
  correctness: { status: 'verified', label: 'Verified for tested cases', outputs_match: true, details: 'Outputs matched.' },
  performance: { verdict: 'improvement', label: 'Performance Improvement', time_delta_seconds: -0.03, memory_delta_kb: -1000, details: 'Faster by 0.030s.' },
  missing_metrics: [],
  limitations: ['Exact string matching used.'],
  unresolved_risks: [],
  secrets_redacted: true,
  ...overrides,
});

// ── Proof Report Page ─────────────────────────────────────────────────────────

describe('ProofReportPage', () => {
  beforeEach(() => {
    proofReportStore.set(null);
    vi.restoreAllMocks();
  });

  it('shows empty state with link to Green Diff when no report is available', () => {
    render(<MemoryRouter><ProofReportPage /></MemoryRouter>);
    expect(screen.getByText(/No Proof Report yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go to green diff/i })).toBeInTheDocument();
  });

  it('shows report ID, timestamp, and metadata when a report is in the store', () => {
    proofReportStore.set(makeProofReport());
    render(<MemoryRouter><ProofReportPage /></MemoryRouter>);
    expect(screen.getByText('proof_abcdef1234567890')).toBeInTheDocument();
    expect(screen.getByText(/2026-10-24T14:00:00Z/)).toBeInTheDocument();
    expect(screen.getByText(/onlinecompiler/i)).toBeInTheDocument();
  });

  it('shows verified correctness badge', () => {
    proofReportStore.set(makeProofReport());
    render(<MemoryRouter><ProofReportPage /></MemoryRouter>);
    expect(screen.getByText('Verified for tested cases')).toBeInTheDocument();
  });

  it('shows performance badge for improvement', () => {
    proofReportStore.set(makeProofReport());
    render(<MemoryRouter><ProofReportPage /></MemoryRouter>);
    expect(screen.getByText('Performance Improvement')).toBeInTheDocument();
  });

  it('shows SHA-256 hashes for original and candidate', () => {
    proofReportStore.set(makeProofReport());
    render(<MemoryRouter><ProofReportPage /></MemoryRouter>);
    expect(screen.getByText(/Original SHA-256/i)).toBeInTheDocument();
    expect(screen.getByText(/Candidate SHA-256/i)).toBeInTheDocument();
    expect(screen.getByText('aaa111')).toBeInTheDocument();
    expect(screen.getByText('bbb222')).toBeInTheDocument();
  });

  it('shows missing metrics when present', () => {
    proofReportStore.set(makeProofReport({
      missing_metrics: ['execution time not available', 'memory usage not reported'],
    }));
    render(<MemoryRouter><ProofReportPage /></MemoryRouter>);
    expect(screen.getByText('Missing Evidence Metrics')).toBeInTheDocument();
    expect(screen.getByText('execution time not available')).toBeInTheDocument();
    expect(screen.getByText('memory usage not reported')).toBeInTheDocument();
  });

  it('shows unresolved risks when present', () => {
    proofReportStore.set(makeProofReport({
      unresolved_risks: ['Only one test case evaluated.', 'External I/O not tested.'],
    }));
    render(<MemoryRouter><ProofReportPage /></MemoryRouter>);
    expect(screen.getByText('Unresolved Risks')).toBeInTheDocument();
    expect(screen.getByText('Only one test case evaluated.')).toBeInTheDocument();
    expect(screen.getByText('External I/O not tested.')).toBeInTheDocument();
  });

  it('shows failed correctness badge when outputs do not match', () => {
    proofReportStore.set(makeProofReport({
      correctness: { status: 'failed' as const, label: 'Failed', outputs_match: false, details: 'Outputs differ.' },
      performance: { verdict: 'insufficient_evidence' as const, label: 'Insufficient Evidence', details: 'Cannot assess.' },
    }));
    render(<MemoryRouter><ProofReportPage /></MemoryRouter>);
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Insufficient Evidence')).toBeInTheDocument();
  });

  it('Download HTML button triggers a download and Download JSON is removed', async () => {
    proofReportStore.set(makeProofReport());
    URL.createObjectURL = vi.fn(() => 'mock-url');
    URL.revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<MemoryRouter><ProofReportPage /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: /download json/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /download html/i }));

    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
    });
    clickSpy.mockRestore();
  });

  it('exported JSON does not contain API key patterns', () => {
    const mockProof = makeProofReport();
    const jsonStr = JSON.stringify(mockProof);
    expect(jsonStr).not.toMatch(/sk-[a-zA-Z0-9]/);
    expect(jsonStr).not.toMatch(/GROQ_API_KEY/i);
    expect(jsonStr).not.toMatch(/ONLINECOMPILER_API_KEY/i);
    expect(jsonStr).not.toMatch(/DATABASE_URL/i);
    expect(mockProof.secrets_redacted).toBe(true);
  });

  it('shows secrets_redacted indicator in metadata', () => {
    proofReportStore.set(makeProofReport());
    render(<MemoryRouter><ProofReportPage /></MemoryRouter>);
    expect(screen.getByText(/Secrets redacted/i)).toBeInTheDocument();
  });

  it('shows the disclaimer about limitations of proof', () => {
    proofReportStore.set(makeProofReport());
    render(<MemoryRouter><ProofReportPage /></MemoryRouter>);
    expect(screen.getByText(/not.*formal mathematical proof/i)).toBeInTheDocument();
  });

  it('updates when the store emits a new report', async () => {
    render(<MemoryRouter><ProofReportPage /></MemoryRouter>);
    expect(screen.getByText(/No Proof Report yet/i)).toBeInTheDocument();
    proofReportStore.set(makeProofReport());
    await waitFor(() => {
      expect(screen.getByText('proof_abcdef1234567890')).toBeInTheDocument();
    });
  });
});

// ── GreenDiff: publishes to store ────────────────────────────────────────────

describe('GreenDiff publishes proof report to store', () => {
  beforeEach(() => {
    sessionStorage.clear();
    proofReportStore.set(null);
    vi.restoreAllMocks();
  });

  it('publishes proof report to the store and shows link to Proof Report page', async () => {
    const mockProof = makeProofReport();
    vi.spyOn(api, 'compare').mockResolvedValue({
      correctness_verified: true,
      original: { status: 'accepted', stdout: '1 2 3\n', time_seconds: 0.05, memory_kb: 12000 },
      candidate: { status: 'accepted', stdout: '1 2 3\n', time_seconds: 0.02, memory_kb: 11000 },
      outputs_match: true,
      time_delta_seconds: -0.03,
      verdict: 'improvement',
      explanation: 'Faster.',
      limitations: [],
      proof_report: mockProof,
    });

    render(<MemoryRouter><GreenDiffPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /verify & compare/i }));

    await waitFor(() => {
      expect(screen.getByText(/Proof Report generated/i)).toBeInTheDocument();
    });

    expect(proofReportStore.get()).not.toBeNull();
    expect(proofReportStore.get()?.id).toBe('proof_abcdef1234567890');
  });
});

// ── Navigation separation ─────────────────────────────────────────────────────

describe('Navigation: Green Diff and Proof Report are separate', () => {
  beforeEach(() => { proofReportStore.set(null); });

  it('GreenDiffPage does not render Download JSON or Download HTML buttons', () => {
    render(<MemoryRouter><GreenDiffPage /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: /download json/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /download html/i })).not.toBeInTheDocument();
  });

  it('ProofReportPage does not render a code diff editor or Verify button', () => {
    proofReportStore.set(makeProofReport());
    render(<MemoryRouter><ProofReportPage /></MemoryRouter>);
    expect(screen.queryByTestId('diff-editor')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /verify & compare/i })).not.toBeInTheDocument();
  });
});
