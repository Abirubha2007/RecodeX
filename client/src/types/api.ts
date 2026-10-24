// API types mirroring server schemas

export interface Language {
  id: string;
  name: string;
  version?: string;
  judge0_id?: number;
}

export interface ExecuteResponse {
  status: string;
  stdout?: string;
  stderr?: string;
  compile_output?: string;
  exit_code?: number;
  time_seconds?: number;
  memory_kb?: number;
  message?: string;
}

export interface Finding {
  rule_id: string;
  title: string;
  severity: 'info' | 'warning' | 'error';
  confidence: 'high' | 'medium' | 'low';
  line?: number;
  explanation: string;
  suggestion: string;
  limitations?: string;
}

export interface ComplexityEstimate {
  estimated_time_complexity: string;
  estimated_auxiliary_space: string;
  confidence: string;
  reasoning: string;
  assumptions: string[];
  limitations: string;
}

export interface AnalyzeResponse {
  language: string;
  findings: Finding[];
  complexity: ComplexityEstimate;
  analysis_source: string;
}

export interface ExplainResponse {
  explanation: string;
  suggestions: string[];
}

export interface OptimizationResult {
  summary: string;
  language: string;
  optimized_code: string;
  changes: string[];
  rationale: string;
  expected_complexity: string;
  assumptions: string[];
  suggested_tests: string[];
  limitations: string;
}

export interface OptimizeResponse {
  result: OptimizationResult;
  warning: string;
}

export interface VersionResult {
  status: string;
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  time_seconds?: number;
  memory_kb?: number;
}

export interface CompareResponse {
  correctness_verified: boolean;
  original: VersionResult;
  candidate: VersionResult;
  outputs_match: boolean;
  time_delta_seconds?: number;
  memory_delta_kb?: number;
  verdict: 'improvement' | 'regression' | 'equivalent' | 'unverified' | 'failed';
  explanation: string;
  limitations: string[];
}

export interface BenchmarkDataPoint {
  input_label: string;
  time_seconds?: number;
  memory_kb?: number;
  status: string;
}

export interface BenchmarkResponse {
  results: BenchmarkDataPoint[];
  summary: string;
  limitations: string[];
}

export interface ComponentScore {
  score?: number;
  label: string;
  explanation: string;
  weight: number;
}

export interface GreenScoreResponse {
  overall_score?: number;
  components: Record<string, ComponentScore>;
  available_metrics: string[];
  findings: string[];
  score_explanation: string;
  confidence: string;
  limitations: string[];
}

export interface HealthResponse {
  status: string;
  version: string;
  env: string;
  features: {
    execution: boolean;
    ai: boolean;
  };
}

export interface ApiError {
  error: string;
  detail?: string;
  request_id?: string;
}
