import React from 'react'
import { Settings, TrendingUp, BarChart2, PieChart, Flame, CheckSquare, CalendarDays } from 'lucide-react'

const WIDGET_LIST = [
  { id: 'equity_curve', label: 'Equity Curve',       icon: TrendingUp  },
  { id: 'daily_pnl',    label: 'Daily P&L Chart',    icon: BarChart2   },
  { id: 'win_rate',     label: 'Win Rate',            icon: PieChart    },
  { id: 'streak',       label: 'Streaks',             icon: Flame       },
  { id: 'checklist',    label: 'Pre-Trade Checklist', icon: CheckSquare },
  { id: 'calendar',     label: 'Trade Calendar',      icon: CalendarDays},
]

function Toggle({ on, onClick }) {
  return (
    <div className={`toggle${on ? ' on' : ''}`} onClick={onClick}>
      <div className="toggle-thumb" />
    </div>
  )
}

export default function SettingsPage({ visibleWidgets, onToggleWidget }) {
  return (
    <div className="page-section">
      <div className="page-header">
        <Settings size={16} />
        <span className="page-title">Settings</span>
      </div>

      <div className="card" style={{ maxWidth: 480 }}>
        <div className="card-header">
          <div className="card-title">Dashboard Widgets</div>
        </div>
        <div style={{ padding: '8px 16px 16px' }}>
          {WIDGET_LIST.map(({ id, label, icon: Icon }) => (
            <div key={id} className="widget-toggle-item">
              <div className="widget-toggle-label">
                <Icon size={15} />
                {label}
              </div>
              <Toggle
                on={visibleWidgets.includes(id)}
                onClick={() => onToggleWidget(id)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
