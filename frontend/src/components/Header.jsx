import React, { useState } from 'react'
import { TrendingUp, Plus, Sliders, X, Pencil, Check, Upload, Menu, SlidersHorizontal } from 'lucide-react'

const DIRECTIONS = ['Long', 'Short']
const OUTCOMES   = [
  { value: 'win',  label: 'Win' },
  { value: 'loss', label: 'Loss' },
  { value: 'be',   label: 'Break-Even' },
]

const VIEW_LABELS = {
  dashboard: 'Dashboard', trades: 'Trades', calendar: 'Calendar',
  analytics: 'Analytics', tags: 'Tags', accounts: 'Accounts',
  business: 'Business', strategies: 'Strategies', settings: 'Settings',
}

export default function Header({
  filters, setFilters,
  instruments,
  accounts, selectedAccountId, onSelectAccount,
  sidebarCollapsed, onToggleSidebar,
  onAddTrade, onImport, onCustomize,
  isEditMode, onEditLayout, onSaveLayout, onCancelLayout,
  activeView, onToggleMobileNav,
}) {
  const [showMobileFilters, setShowMobileFilters] = useState(false)

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
      {/* Mobile hamburger — opens the off-canvas nav drawer */}
      <button className="header-hamburger" onClick={onToggleMobileNav} aria-label="Open menu">
        <Menu size={20} />
      </button>

      {/* Logo / sidebar toggle (desktop only) */}
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

      {/* Current page title (mobile only) */}
      <span className="header-mobile-title">{VIEW_LABELS[activeView] || 'Trading Journal'}</span>

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
        <button className="btn-icon header-desktop-only" onClick={onImport} title="Import from Tradovate CSV">
          <Upload size={14} />
        </button>
        <button className="btn-icon header-desktop-only" onClick={onCustomize} title="Customize dashboard">
          <Sliders size={14} />
        </button>

        {/* Mobile-only filter trigger — opens the filter bottom sheet */}
        <button
          className="btn-icon header-filter-btn"
          onClick={() => setShowMobileFilters(true)}
          aria-label="Filters"
        >
          <SlidersHorizontal size={14} />
          {hasFilters && <span className="filter-badge-dot" />}
        </button>

        <button className="btn-add-trade" onClick={onAddTrade}>
          <Plus size={14} />
          <span className="btn-add-trade-label">Add Trade</span>
        </button>
      </div>

      {/* Mobile filter sheet */}
      {showMobileFilters && (
        <>
          <div className="drawer-overlay" onClick={() => setShowMobileFilters(false)} />
          <div className="mobile-filter-sheet">
            <div className="drawer-header">
              <span className="drawer-title">Filters</span>
              <button className="btn-icon" onClick={() => setShowMobileFilters(false)}>
                <X size={14} />
              </button>
            </div>

            <div className="mobile-filter-body">
              {accounts && accounts.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Account</label>
                  <select
                    className="form-select"
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

              <div className="form-grid cols-2">
                <div className="form-group">
                  <label className="form-label">From</label>
                  <input
                    type="date"
                    className="form-input"
                    value={filters.dateFrom}
                    onChange={e => set('dateFrom', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">To</label>
                  <input
                    type="date"
                    className="form-input"
                    value={filters.dateTo}
                    onChange={e => set('dateTo', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Symbol</label>
                <select className="form-select" value={filters.symbol} onChange={e => set('symbol', e.target.value)}>
                  <option value="">All Symbols</option>
                  {instruments.map(i => (
                    <option key={i.symbol} value={i.symbol}>{i.symbol}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Direction</label>
                <select className="form-select" value={filters.direction} onChange={e => set('direction', e.target.value)}>
                  <option value="">All Directions</option>
                  {DIRECTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Outcome</label>
                <select className="form-select" value={filters.outcome} onChange={e => set('outcome', e.target.value)}>
                  <option value="">All Outcomes</option>
                  {OUTCOMES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            <div className="modal-footer">
              {hasFilters && (
                <button className="btn btn-secondary" onClick={clearFilters}>Clear Filters</button>
              )}
              <button className="btn btn-primary" onClick={() => setShowMobileFilters(false)}>Done</button>
            </div>
          </div>
        </>
      )}
    </header>
  )
}
