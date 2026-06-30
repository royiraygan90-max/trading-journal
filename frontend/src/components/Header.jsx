import React from 'react'
import { TrendingUp, Plus, Sliders, X, Pencil, Check, Upload } from 'lucide-react'

const DIRECTIONS = ['Long', 'Short']
const OUTCOMES   = [
  { value: 'win',  label: 'Win' },
  { value: 'loss', label: 'Loss' },
  { value: 'be',   label: 'Break-Even' },
]

export default function Header({
  filters, setFilters,
  instruments,
  accounts, selectedAccountId, onSelectAccount,
  sidebarCollapsed, onToggleSidebar,
  onAddTrade, onImport, onCustomize,
  isEditMode, onEditLayout, onSaveLayout, onCancelLayout,
}) {
  const hasFilters = filters.dateFrom || filters.dateTo || filters.symbol
    || filters.direction || filters.outcome || filters.tags?.length
    || (selectedAccountId && selectedAccountId !== 'all')

  function set(key, val) {
    setFilters(prev => ({ ...prev, [key]: val }))
  }

  function clearFilters() {
    setFilters({ dateFrom: '', dateTo: '', symbol: '', direction: '', outcome: '', tags: [] })
    onSelectAccount('all')
  }

  return (
    <header className="header">
      {/* Logo / sidebar toggle */}
      <button
        className={`header-logo-btn${sidebarCollapsed ? ' collapsed' : ''}`}
        onClick={onToggleSidebar}
        title="Toggle sidebar"
      >
        <div className="logo-icon">
          <TrendingUp size={16} />
        </div>
        {!sidebarCollapsed && <span className="logo-text">Trading Journal</span>}
      </button>

      {/* Account switcher */}
      {accounts && accounts.length > 0 && (
        <div className="account-switcher">
          <select
            className="header-input account-select"
            value={selectedAccountId}
            onChange={e => onSelectAccount(e.target.value)}
          >
            <option value="all">All Accounts</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Filters */}
      <div className="header-filters">
        <span className="filter-label">From</span>
        <input
          type="date"
          className="header-input date"
          value={filters.dateFrom}
          onChange={e => set('dateFrom', e.target.value)}
        />
        <span className="filter-label">To</span>
        <input
          type="date"
          className="header-input date"
          value={filters.dateTo}
          onChange={e => set('dateTo', e.target.value)}
        />

        <div className="header-sep" />

        <select
          className="header-input symbol"
          value={filters.symbol}
          onChange={e => set('symbol', e.target.value)}
        >
          <option value="">All Symbols</option>
          {instruments.map(i => (
            <option key={i.symbol} value={i.symbol}>{i.symbol}</option>
          ))}
        </select>

        <select
          className="header-input symbol"
          value={filters.direction}
          onChange={e => set('direction', e.target.value)}
        >
          <option value="">All Directions</option>
          {DIRECTIONS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        <select
          className="header-input symbol"
          value={filters.outcome}
          onChange={e => set('outcome', e.target.value)}
        >
          <option value="">All Outcomes</option>
          {OUTCOMES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {hasFilters && (
          <button className="btn-clear-filters" onClick={clearFilters} title="Clear filters">
            <X size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            Clear
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="header-actions">
        {isEditMode ? (
          <>
            <button className="btn-save-layout" onClick={onSaveLayout}>
              <Check size={13} />
              Save Layout
            </button>
            <button className="btn-cancel-layout" onClick={onCancelLayout}>
              <X size={13} />
              Cancel
            </button>
          </>
        ) : (
          <button className="btn-edit-layout" onClick={onEditLayout} title="Edit dashboard layout">
            <Pencil size={13} />
            Edit Layout
          </button>
        )}
        <button className="btn-icon" onClick={onImport} title="Import from Tradovate CSV">
          <Upload size={14} />
        </button>
        <button className="btn-icon" onClick={onCustomize} title="Customize dashboard">
          <Sliders size={14} />
        </button>
        <button className="btn-add-trade" onClick={onAddTrade}>
          <Plus size={14} />
          Add Trade
        </button>
      </div>
    </header>
  )
}
