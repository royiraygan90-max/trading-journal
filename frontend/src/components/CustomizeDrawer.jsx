import React, { useState } from 'react'
import {
  X, BarChart2, PieChart, Flame, CheckSquare, CalendarDays,
  TrendingUp, GripVertical,
} from 'lucide-react'

const WIDGET_DEFS = {
  equity_curve: { label: 'Equity Curve',       icon: TrendingUp   },
  daily_pnl:    { label: 'Daily P&L Chart',    icon: BarChart2    },
  win_rate:     { label: 'Win Rate',            icon: PieChart     },
  streak:       { label: 'Streaks',             icon: Flame        },
  checklist:    { label: 'Pre-Trade Checklist', icon: CheckSquare  },
  calendar:     { label: 'Trade Calendar',      icon: CalendarDays },
}

function Toggle({ on, onClick }) {
  return (
    <div className={`toggle${on ? ' on' : ''}`} onClick={onClick}>
      <div className="toggle-thumb" />
    </div>
  )
}

export default function CustomizeDrawer({
  visibleWidgets, widgetOrder, onToggleWidget, onReorder, onClose,
}) {
  const [dragIdx,    setDragIdx]    = useState(null)
  const [dropTarget, setDropTarget] = useState(null)

  function handleDragStart(e, idx) {
    setDragIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))
  }

  function handleDragOver(e, idx) {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const next = e.clientY < rect.top + rect.height / 2 ? idx : idx + 1
    if (next !== dropTarget) setDropTarget(next)
  }

  function handleDrop(e) {
    e.preventDefault()
    if (dragIdx === null || dropTarget === null) { reset(); return }
    if (dropTarget === dragIdx || dropTarget === dragIdx + 1) { reset(); return }
    const newOrder = [...widgetOrder]
    const [item] = newOrder.splice(dragIdx, 1)
    const insertAt = dropTarget > dragIdx ? dropTarget - 1 : dropTarget
    newOrder.splice(insertAt, 0, item)
    onReorder(newOrder)
    reset()
  }

  function reset() {
    setDragIdx(null)
    setDropTarget(null)
  }

  const showIndicator = (pos) =>
    dragIdx !== null &&
    dropTarget === pos &&
    pos !== dragIdx &&
    pos !== dragIdx + 1

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
          <div className="section-label">Widgets — drag to reorder</div>

          <div
            className="widget-dnd-list"
            onDragOver={e => { e.preventDefault(); setDropTarget(widgetOrder.length) }}
            onDrop={handleDrop}
            onDragLeave={e => {
              if (!e.currentTarget.contains(e.relatedTarget)) reset()
            }}
          >
            {widgetOrder.map((id, idx) => {
              const def = WIDGET_DEFS[id]
              if (!def) return null
              const { label, icon: Icon } = def

              return (
                <React.Fragment key={id}>
                  {showIndicator(idx) && <div className="drop-indicator" />}

                  <div
                    className={`widget-toggle-item${dragIdx === idx ? ' dragging' : ''}`}
                    draggable
                    onDragStart={e => handleDragStart(e, idx)}
                    onDragOver={e => handleDragOver(e, idx)}
                    onDrop={e => { e.stopPropagation(); handleDrop(e) }}
                    onDragEnd={reset}
                  >
                    <span className="widget-drag-handle">
                      <GripVertical size={14} />
                    </span>
                    <div className="widget-toggle-label">
                      <Icon size={15} />
                      {label}
                    </div>
                    <Toggle
                      on={visibleWidgets.includes(id)}
                      onClick={() => onToggleWidget(id)}
                    />
                  </div>
                </React.Fragment>
              )
            })}

            {showIndicator(widgetOrder.length) && <div className="drop-indicator" />}
          </div>
        </div>
      </div>
    </>
  )
}
