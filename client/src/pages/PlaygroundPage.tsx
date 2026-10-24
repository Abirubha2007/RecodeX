import { useState, useEffect, useCallback, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Zap, RotateCcw, ChevronDown, ChevronUp, Terminal, AlertCircle, Clock, HardDrive } from 'lucide-react';
import { api } from '@/services/api';
import type { Language, ExecuteResponse } from '@/types/api';
import { AnalysisSidebar } from '@/components/analysis/AnalysisSidebar';
import { AIAssistantPanel } from '@/components/ai-assistant/AIAssistantPanel';

const SAMPLE_CODE: Record<string, string> = {
  python: `# ReCodeX Python Sample
def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr

data = [64, 34, 25, 12, 22, 11, 90]
result = bubble_sort(data)
print("Sorted:", result)
`,
  c: `#include <stdio.h>

void bubbleSort(int arr[], int n) {
    for (int i = 0; i < n - 1; i++)
        for (int j = 0; j < n - i - 1; j++)
            if (arr[j] > arr[j+1]) {
                int tmp = arr[j];
                arr[j] = arr[j+1];
                arr[j+1] = tmp;
            }
}

int main() {
    int arr[] = {64, 34, 25, 12, 22, 11, 90};
    int n = sizeof(arr) / sizeof(arr[0]);
    bubbleSort(arr, n);
    printf("Sorted: ");
    for (int i = 0; i < n; i++) printf("%d ", arr[i]);
    printf("\\n");
    return 0;
}
`,
  javascript: `// ReCodeX JavaScript Sample
function bubbleSort(arr) {
  const n = arr.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n - i - 1; j++) {
      if (arr[j] > arr[j + 1]) {
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
      }
    }
  }
  return arr;
}

const data = [64, 34, 25, 12, 22, 11, 90];
console.log("Sorted:", bubbleSort(data).join(", "));
`,
};

const LANG_MONACO: Record<string, string> = {
  python: 'python',
  c: 'c',
  cpp: 'cpp',
  javascript: 'javascript',
  java: 'java',
  go: 'go',
  rust: 'rust',
  typescript: 'typescript',
};

type ConsoleTab = 'output' | 'stderr' | 'stdin';

export function PlaygroundPage() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState(SAMPLE_CODE.python);
  const [stdin, setStdin] = useState('');
  const [result, setResult] = useState<ExecuteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consoleTab, setConsoleTab] = useState<ConsoleTab>('output');
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const consoleHeight = 220;

  useEffect(() => {
    api.languages().then(setLanguages).catch(() => {});
  }, []);

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    if (SAMPLE_CODE[lang]) setCode(SAMPLE_CODE[lang]);
    setResult(null);
    setError(null);
    setAnalysisResult(null);
  };

  const handleRun = useCallback(async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setConsoleOpen(true);
    setConsoleTab('output');
    try {
      const r = await api.execute({ language, source_code: code, stdin });
      setResult(r);
      if (r.stderr || r.compile_output) setConsoleTab('stderr');
    } catch (e: any) {
      setError(e.message || 'Execution failed');
    } finally {
      setLoading(false);
    }
  }, [code, language, stdin]);

  const handleAnalyze = useCallback(async () => {
    if (!code.trim()) return;
    setAnalyzing(true);
    setError(null);
    try {
      const r = await api.analyze({ language, source_code: code });
      setAnalysisResult(r);
      setShowAnalysis(true);
    } catch (e: any) {
      setError(e.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }, [code, language]);

  const handleReset = () => {
    setCode(SAMPLE_CODE[language] || '');
    setResult(null);
    setError(null);
    setStdin('');
    setAnalysisResult(null);
  };

  const statusColor = () => {
    if (!result) return '';
    if (result.status === 'accepted') return 'var(--color-success)';
    if (result.status.includes('error') || result.status === 'timeout') return 'var(--color-error)';
    return 'var(--color-warning)';
  };

  const consoleContent = () => {
    if (consoleTab === 'stdin') return null;
    if (consoleTab === 'stderr') {
      const txt = result?.compile_output || result?.stderr;
      if (!txt) return <span className="console-output empty">No error output.</span>;
      return <pre className="console-output error-output">{txt}</pre>;
    }
    if (result?.stdout) return <pre className="console-output">{result.stdout}</pre>;
    if (result?.message) return <pre className="console-output error-output">{result.message}</pre>;
    if (error) return <pre className="console-output error-output">{error}</pre>;
    return <span className="console-output empty">Run your code to see output here.</span>;
  };

  return (
    <div className="playground-layout" style={{ height: '100vh' }}>
      {/* Toolbar */}
      <div className="playground-toolbar">
        <select
          id="language-select"
          className="select"
          style={{ width: 160 }}
          value={language}
          onChange={e => handleLanguageChange(e.target.value)}
          disabled={loading}
        >
          {languages.length > 0
            ? languages.map(l => <option key={l.id} value={l.id}>{l.name}</option>)
            : <option value={language}>{language}</option>
          }
        </select>

        <button
          id="run-code-btn"
          className="btn btn-primary"
          onClick={handleRun}
          disabled={loading || !code.trim()}
        >
          {loading ? <span className="spinner" /> : <Play size={15} />}
          {loading ? 'Running…' : 'Run Code'}
        </button>

        <button
          id="analyze-code-btn"
          className="btn btn-secondary"
          onClick={handleAnalyze}
          disabled={analyzing || !code.trim()}
        >
          {analyzing ? <span className="spinner" /> : <Zap size={15} />}
          {analyzing ? 'Analyzing…' : 'Analyze'}
        </button>

        <button
          id="ai-assist-btn"
          className="btn btn-secondary"
          onClick={() => setShowAI(v => !v)}
          title="AI Assistant"
        >
          <span style={{ fontSize: '1rem' }}>🤖</span>
          {showAI ? 'Hide AI' : 'AI Assistant'}
        </button>

        <button
          id="reset-btn"
          className="btn btn-ghost btn-sm"
          onClick={handleReset}
          title="Reset to sample"
        >
          <RotateCcw size={14} />
          Reset
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {result && (
            <div className="flex items-center gap-2 text-sm">
              <span className="status-dot" style={{ background: statusColor() }} />
              <span style={{ color: statusColor(), fontWeight: 500 }}>
                {result.status.replace(/_/g, ' ')}
              </span>
              {result.time_seconds != null && (
                <span className="text-muted flex items-center gap-1">
                  <Clock size={12} /> {result.time_seconds.toFixed(3)}s
                </span>
              )}
              {result.memory_kb != null && (
                <span className="text-muted flex items-center gap-1">
                  <HardDrive size={12} /> {result.memory_kb} KB
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="playground-body" style={{ flex: 1, overflow: 'hidden' }}>
        <div className="editor-container">
          {/* Monaco Editor */}
          <div className="editor-wrapper" style={{ flex: 1 }}>
            <Editor
              height="100%"
              language={LANG_MONACO[language] || 'plaintext'}
              value={code}
              onChange={v => setCode(v || '')}
              theme="vs"
              options={{
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                minimap: { enabled: false },
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 4,
                wordWrap: 'on',
                padding: { top: 12, bottom: 12 },
                renderLineHighlight: 'gutter',
                smoothScrolling: true,
              }}
            />
          </div>

          {/* Console */}
          {consoleOpen && (
            <div className="console-panel" style={{ height: consoleHeight }}>
              <div className="console-header">
                <Terminal size={14} style={{ color: 'var(--color-muted)' }} />
                <div className="console-tabs">
                  {(['output', 'stderr', 'stdin'] as ConsoleTab[]).map(tab => (
                    <button
                      key={tab}
                      id={`console-tab-${tab}`}
                      className={`console-tab${consoleTab === tab ? ' active' : ''}`}
                      onClick={() => setConsoleTab(tab)}
                    >
                      {tab === 'stderr' ? 'Error / Compile' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                      {tab === 'stderr' && (result?.stderr || result?.compile_output) && (
                        <AlertCircle size={10} style={{ marginLeft: 4, color: 'var(--color-error)' }} />
                      )}
                    </button>
                  ))}
                </div>
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => setConsoleOpen(false)}
                  title="Close console"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
              {consoleTab === 'stdin' ? (
                <div style={{ padding: '10px 16px', flex: 1 }}>
                  <textarea
                    id="stdin-input"
                    className="textarea"
                    style={{ height: 140, maxHeight: 140 }}
                    placeholder="Enter standard input here…"
                    value={stdin}
                    onChange={e => setStdin(e.target.value)}
                  />
                </div>
              ) : (
                consoleContent()
              )}
            </div>
          )}

          {!consoleOpen && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ borderTop: '1px solid var(--color-border)', borderRadius: 0, justifyContent: 'flex-start', padding: '6px 16px' }}
              onClick={() => setConsoleOpen(true)}
            >
              <ChevronUp size={14} /> Console
            </button>
          )}
        </div>

        {/* Analysis Sidebar */}
        {showAnalysis && (
          <AnalysisSidebar
            result={analysisResult}
            code={code}
            language={language}
            executeResult={result}
            onClose={() => setShowAnalysis(false)}
          />
        )}

        {/* AI Panel */}
        {showAI && (
          <AIAssistantPanel
            code={code}
            language={language}
            executeResult={result}
            onAcceptOptimization={(optimized: string) => setCode(optimized)}
            onClose={() => setShowAI(false)}
          />
        )}
      </div>
    </div>
  );
}
