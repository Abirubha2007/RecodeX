import { NavLink, Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  Code2, BarChart2, GitCompare, Gauge, Settings,
  ChevronLeft, ChevronRight, Zap, ShieldCheck
} from 'lucide-react';
import { api } from '@/services/api';
import type { HealthResponse } from '@/types/api';

const NAV_ITEMS = [
  { to: '/playground', icon: Code2,       label: 'Playground' },
  { to: '/analysis',   icon: BarChart2,   label: 'Code Analysis' },
  { to: '/green-diff', icon: ShieldCheck, label: 'Proof Report' },
  { to: '/benchmark',  icon: Gauge,       label: 'Benchmark' },
];

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    api.health()
      .then(setHealth)
      .catch(() => {/* backend may not be running in dev */});
  }, []);

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <nav className={`app-sidebar${collapsed ? ' collapsed' : ''}`} role="navigation" aria-label="Main navigation">
        <div className="sidebar-logo">
          <div className="logo-icon">
            <Zap size={18} strokeWidth={2.5} />
          </div>
          {!collapsed && (
            <span className="logo-text">Re<span>Code</span>X</span>
          )}
        </div>

        <div className="sidebar-nav">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `nav-item${isActive ? ' active' : ''}`
              }
              title={collapsed ? label : undefined}
            >
              <Icon className="nav-icon" size={18} />
              {!collapsed && <span className="nav-label">{label}</span>}
            </NavLink>
          ))}
        </div>

        <div className="sidebar-footer">
          {/* Status indicator */}
          {!collapsed && health && (
            <div className="flex items-center gap-2 text-xs text-muted mb-3" style={{ padding: '4px 10px' }}>
              <span
                className={`status-dot ${health.features.execution ? 'success' : 'error'}`}
                title={health.features.execution ? 'Execution ready' : 'Execution not configured'}
              />
              <span>Execution</span>
              <span
                className={`status-dot ${health.features.ai ? 'success' : 'error'}`}
                title={health.features.ai ? 'AI ready' : 'AI not configured'}
                style={{ marginLeft: 8 }}
              />
              <span>AI</span>
            </div>
          )}

          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            title={collapsed ? 'Settings' : undefined}
          >
            <Settings className="nav-icon" size={18} />
            {!collapsed && <span className="nav-label">Settings</span>}
          </NavLink>

          <button
            className="nav-item btn-ghost"
            style={{ width: '100%', marginTop: 4 }}
            onClick={() => setCollapsed(c => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed
              ? <ChevronRight className="nav-icon" size={18} />
              : <><ChevronLeft className="nav-icon" size={18} /><span className="nav-label">Collapse</span></>
            }
          </button>
        </div>
      </nav>

      {/* Main */}
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
