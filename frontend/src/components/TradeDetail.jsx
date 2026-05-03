import React from 'react'
import { Edit2, Trash2, X } from 'lucide-react'
import { fmt, parseTags } from '../utils.jsx'

function Field({ label, value, className = '' }) {
  return (
    <div className="detail-field">
      <div className="detail-field-label">{label}</div>
      <div className={`detail-field-value ${className}`}>{value}</div>
    </div>
  )
}

export default function TradeDetail({ trade, allTags, instruments, onEdit, onDelete, onClose }) {
  const tags   = parseTags(trade.tags)
  const isWin  = trade.pnl > 0
  const isLoss = trade.pnl < 0
  const pnlCls = isWin ? 'positive' : isLoss ? 'negative' : ''
  const inst   = instruments.find(i => i.symbol === trade.symbol)

  function confirmDelete() {
    if (window.confirm(`Delete this ${trade.symbol} trade?`)) onDelete()
  }

  return (
    <div className="trade-detail">
      <div className="trade-detail-header">
        <div className="trade-detail-title">
          <span
            className={`dir-badge ${trade.direction === 'Long' ? 'long' : 'short'}`}
            style={{ fontSize: '0.72rem' }}
          >
            {trade.direction}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{trade.symbol}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-1)' }}>
            {fmt.datetime(trade.datetime)}
          </span>
          {inst && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{inst.name}</span>
          )}
        </div>
        <div className="trade-detail-actions">
          <button className="btn btn-sm btn-secondary" onClick={onEdit}>
            <Edit2 size={12} /> Edit
          </button>
          <button className="btn btn-sm btn-danger" onClick={confirmDelete}>
            <Trash2 size={12} /> Delete
          </button>
          <button className="btn-icon" style={{ width: 28, height: 28 }} onClick={onClose}>
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="detail-grid">
        <Field label="Entry"      value={fmt.num(trade.entry, 2)} />
        <Field label="Exit"       value={fmt.num(trade.exit, 2)} />
        <Field label="Quantity"   value={trade.quantity} />
        <Field label="Commission" value={fmt.currency(trade.commission || 0)} />
        <Field
          label="P&L (net)"
          value={fmt.pnl(trade.pnl)}
          className={pnlCls}
        />
        <Field
          label="Ticks"
          value={trade.ticks != null ? fmt.ticks(trade.ticks) : '—'}
          className={pnlCls}
        />
        <Field
          label="R-Multiple"
          value={trade.r_multiple != null ? fmt.r(trade.r_multiple) : '—'}
          className={pnlCls}
        />
        <Field label="Symbol" value={trade.symbol} />
      </div>

      {tags.length > 0 && (
        <div className="detail-tags-row">
          <span style={{ fontSize: '0.72rem', color: 'var(--text-2)', marginRight: 4 }}>Tags:</span>
          {tags.map(tagId => {
            const meta = allTags.find(t => t.id === tagId)
            if (!meta) return null
            return (
              <span
                key={tagId}
                className="tag-pill"
                style={{
                  background: meta.color + '22',
                  color: meta.color,
                  border: `1px solid ${meta.color}44`,
                  padding: '3px 10px',
                  fontSize: '0.75rem',
                }}
              >
                {meta.label}
              </span>
            )
          })}
        </div>
      )}

      {trade.notes && (
        <div className="detail-notes">
          <div className="detail-notes-label">Notes</div>
          <div className="detail-notes-text">{trade.notes}</div>
        </div>
      )}
    </div>
  )
}
