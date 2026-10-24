import axios from 'axios';
import type {
  Language,
  ExecuteResponse,
  AnalyzeResponse,
  ExplainResponse,
  OptimizeResponse,
  CompareResponse,
  BenchmarkResponse,
  GreenScoreResponse,
  HealthResponse,
} from '@/types/api';

const BASE = '/api/v1';

const http = axios.create({
  baseURL: BASE,
  timeout: 60_000,
  headers: { 'Content-Type': 'application/json' },
});

// Normalize errors from Axios
function handleError(e: unknown): never {
  if (axios.isAxiosError(e)) {
    const detail =
      e.response?.data?.detail ||
      e.response?.data?.error ||
      e.message ||
      'Unknown error';
    throw new Error(detail);
  }
  throw e;
}

export const api = {
  health: async (): Promise<HealthResponse> => {
    try {
      const { data } = await http.get('/health');
      return data;
    } catch (e) {
      return handleError(e);
    }
  },

  languages: async (): Promise<Language[]> => {
    try {
      const { data } = await http.get('/languages');
      return data.languages;
    } catch (e) {
      return handleError(e);
    }
  },

  execute: async (payload: {
    language: string;
    source_code: string;
    stdin?: string;
  }): Promise<ExecuteResponse> => {
    try {
      const { data } = await http.post('/execute', payload);
      return data;
    } catch (e) {
      return handleError(e);
    }
  },

  analyze: async (payload: {
    language: string;
    source_code: string;
  }): Promise<AnalyzeResponse> => {
    try {
      const { data } = await http.post('/analyze', payload);
      return data;
    } catch (e) {
      return handleError(e);
    }
  },

  explain: async (payload: {
    language: string;
    source_code: string;
    context?: string;
    explain_type?: string;
  }): Promise<ExplainResponse> => {
    try {
      const { data } = await http.post('/ai/explain', payload);
      return data;
    } catch (e) {
      return handleError(e);
    }
  },

  optimize: async (payload: {
    language: string;
    source_code: string;
    context?: string;
  }): Promise<OptimizeResponse> => {
    try {
      const { data } = await http.post('/ai/optimize', payload);
      return data;
    } catch (e) {
      return handleError(e);
    }
  },

  compare: async (payload: {
    language: string;
    original_code: string;
    candidate_code: string;
    test_inputs?: string[];
  }): Promise<CompareResponse> => {
    try {
      const { data } = await http.post('/compare', payload);
      return data;
    } catch (e) {
      return handleError(e);
    }
  },

  benchmark: async (payload: {
    language: string;
    source_code: string;
    inputs: string[];
    repetitions?: number;
  }): Promise<BenchmarkResponse> => {
    try {
      const { data } = await http.post('/benchmark', payload);
      return data;
    } catch (e) {
      return handleError(e);
    }
  },

  greenScore: async (payload: {
    language: string;
    source_code: string;
    execute_result?: ExecuteResponse;
    analyze_result?: AnalyzeResponse;
  }): Promise<GreenScoreResponse> => {
    try {
      const { data } = await http.post('/green-score', payload);
      return data;
    } catch (e) {
      return handleError(e);
    }
  },
};
