import React, { useState, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { TrendingUp } from 'lucide-react'
import { fmt, getDateRange, filterTrades, buildEquityData } from '../utils.jsx'

const PERIODS = ['1W', '1M', '3M', '6M', 'YTD', 'All']

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const { equity, pnl } = payload[0]?.payload || {}
  return (
    <div className="custom-tooltip">
      <div style={{ color: 'var(--text-1)', marginBottom: 4, fontSize: '0.72rem' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: equity >= 0 ? 'var(--green)' : 'var(--red)' }}>
        {fmt.currency(equity)}
      </div>
      <div style={{ fontSize: '0.72rem', color: pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
        {fmt.pnl(pnl)} this trade
      </div>
    </div>
  )
}

export default function EquityChart({ data }) {
  const [period, setPeriod] = useState('All')

  const filtered = useMemo(() => {
    if (period === 'All' || !data.length) return data
    const { dateFrom, dateTo } = getDateRange(period)
    return data.filter(d => d.date >= dateFrom && d.date <= dateTo)
  }, [data, period])

  const isPositive = filtered.length ? filtered[filtered.length - 1]?.equity >= 0 : true
  const color      = isPositive ? 'var(--green)' : 'var(--red)'
  const gradId     = isPositive ? 'equityGradPos'  : 'equityGradNeg'

  const tickFormatter = (v) => {
    if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`
    return `$${v}`
  }

  const xFormatter = (v) => {
    if (!v) return ''
    const d = new Date(v + 'T12:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const ticks = useMemo(() => {
    if (filtered.length <= 1) return filtered.map(d => d.date)
    const step = Math.max(1, Math.floor(filtered.length / 6))
    return filtered.filter((_, i) => i % step === 0).map(d => d.date)
  }, [filtered])

  return (
    <div className="equity-chart-card">
      <div className="equity-chart-header">
        <div className="card-title">
          <TrendingUp size={14} />
          Equity Curve
          {filtered.length > 0 && (
            <span style={{
              fontSize: '0.82rem', fontFamily: 'var(--font-mono)', fontWeight: 700,
              color,
            }}>
              {fmt.pnl(filtered[filtered.length - 1]?.equity)}
            </span>
          )}
        </div>
        <div className="equity-chart-tabs">
          {PERIODS.map(p => (
            <button
              key={p}
              className={`tab-btn${period === p ? ' active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="equity-chart-body">
        {filtered.length === 0 ? (
          <div className="empty-state" style={{ height: 220 }}>
            <TrendingUp size={32} />
            <p>No trades in this period</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={filtered} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="equityGradPos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--green)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--green)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="equityGradNeg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--red)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--red)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="date"
                ticks={ticks}
                tickFormatter={xFormatter}
                tick={{ fill: 'var(--text-2)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={tickFormatter}
                tick={{ fill: 'var(--text-2)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={60}
              />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="equity"
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradId})`}
                dot={false}
                activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
