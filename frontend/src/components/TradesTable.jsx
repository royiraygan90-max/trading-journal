import React from 'react'
import { Edit2, Trash2, ChevronUp, ChevronDown, ListX } from 'lucide-react'
import { fmt, parseTags } from '../utils.jsx'

const COLUMNS = [
  { key: 'datetime',   label: 'Date / Time',  sortable: true },
  { key: 'symbol',     label: 'Symbol',       sortable: true },
  { key: 'account',    label: 'Account',      sortable: false },
  { key: 'direction',  label: 'Dir',          sortable: true },
  { key: 'entry',      label: 'Entry',        sortable: true },
  { key: 'exit',       label: 'Exit',         sortable: true },
  { key: 'quantity',   label: 'Qty',          sortable: true },
  { key: 'ticks',      label: 'Points',       sortable: true },
  { key: 'r_multiple', label: 'R',            sortable: true },
  { key: 'pnl',        label: 'P&L',          sortable: true },
  { key: 'tags',       label: 'Tags',         sortable: false },
  { key: 'actions',    label: '',             sortable: false },
]

function SortIcon({ col, sort }) {
  if (col !== sort.key) return (
    <span className="sort-icon">
      <ChevronUp  size={9} />
      <ChevronDown size={9} />
    </span>
  )
  return sort.dir === 'asc'
    ? <span className="sort-icon active"><ChevronUp size={10} /></span>
    : <span className="sort-icon active"><ChevronDown size={10} /></span>
}

export default function TradesTable({
  trades, allTags, instruments, accounts,
  selectedTrade, onSelectTrade,
  onEditTrade, onDeleteTrade,
  sort, setSort,
}) {
  function handleSort(key) {
    setSort(prev => ({
      key,
      dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc',
    }))
  }

  function getTagMeta(tagId) {
    return allTags.find(t => t.id === tagId)
  }

  function getAccountMeta(accountId) {
    return accounts?.find(a => a.id === accountId)
  }

  function confirmDelete(e, trade) {
    e.stopPropagation()
    if (window.confirm(`Delete trade ${trade.symbol} ${fmt.datetime(trade.datetime)}?`)) {
      onDeleteTrade(trade.id)
    }
  }

  return (
    <div className="trades-section">
      <div className="trades-section-header">
        <div className="trades-section-title">
          Trades
          <span className="trade-count-badge">{trades.length}</span>
        </div>
      </div>

      <div className="table-wrap">
        <table className="trades-table">
          <thead>
            <tr>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  className={`${col.sortable ? 'th-sortable' : ''}${col.sortable && sort.key === col.key ? ' sorted' : ''}`}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  {col.label}
                  {col.sortable && <SortIcon col={col.key} sort={sort} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length}>
                  <div className="empty-state">
                    <ListX size={32} />
                    <p>No trades found. Add your first trade or adjust your filters.</p>
                  </div>
                </td>
              </tr>
            )}
            {trades.map(trade => {
              const tags    = parseTags(trade.tags)
              const isWin   = trade.pnl > 0
              const isLoss  = trade.pnl < 0
              const isLong  = trade.direction === 'Long'
              const selected = selectedTrade?.id === trade.id

              return (
                <tr
                  key={trade.id}
                  className={selected ? 'selected' : ''}
                  onClick={() => onSelectTrade(selected ? null : trade)}
                >
                  <td className="td-date">{fmt.datetime(trade.datetime)}</td>
                  <td className="td-symbol">{trade.symbol}</td>
                  <td>
                    {(() => {
                      const acc = getAccountMeta(trade.account_id)
                      if (!acc) return <span style={{ color: 'var(--text-2)' }}>—</span>
                      return (
                        <span
                          className="tag-pill"
                          style={{
                            background: acc.color + '22',
                            color: acc.color,
                            border: `1px solid ${acc.color}44`,
                          }}
                        >
                          {acc.name}
                        </span>
                      )
                    })()}
                  </td>
                  <td>
                    <span className={`dir-badge ${isLong ? 'long' : 'short'}`}>
                      {trade.direction}
                    </span>
                  </td>
                  <td className="td-mono">{fmt.num(trade.entry, 2)}</td>
                  <td className="td-mono">{fmt.num(trade.exit, 2)}</td>
                  <td className="td-mono">{trade.quantity}</td>
                  <td className={`td-mono ${isWin ? 'positive' : isLoss ? 'negative' : ''}`}>
                    {trade.ticks != null ? fmt.points(trade.ticks * 0.25) : '—'}
                  </td>
                  <td className={`td-mono ${isWin ? 'positive' : isLoss ? 'negative' : ''}`}>
                    {trade.r_multiple != null ? fmt.r(trade.r_multiple) : '—'}
                  </td>
                  <td className={`pnl-cell ${isWin ? 'positive' : isLoss ? 'negative' : ''}`}>
                    {fmt.pnl(trade.pnl)}
                  </td>
                  <td>
                    <div className="tags-cell">
                      {tags.map(tagId => {
                        const meta = getTagMeta(tagId)
                        if (!meta) return null
                        return (
                          <span
                            key={tagId}
                            className="tag-pill"
                            style={{
                              background: meta.color + '22',
                              color: meta.color,
                              border: `1px solid ${meta.color}44`,
                            }}
                          >
                            {meta.label}
                          </span>
                        )
                      })}
                    </div>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="row-action-btn"
                        title="Edit"
                        onClick={e => { e.stopPropagation(); onEditTrade(trade) }}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        className="row-action-btn danger"
                        title="Delete"
                        onClick={e => confirmDelete(e, trade)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
