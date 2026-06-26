import React, { useState, useMemo } from 'react'
import { Responsive, WidthProvider } from 'react-grid-layout/legacy'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from 'recharts'
import {
  BarChart2, PieChart as PieIcon, CheckSquare, CalendarDays,
  Flame, ChevronLeft, ChevronRight, Check, Trash2, GripVertical, RotateCcw,
} from 'lucide-react'
import { buildDailyPnl, buildCalendarData, buildEquityData, fmt } from '../utils.jsx'
import EquityChart from './EquityChart.jsx'

const ResponsiveGridLayout = WidthProvider(Responsive)

// ── Daily P&L chart ──────────────────────────────────────────────────────────
function DailyPnlWidget({ trades }) {
  const data = useMemo(() => buildDailyPnl(trades), [trades])

  return (
    <div className="card daily-pnl-widget">
      <div className="card-header">
        <div className="card-title"><BarChart2 size={14} />Daily P&L</div>
      </div>
      <div className="card-body" style={{ padding: '12px 8px 8px' }}>
        {data.length === 0 ? (
          <div className="empty-state" style={{ height: 140 }}><p>No data</p></div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--text-2)', fontSize: 10 }}
                axisLine={false} tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: 'var(--text-2)', fontSize: 10 }}
                axisLine={false} tickLine={false} width={50}
                tickFormatter={v => `$${Math.abs(v) >= 1000 ? (v/1000).toFixed(1)+'k' : v}`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const { date, pnl } = payload[0]?.payload || {}
                  return (
                    <div className="custom-tooltip">
                      <div style={{ color: 'var(--text-1)', fontSize: '0.72rem', marginBottom: 3 }}>{date}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {fmt.pnl(pnl)}
                      </div>
                    </div>
                  )
                }}
              />
              <Bar dataKey="pnl" radius={[3, 3, 0, 0]} maxBarSize={28}>
                {data.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.pnl >= 0 ? 'var(--green)' : 'var(--red)'}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

// ── Win rate donut ───────────────────────────────────────────────────────────
function WinRateWidget({ trades }) {
  const wins  = trades.filter(t => t.pnl > 0).length
  const loss  = trades.filter(t => t.pnl < 0).length
  const be    = trades.length - wins - loss
  const rate  = trades.length ? ((wins / trades.length) * 100).toFixed(1) : 0

  const pieData = [
    { name: 'Win',  value: wins || 0, color: 'var(--green)' },
    { name: 'Loss', value: loss || 0, color: 'var(--red)' },
    ...(be > 0 ? [{ name: 'B/E', value: be, color: 'var(--text-2)' }] : []),
  ].filter(d => d.value > 0)

  return (
    <div className="card win-rate-widget">
      <div className="card-header">
        <div className="card-title"><PieIcon size={14} />Win Rate</div>
      </div>
      {trades.length === 0 ? (
        <div className="empty-state" style={{ height: 160 }}><p>No data</p></div>
      ) : (
        <>
          <div style={{ position: 'relative', height: 160 }}>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={72}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                  stroke="none"
                >
                  {pieData.map((d, i) => (
                    <Cell key={i} fill={d.color} fillOpacity={0.9} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="win-rate-center" style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)', pointerEvents: 'none',
            }}>
              <span className="win-rate-pct">{rate}%</span>
              <span className="win-rate-label">Win Rate</span>
            </div>
          </div>
          <div className="win-rate-legend">
            {pieData.map(d => (
              <div key={d.name} className="legend-item">
                <div className="legend-dot" style={{ background: d.color }} />
                <span>{d.name} ({d.value})</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Streak widget ─────────────────────────────────────────────────────────────
function StreakWidget({ trades }) {
  const sorted = [...trades].sort((a, b) => new Date(a.datetime) - new Date(b.datetime))

  let curStreak = 0, curType = null
  let maxWin = 0, maxLoss = 0, tw = 0, tl = 0

  for (const t of sorted) {
    if (t.pnl > 0) { tw++; tl = 0; if (tw > maxWin)  maxWin  = tw }
    else if (t.pnl < 0) { tl++; tw = 0; if (tl > maxLoss) maxLoss = tl }
    else { tw = 0; tl = 0 }
  }
  if (sorted.length) {
    const last = sorted[sorted.length - 1]
    if (last.pnl > 0) {
      curType = 'win'
      for (let i = sorted.length - 1; i >= 0 && sorted[i].pnl > 0; i--) curStreak++
    } else if (last.pnl < 0) {
      curType = 'loss'
      for (let i = sorted.length - 1; i >= 0 && sorted[i].pnl < 0; i--) curStreak++
    }
  }

  return (
    <div className="card streak-widget">
      <div className="card-header">
        <div className="card-title"><Flame size={14} />Streaks</div>
      </div>
      <div className="streak-body">
        <div className="streak-item">
          <div className={`streak-number ${curType === 'win' ? 'win' : curType === 'loss' ? 'loss' : ''}`}>
            {curStreak || '—'}
          </div>
          <div className="streak-sub">Current</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-1)', marginTop: 2 }}>
            {curType === 'win' ? '🟢 Win' : curType === 'loss' ? '🔴 Loss' : '—'}
          </div>
        </div>
        <div className="streak-divider" />
        <div className="streak-item">
          <div className="streak-number win">{maxWin || '—'}</div>
          <div className="streak-sub">Best Win</div>
        </div>
        <div className="streak-divider" />
        <div className="streak-item">
          <div className="streak-number loss">{maxLoss || '—'}</div>
          <div className="streak-sub">Worst Loss</div>
        </div>
      </div>
    </div>
  )
}

// ── Checklist widget ──────────────────────────────────────────────────────────
function ChecklistWidget({ checklist, onAdd, onUpdate, onDelete, onReset }) {
  const [newText, setNewText] = useState('')

  function handleAdd() {
    const t = newText.trim()
    if (!t) return
    onAdd(t)
    setNewText('')
  }

  return (
    <div className="card checklist-widget">
      <div className="card-header">
        <div className="card-title"><CheckSquare size={14} />Pre-Trade Checklist</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="text-muted text-sm">
            {checklist.filter(i => i.done).length}/{checklist.length}
          </span>
          {checklist.some(i => i.done) && (
            <button
              className="checklist-reset-btn"
              title="Reset checklist"
              onClick={onReset}
            >
              <RotateCcw size={12} />
            </button>
          )}
        </div>
      </div>
      <div className="checklist-list">
        {checklist.map(item => (
          <div key={item.id} className="checklist-item">
            <button
              className={`checklist-checkbox${item.done ? ' checked' : ''}`}
              onClick={() => onUpdate(item.id, { ...item, done: item.done ? 0 : 1 })}
            >
              {item.done && <Check size={10} color="var(--green)" />}
            </button>
            <span className={`checklist-text${item.done ? ' done' : ''}`}>{item.text}</span>
            <button className="checklist-delete" onClick={() => onDelete(item.id)}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
      <div className="checklist-add">
        <input
          className="checklist-add-input"
          placeholder="Add checklist item…"
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <button className="checklist-add-btn" onClick={handleAdd}>+</button>
      </div>
    </div>
  )
}

// ── Calendar widget ───────────────────────────────────────────────────────────
function CalendarWidget({ trades }) {
  const today   = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const dailyMap = useMemo(() => buildCalendarData(trades), [trades])

  const firstDay  = new Date(year, month, 1).getDay()
  const daysCount = new Date(year, month + 1, 0).getDate()
  const cells     = Array.from({ length: firstDay + daysCount }, (_, i) =>
    i < firstDay ? null : i - firstDay + 1
  )

  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  })

  function prev() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function next() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  function pad(n) { return String(n).padStart(2, '0') }

  return (
    <div className="card calendar-widget">
      <div className="card-header">
        <div className="card-title"><CalendarDays size={14} />Trade Calendar</div>
        <div className="calendar-nav">
          <button className="calendar-nav-btn" onClick={prev}><ChevronLeft size={14} /></button>
          <span className="calendar-month">{monthLabel}</span>
          <button className="calendar-nav-btn" onClick={next}><ChevronRight size={14} /></button>
        </div>
      </div>
      <div className="calendar-grid-header">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className="cal-dow">{d}</div>
        ))}
      </div>
      <div className="calendar-grid">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const key  = `${year}-${pad(month + 1)}-${pad(day)}`
          const info = dailyMap[key]
          const cls  = info ? (info.pnl >= 0 ? 'win' : 'loss') : ''
          const isToday = (
            day === today.getDate() &&
            month === today.getMonth() &&
            year === today.getFullYear()
          )
          return (
            <div
              key={i}
              className={`cal-day${info ? ' has-trade' : ''}${cls ? ` ${cls}` : ''}${isToday ? ' today' : ''}`}
              title={info ? `${key}: ${fmt.pnl(info.pnl)} (${info.count} trades)` : undefined}
            >
              {day}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Equity Curve wrapper (computes its own data from trades) ─────────────────
function EquityCurveWidget({ trades }) {
  const data = useMemo(() => buildEquityData(trades), [trades])
  return <EquityChart data={data} />
}

// ── Widgets container ─────────────────────────────────────────────────────────
const WIDGET_META = {
  equity_curve: { label: 'Equity Curve',       component: EquityCurveWidget, fullWidth: true },
  daily_pnl:    { label: 'Daily P&L',          component: DailyPnlWidget },
  win_rate:     { label: 'Win Rate',            component: WinRateWidget },
  streak:       { label: 'Streaks',             component: StreakWidget },
  checklist:    { label: 'Pre-Trade Checklist', component: ChecklistWidget },
  calendar:     { label: 'Trade Calendar',      component: CalendarWidget },
}

export default function Widgets({
  visibleWidgets, widgetOrder,
  trades, checklist,
  onAddChecklistItem, onUpdateChecklistItem, onDeleteChecklistItem, onResetChecklist,
  layout, isEditMode, onLayoutChange,
}) {
  const visibleIds = visibleWidgets.filter(id => WIDGET_META[id])

  // ── Non-dashboard views: simple CSS grid (no react-grid-layout) ──────────
  if (!layout) {
    const order  = widgetOrder ?? visibleWidgets
    const active = order.filter(id => WIDGET_META[id] && visibleWidgets.includes(id))
    if (active.length === 0) return null
    return (
      <div className="widgets-grid">
        {active.map(id => {
          const { component: Component, fullWidth } = WIDGET_META[id]
          return (
            <div key={id} className={fullWidth ? 'widget-full-width' : undefined}>
              <Component
                trades={trades}
                checklist={checklist}
                onAdd={onAddChecklistItem}
                onUpdate={onUpdateChecklistItem}
                onDelete={onDeleteChecklistItem}
                onReset={onResetChecklist}
              />
            </div>
          )
        })}
      </div>
    )
  }

  // ── Dashboard: react-grid-layout ─────────────────────────────────────────
  if (visibleIds.length === 0) return null

  return (
    <div className={`dashboard-grid${isEditMode ? ' edit-mode' : ''}`}>
      <ResponsiveGridLayout
        layouts={{ lg: layout, md: layout, sm: layout, xs: layout }}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
        cols={{ lg: 12, md: 12, sm: 12, xs: 12 }}
        rowHeight={60}
        margin={[16, 16]}
        isDraggable={isEditMode}
        isResizable={isEditMode}
        draggableHandle=".widget-drag-handle"
        resizeHandles={['se']}
        onLayoutChange={onLayoutChange}
        useCSSTransforms
      >
        {visibleIds.map(id => {
          const { component: Component } = WIDGET_META[id]
          return (
            <div key={id}>
              {isEditMode && (
                <div className="widget-drag-handle">
                  <GripVertical size={13} />
                </div>
              )}
              <Component
                trades={trades}
                checklist={checklist}
                onAdd={onAddChecklistItem}
                onUpdate={onUpdateChecklistItem}
                onDelete={onDeleteChecklistItem}
                onReset={onResetChecklist}
              />
            </div>
          )
        })}
      </ResponsiveGridLayout>
    </div>
  )
}

export { WIDGET_META }
