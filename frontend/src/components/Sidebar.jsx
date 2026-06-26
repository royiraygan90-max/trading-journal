import React from 'react'
import {
  LayoutDashboard, List, CalendarDays, BarChart2,
  Tag, Settings, Wallet, Briefcase,
} from 'lucide-react'

const NAV = [
  { id: 'dashboard', label: 'Dashboard',  icon: LayoutDashboard },
  { id: 'trades',    label: 'Trades',     icon: List },
  { id: 'calendar',  label: 'Calendar',   icon: CalendarDays },
  { id: 'analytics', label: 'Analytics',  icon: BarChart2 },
  { id: 'tags',      label: 'Tags',       icon: Tag },
  { id: 'accounts',  label: 'Accounts',   icon: Wallet },
  { id: 'business',  label: 'Business',   icon: Briefcase },
]

export default function Sidebar({ collapsed, activeView, onSetView }) {
  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <nav className="sidebar-nav">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`sidebar-item${activeView === id ? ' active' : ''}`}
            onClick={() => onSetView(id)}
            title={collapsed ? label : undefined}
          >
            <Icon size={16} />
            <span className="sidebar-label">{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <button
          className={`sidebar-item${activeView === 'settings' ? ' active' : ''}`}
          onClick={() => onSetView('settings')}
          title={collapsed ? 'Settings' : undefined}
        >
          <Settings size={16} />
          <span className="sidebar-label">Settings</span>
        </button>
      </div>
    </aside>
  )
}
