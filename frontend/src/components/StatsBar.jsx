import React from 'react'
import { fmt } from '../utils.jsx'

function StatCard({ label, value, sub, className = '' }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${className}`}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export default function StatsBar({ stats }) {
  const {
    netPnl, totalTrades, winRate, winCount, lossCount,
    avgWin, avgLoss, profitFactor, maxDrawdown,
    currentStreak, currentStreakType,
  } = stats

  const pnlClass   = netPnl > 0 ? 'positive' : netPnl < 0 ? 'negative' : ''
  const streakLabel = currentStreakType === 'win'
    ? `${currentStreak}W streak`
    : currentStreakType === 'loss'
    ? `${currentStreak}L streak`
    : '—'

  return (
    <div className="stats-bar">
      <StatCard
        label="Net P&L"
        value={fmt.pnl(netPnl)}
        className={pnlClass}
        sub={totalTrades ? `${totalTrades} trades` : '—'}
      />
      <StatCard
        label="Win Rate"
        value={totalTrades ? fmt.pct(winRate) : '—'}
        sub={totalTrades ? `${winCount}W / ${lossCount}L` : ''}
      />
      <StatCard
        label="Profit Factor"
        value={profitFactor === Infinity ? '∞' : profitFactor ? fmt.num(profitFactor) : '—'}
        className={profitFactor >= 1.5 ? 'positive' : profitFactor > 0 && profitFactor < 1 ? 'negative' : ''}
      />
      <StatCard
        label="Avg Win"
        value={avgWin ? fmt.currency(avgWin) : '—'}
        className="positive"
      />
      <StatCard
        label="Avg Loss"
        value={avgLoss ? fmt.currency(avgLoss) : '—'}
        className="negative"
      />
      <StatCard
        label="Max Drawdown"
        value={maxDrawdown ? `−${fmt.currency(maxDrawdown)}` : '—'}
        className={maxDrawdown > 0 ? 'negative' : ''}
      />
      <StatCard
        label="Total Trades"
        value={totalTrades || '—'}
      />
      <StatCard
        label="Streak"
        value={streakLabel}
        className={currentStreakType === 'win' ? 'positive' : currentStreakType === 'loss' ? 'negative' : ''}
      />
    </div>
  )
}
