// ── Formatting ──────────────────────────────────────────────────────────────
export const fmt = {
  currency(v) {
    if (v == null) return '—'
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(v)
  },
  pnl(v) {
    if (v == null) return '—'
    const s = fmt.currency(Math.abs(v))
    return v >= 0 ? `+${s}` : `-${s}`
  },
  pct(v, decimals = 1) {
    if (v == null) return '—'
    return `${v.toFixed(decimals)}%`
  },
  num(v, decimals = 2) {
    if (v == null) return '—'
    return Number(v).toFixed(decimals)
  },
  date(dt) {
    if (!dt) return '—'
    const d = new Date(dt)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  },
  datetime(dt) {
    if (!dt) return '—'
    const d = new Date(dt)
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  },
  time(dt) {
    if (!dt) return '—'
    const d = new Date(dt)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  },
  ticks(v) {
    if (v == null) return '—'
    return v >= 0 ? `+${v}t` : `${v}t`
  },
  points(v) {
    if (v == null) return '—'
    return v >= 0 ? `+${Number(v).toFixed(2)}pts` : `${Number(v).toFixed(2)}pts`
  },
  r(v) {
    if (v == null) return '—'
    return v >= 0 ? `+${Number(v).toFixed(2)}R` : `${Number(v).toFixed(2)}R`
  },
}

// ── Parsing ──────────────────────────────────────────────────────────────────
export function parseTags(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try { return JSON.parse(raw) } catch { return [] }
}

// ── Stats calculation ────────────────────────────────────────────────────────
export function calculateStats(trades) {
  if (!trades || trades.length === 0) {
    return {
      netPnl: 0, totalTrades: 0, winRate: 0,
      avgWin: 0, avgLoss: 0, profitFactor: 0,
      maxDrawdown: 0, bestTrade: 0, worstTrade: 0,
      currentStreak: 0, currentStreakType: null,
      maxWinStreak: 0, maxLossStreak: 0,
      avgRMultiple: null, totalCommission: 0,
    }
  }

  const sorted  = [...trades].sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
  const wins    = sorted.filter(t => t.pnl > 0)
  const losses  = sorted.filter(t => t.pnl < 0)

  const netPnl        = sorted.reduce((s, t) => s + t.pnl, 0)
  const totalTrades   = sorted.length
  const winRate       = totalTrades ? (wins.length / totalTrades) * 100 : 0
  const avgWin        = wins.length    ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0
  const avgLoss       = losses.length  ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0
  const grossProfit   = wins.reduce((s, t) => s + t.pnl, 0)
  const grossLoss     = Math.abs(losses.reduce((s, t) => s + t.pnl, 0))
  const profitFactor  = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0
  const bestTrade     = wins.length   ? Math.max(...wins.map(t => t.pnl))   : 0
  const worstTrade    = losses.length ? Math.min(...losses.map(t => t.pnl)) : 0
  const totalCommission = sorted.reduce((s, t) => s + (t.commission || 0), 0)

  // Drawdown
  let peak = 0, equity = 0, maxDD = 0
  for (const t of sorted) {
    equity += t.pnl
    if (equity > peak) peak = equity
    const dd = peak - equity
    if (dd > maxDD) maxDD = dd
  }

  // Streaks
  let curStreak = 0, curStreakType = null
  let maxWin = 0, maxLoss = 0, tempWin = 0, tempLoss = 0
  for (const t of sorted) {
    if (t.pnl > 0) {
      tempWin++; tempLoss = 0
      if (tempWin > maxWin) maxWin = tempWin
    } else if (t.pnl < 0) {
      tempLoss++; tempWin = 0
      if (tempLoss > maxLoss) maxLoss = tempLoss
    } else {
      tempWin = 0; tempLoss = 0
    }
  }
  if (sorted.length) {
    const last = sorted[sorted.length - 1]
    if (last.pnl > 0) {
      curStreakType = 'win'
      for (let i = sorted.length - 1; i >= 0 && sorted[i].pnl > 0; i--) curStreak++
    } else if (last.pnl < 0) {
      curStreakType = 'loss'
      for (let i = sorted.length - 1; i >= 0 && sorted[i].pnl < 0; i--) curStreak++
    }
  }

  // Avg R
  const tradesWithR = sorted.filter(t => t.r_multiple != null)
  const avgRMultiple = tradesWithR.length
    ? tradesWithR.reduce((s, t) => s + t.r_multiple, 0) / tradesWithR.length
    : null

  return {
    netPnl, totalTrades, winRate,
    winCount: wins.length, lossCount: losses.length,
    breakEvenCount: totalTrades - wins.length - losses.length,
    avgWin, avgLoss, profitFactor,
    maxDrawdown: maxDD, bestTrade, worstTrade,
    currentStreak: curStreak, currentStreakType: curStreakType,
    maxWinStreak: maxWin, maxLossStreak: maxLoss,
    avgRMultiple, totalCommission,
  }
}

// ── Equity curve data ────────────────────────────────────────────────────────
export function buildEquityData(trades) {
  if (!trades || trades.length === 0) return []
  const sorted = [...trades].sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
  let equity = 0
  return sorted.map(t => {
    equity += t.pnl
    return {
      date:     t.datetime.slice(0, 10),
      equity:   Math.round(equity * 100) / 100,
      pnl:      t.pnl,
      symbol:   t.symbol,
    }
  })
}

// ── Daily P&L grouping ───────────────────────────────────────────────────────
export function buildDailyPnl(trades) {
  const map = {}
  for (const t of trades) {
    const day = t.datetime.slice(0, 10)
    map[day] = (map[day] || 0) + t.pnl
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, pnl]) => ({
      date,
      pnl: Math.round(pnl * 100) / 100,
      label: new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }))
}

// ── Calendar data ────────────────────────────────────────────────────────────
export function buildCalendarData(trades) {
  const map = {}
  for (const t of trades) {
    const day = t.datetime.slice(0, 10)
    if (!map[day]) map[day] = { pnl: 0, count: 0 }
    map[day].pnl   += t.pnl
    map[day].count += 1
  }
  return map
}

// ── Filters ──────────────────────────────────────────────────────────────────
export function filterTrades(trades, filters) {
  if (!trades) return []
  return trades.filter(t => {
    if (filters.dateFrom && t.datetime < filters.dateFrom) return false
    if (filters.dateTo   && t.datetime.slice(0, 10) > filters.dateTo) return false
    if (filters.symbol   && t.symbol !== filters.symbol) return false
    if (filters.direction && t.direction !== filters.direction) return false
    if (filters.outcome) {
      if (filters.outcome === 'win'  && t.pnl <= 0) return false
      if (filters.outcome === 'loss' && t.pnl >= 0) return false
      if (filters.outcome === 'be'   && t.pnl !== 0) return false
    }
    if (filters.tags && filters.tags.length > 0) {
      const tradeTags = parseTags(t.tags)
      if (!filters.tags.some(tag => tradeTags.includes(tag))) return false
    }
    if (filters.accountId && filters.accountId !== 'all' && t.account_id !== filters.accountId) return false
    return true
  })
}

// ── Date range presets ───────────────────────────────────────────────────────
export function getDateRange(period) {
  const now  = new Date()
  const to   = now.toISOString().slice(0, 10)
  let from   = new Date()

  switch (period) {
    case '1W':  from.setDate(now.getDate() - 7);   break
    case '1M':  from.setMonth(now.getMonth() - 1);  break
    case '3M':  from.setMonth(now.getMonth() - 3);  break
    case '6M':  from.setMonth(now.getMonth() - 6);  break
    case 'YTD': from = new Date(now.getFullYear(), 0, 1); break
    default:    return { dateFrom: '', dateTo: '' }
  }
  return { dateFrom: from.toISOString().slice(0, 10), dateTo: to }
}
