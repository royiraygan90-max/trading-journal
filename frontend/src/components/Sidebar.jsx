import React from 'react'
import {
  LayoutDashboard, List, CalendarDays, BarChart2,
  Tag, Settings, Wallet, Briefcase, FlaskConical,
  Upload, Sliders, X, TrendingUp, GraduationCap,
} from 'lucide-react'

const NAV = [
  { id: 'dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { id: 'trades',     label: 'Trades',     icon: List },
  { id: 'calendar',   label: 'Calendar',   icon: CalendarDays },
  { id: 'analytics',  label: 'Analytics',  icon: BarChart2 },
  { id: 'tags',       label: 'Tags',       icon: Tag },
  { id: 'accounts',   label: 'Accounts',   icon: Wallet },
  { id: 'business',   label: 'Business',   icon: Briefcase },
  { id: 'strategies', label: 'Strategies', icon: FlaskConical },
  { id: 'learning',   label: 'Learning',   icon: GraduationCap },
]

export default function Sidebar({
  collapsed, activeView, onSetView,
  mobileOpen, onCloseMobile,
  onImport, onCustomize,
}) {
  function selectView(id) {
    onSetView(id)
    onCloseMobile?.()
  }

  return (
    <>
      {mobileOpen && <div className="sidebar-backdrop" onClick={onCloseMobile} />}

      <aside className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
        <div className="sidebar-mobile-header">
          <div className="drawer-title">
            <TrendingUp size={16} style={{ verticalAlign: 'middle', marginRight: 8, color: 'var(--accent)' }} />
            Trading Journal
          </div>
          <button className="btn-icon" onClick={onCloseMobile}>
            <X size={16} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`sidebar-item${activeView === id ? ' active' : ''}`}
              onClick={() => selectView(id)}
              title={collapsed ? label : undefined}
            >
              <Icon size={16} />
              <span className="sidebar-label">{label}</span>
            </button>
          ))}

          {/* Mobile-only quick actions — desktop uses the header icons instead */}
          <div className="sidebar-mobile-actions">
            <div className="sidebar-mobile-sep" />
            <button className="sidebar-item" onClick={() => { onImport?.(); onCloseMobile?.() }}>
              <Upload size={16} />
              <span className="sidebar-label">Import CSV</span>
            </button>
            <button className="sidebar-item" onClick={() => { onCustomize?.(); onCloseMobile?.() }}>
              <Sliders size={16} />
              <span className="sidebar-label">Customize Dashboard</span>
            </button>
          </div>
        </nav>

        <div className="sidebar-bottom">
          <button
            className={`sidebar-item${activeView === 'settings' ? ' active' : ''}`}
            onClick={() => selectView('settings')}
            title={collapsed ? 'Settings' : undefined}
          >
            <Settings size={16} />
            <span className="sidebar-label">Settings</span>
          </button>
        </div>
      </aside>
    </>
  )
}
