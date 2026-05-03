import React from 'react'
import { X, BarChart2, PieChart, Flame, CheckSquare, CalendarDays, TrendingUp } from 'lucide-react'

const ALL_WIDGETS = [
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

export default function CustomizeDrawer({ visibleWidgets, onToggleWidget, onClose }) {
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="customize-drawer">
        <div className="drawer-header">
          <span className="drawer-title">Customize Dashboard</span>
          <button className="btn-icon" style={{ width: 28, height: 28 }} onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className="drawer-body">
          <div className="section-label">Widgets</div>
          {ALL_WIDGETS.map(({ id, label, icon: Icon }) => (
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
    </>
  )
}
