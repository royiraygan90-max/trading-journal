import React, { useState, useEffect, useMemo } from 'react'
import { X, Plus, Edit2 } from 'lucide-react'
import { parseTags, fmt } from '../utils.jsx'

const DEFAULT_FORM = {
  datetime:   '',
  symbol:     'ES',
  direction:  'Long',
  entry:      '',
  exit:       '',
  quantity:   1,
  commission: '',
  notes:      '',
  tags:       [],
  account_id: '',
}

export default function Modals({ mode, trade, instruments, allTags, accounts, selectedAccountId, onSave, onClose }) {
  const [form, setForm] = useState(DEFAULT_FORM)

  // Populate form when editing
  useEffect(() => {
    if (mode === 'edit' && trade) {
      setForm({
        datetime:   trade.datetime || '',
        symbol:     trade.symbol || 'ES',
        direction:  trade.direction || 'Long',
        entry:      trade.entry ?? '',
        exit:       trade.exit ?? '',
        quantity:   trade.quantity ?? 1,
        commission: trade.commission ?? '',
        notes:      trade.notes || '',
        tags:       parseTags(trade.tags),
        account_id: trade.account_id || '',
      })
    } else {
      const now = new Date()
      const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      const lastUsed = localStorage.getItem('last_used_account_id') || ''
      const defaultAcc = (selectedAccountId && selectedAccountId !== 'all')
        ? selectedAccountId
        : lastUsed
      setForm({ ...DEFAULT_FORM, datetime: local.toISOString().slice(0, 16), account_id: defaultAcc })
    }
  }, [mode, trade])

  function set(key, val) { setForm(prev => ({ ...prev, [key]: val })) }

  // Live P&L calculation
  const { pnl, ticks, r } = useMemo(() => {
    const entry = parseFloat(form.entry)
    const exit  = parseFloat(form.exit)
    const qty   = parseInt(form.quantity) || 1
    const comm  = parseFloat(form.commission) || 0
    if (isNaN(entry) || isNaN(exit)) return {}

    const inst       = instruments.find(i => i.symbol === form.symbol)
    const tickVal    = inst?.tick_value || 1
    const tickSize   = 0.25

    let rawTicks = (exit - entry) / tickSize
    if (form.direction === 'Short') rawTicks = -rawTicks

    const gross  = rawTicks * tickVal * qty
    const net    = gross - comm
    const r_mult = rawTicks / 8  // assume 8-tick default risk

    return {
      pnl:   Math.round(net * 100) / 100,
      ticks: Math.round(rawTicks * 100) / 100,
      r:     Math.round(r_mult * 100) / 100,
    }
  }, [form.entry, form.exit, form.quantity, form.commission, form.direction, form.symbol, instruments])

  function toggleTag(tagId) {
    set('tags', form.tags.includes(tagId)
      ? form.tags.filter(t => t !== tagId)
      : [...form.tags, tagId]
    )
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.datetime || !form.entry || !form.exit) {
      alert('Please fill in all required fields (Date/Time, Entry, Exit).')
      return
    }
    if (accounts && accounts.length === 0) {
      alert('Create an account first from the Accounts page.')
      return
    }
    if (!form.account_id) {
      alert('Please select an account.')
      return
    }
    localStorage.setItem('last_used_account_id', form.account_id)
    onSave({
      ...form,
      entry:      parseFloat(form.entry),
      exit:       parseFloat(form.exit),
      quantity:   parseInt(form.quantity) || 1,
      commission: parseFloat(form.commission) || 0,
      pnl:        pnl ?? 0,
      ticks:      ticks ?? null,
      r_multiple: r ?? null,
      tags:       JSON.stringify(form.tags),
      account_id: form.account_id || null,
    })
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">
            {mode === 'edit' ? <Edit2 size={15} /> : <Plus size={15} />}
            {mode === 'edit' ? 'Edit Trade' : 'Add Trade'}
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Row 1: Date + Symbol */}
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Date &amp; Time *</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={form.datetime}
                  onChange={e => set('datetime', e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Symbol *</label>
                <select
                  className="form-select"
                  value={form.symbol}
                  onChange={e => set('symbol', e.target.value)}
                >
                  {instruments.map(i => (
                    <option key={i.symbol} value={i.symbol}>{i.symbol} — {i.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Account */}
            {accounts && accounts.length > 0 && (
              <div className="form-group" style={{ marginTop: 14 }}>
                <label className="form-label">Account *</label>
                <select
                  className="form-select"
                  value={form.account_id}
                  onChange={e => set('account_id', e.target.value)}
                  required
                >
                  <option value="">— Select account —</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Direction */}
            <div className="form-group" style={{ marginTop: 14 }}>
              <label className="form-label">Direction *</label>
              <div className="form-dir-toggle">
                <button
                  type="button"
                  className={`dir-toggle-btn long${form.direction === 'Long' ? ' active' : ''}`}
                  onClick={() => set('direction', 'Long')}
                >
                  ▲ Long
                </button>
                <button
                  type="button"
                  className={`dir-toggle-btn short${form.direction === 'Short' ? ' active' : ''}`}
                  onClick={() => set('direction', 'Short')}
                >
                  ▼ Short
                </button>
              </div>
            </div>

            {/* Entry / Exit / Qty / Commission */}
            <div className="form-grid cols-3" style={{ marginTop: 14 }}>
              <div className="form-group">
                <label className="form-label">Entry Price *</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  placeholder="0.00"
                  value={form.entry}
                  onChange={e => set('entry', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Exit Price *</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  placeholder="0.00"
                  value={form.exit}
                  onChange={e => set('exit', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Quantity</label>
                <input
                  type="number"
                  min="1"
                  className="form-input"
                  value={form.quantity}
                  onChange={e => set('quantity', e.target.value)}
                />
              </div>
            </div>

            <div className="form-grid" style={{ marginTop: 14 }}>
              <div className="form-group">
                <label className="form-label">Commission ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  placeholder="0.00"
                  value={form.commission}
                  onChange={e => set('commission', e.target.value)}
                />
              </div>
            </div>

            {/* Live calc */}
            {pnl != null && (
              <div className="calc-row">
                <div className="calc-item">
                  <div className="calc-label">Gross P&amp;L</div>
                  <div className={`calc-value ${pnl >= 0 ? 'positive' : 'negative'}`}>
                    {fmt.pnl(pnl)}
                  </div>
                </div>
                <div className="calc-item">
                  <div className="calc-label">Ticks</div>
                  <div className={`calc-value ${ticks >= 0 ? 'positive' : 'negative'}`}>
                    {fmt.ticks(ticks)}
                  </div>
                </div>
                <div className="calc-item">
                  <div className="calc-label">R-Multiple</div>
                  <div className={`calc-value ${r >= 0 ? 'positive' : 'negative'}`}>
                    {fmt.r(r)}
                  </div>
                </div>
              </div>
            )}

            {/* Tags */}
            {allTags.length > 0 && (
              <div className="form-group" style={{ marginTop: 14 }}>
                <label className="form-label">Tags</label>
                <div className="form-tags">
                  {allTags.map(tag => (
                    <button
                      key={tag.id}
                      type="button"
                      className={`form-tag${form.tags.includes(tag.id) ? ' selected' : ''}`}
                      style={{
                        background: tag.color + '22',
                        color: tag.color,
                        borderColor: form.tags.includes(tag.id) ? tag.color + '88' : 'transparent',
                      }}
                      onClick={() => toggleTag(tag.id)}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="form-group" style={{ marginTop: 14 }}>
              <label className="form-label">Notes</label>
              <textarea
                className="form-textarea"
                placeholder="Trade notes, observations, lessons learned…"
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {mode === 'edit' ? 'Save Changes' : 'Add Trade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
