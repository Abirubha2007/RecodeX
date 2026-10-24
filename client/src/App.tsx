import '@/styles/index.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { LandingPage } from '@/pages/LandingPage';
import { PlaygroundPage } from '@/pages/PlaygroundPage';
import { AnalysisPage } from '@/pages/AnalysisPage';
import { GreenDiffPage } from '@/pages/GreenDiffPage';
import { BenchmarkPage } from '@/pages/BenchmarkPage';
import { SettingsPage } from '@/pages/SettingsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route element={<AppShell />}>
          <Route path="/playground" element={<PlaygroundPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/green-diff" element={<GreenDiffPage />} />
          <Route path="/benchmark" element={<BenchmarkPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/playground" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
