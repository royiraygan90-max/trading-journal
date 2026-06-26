import React, { useState, useMemo, useRef } from 'react'
import {
  Briefcase, Plus, Edit2, Trash2, Repeat, Paperclip,
  X, Check, Download, Upload,
} from 'lucide-react'

const CATEGORIES = [
  { value: 'Challenge / Evaluation Fee',      color: '#fb923c' },
  { value: 'Trading Software / Subscription', color: '#4f9cf9' },
  { value: 'Education / Courses',             color: '#a78bfa' },
  { value: 'Equipment',                       color: '#2bd97c' },
  { value: 'Professional / Accounting Fees',  color: '#f472b6' },
  { value: 'Other',                           color: '#9ca3af' },
]

const CURRENCIES = ['USD', 'ILS', 'EUR']
const CURRENCY_SYMBOL = { USD: '$', ILS: '₪', EUR: '€' }

function catColor(value) {
  return CATEGORIES.find(c => c.value === value)?.color ?? '#9ca3af'
}

function fmtAmt(amount, currency) {
  const sym = CURRENCY_SYMBOL[currency] ?? currency
  return `${sym}${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function groupByCurrency(items) {
  const result = {}
  for (const item of items) {
    const c = item.currency || 'USD'
    result[c] = (result[c] || 0) + Number(item.amount)
  }
  return result
}

function formatCurrencyTotals(byCurrency) {
  return Object.entries(byCurrency)
    .filter(([, v]) => v > 0)
    .map(([cur, total]) => fmtAmt(total, cur))
    .join(' · ') || '—'
}

const DEFAULT_FORM = {
  date:       '',
  category:   CATEGORIES[0].value,
  vendor:     '',
  amount:     '',
  currency:   'USD',
  account_id: '',
  recurring:  false,
  notes:      '',
}

// ── Add / Edit modal ──────────────────────────────────────────────────────────
function ExpenseModal({ mode, expense, accounts, onSave, onClose }) {
  const [form, setForm] = useState(() =>
    mode === 'edit' && expense
      ? {
          date:       expense.date || '',
          category:   expense.category || CATEGORIES[0].value,
          vendor:     expense.vendor || '',
          amount:     expense.amount ?? '',
          currency:   expense.currency || 'USD',
          account_id: expense.account_id || '',
          recurring:  Boolean(expense.recurring),
          notes:      expense.notes || '',
        }
      : { ...DEFAULT_FORM, date: todayStr() }
  )

  function set(key, val) { setForm(prev => ({ ...prev, [key]: val })) }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.date || !form.amount) {
      alert('Date and Amount are required.')
      return
    }
    onSave({
      ...form,
      amount:     parseFloat(form.amount),
      recurring:  form.recurring ? 1 : 0,
      account_id: form.account_id || null,
    })
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">
            {mode === 'edit' ? <Edit2 size={15} /> : <Plus size={15} />}
            {mode === 'edit' ? 'Edit Expense' : 'Add Expense'}
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.date}
                  onChange={e => set('date', e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select
                  className="form-select"
                  value={form.category}
                  onChange={e => set('category', e.target.value)}
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.value}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 14 }}>
              <label className="form-label">Vendor / Description</label>
              <input
                className="form-input"
                placeholder="e.g. MFFU, TradingView, Udemy…"
                value={form.vendor}
                onChange={e => set('vendor', e.target.value)}
              />
            </div>

            <div className="form-grid" style={{ marginTop: 14 }}>
              <div className="form-group">
                <label className="form-label">Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={e => set('amount', e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Currency</label>
                <select
                  className="form-select"
                  value={form.currency}
                  onChange={e => set('currency', e.target.value)}
                >
                  {CURRENCIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {accounts && accounts.length > 0 && (
              <div className="form-group" style={{ marginTop: 14 }}>
                <label className="form-label">Account (optional)</label>
                <select
                  className="form-select"
                  value={form.account_id}
                  onChange={e => set('account_id', e.target.value)}
                >
                  <option value="">— none —</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group" style={{ marginTop: 14 }}>
              <label className="expense-checkbox-label">
                <input
                  type="checkbox"
                  checked={form.recurring}
                  onChange={e => set('recurring', e.target.checked)}
                />
                Recurring subscription
              </label>
            </div>

            <div className="form-group" style={{ marginTop: 14 }}>
              <label className="form-label">Notes</label>
              <textarea
                className="form-textarea"
                placeholder="Optional notes…"
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">
              {mode === 'edit' ? 'Save Changes' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Receipt upload modal ──────────────────────────────────────────────────────
function ReceiptUploadModal({ expenseId, expenseName, onDone }) {
  const fileInputRef           = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [uploaded,  setUploaded]  = useState([])
  const [dragOver,  setDragOver]  = useState(false)

  async function uploadFiles(files) {
    if (!files || files.length === 0) return
    setUploading(true)
    const fd = new FormData()
    for (const f of files) fd.append('file', f)
    try {
      const r = await fetch(`/api/expenses/${expenseId}/images`, { method: 'POST', body: fd })
      if (r.ok) {
        const urls = await r.json()
        setUploaded(prev => [...prev, ...urls])
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onDone()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title"><Paperclip size={15} />Attach Receipt</div>
          <button className="modal-close" onClick={onDone}><X size={16} /></button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '0.82rem', color: 'var(--text-1)', marginBottom: 14 }}>
            Expense <strong style={{ color: 'var(--text-0)' }}>{expenseName}</strong> added.
            Optionally attach a receipt image — you can skip this.
          </p>

          <div
            className={`receipt-drop-zone${dragOver ? ' drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files) }}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={20} style={{ color: 'var(--text-2)' }} />
            <span style={{ fontSize: '0.82rem', color: 'var(--text-2)' }}>
              {uploading ? 'Uploading…' : 'Click or drag a receipt image here'}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={e => uploadFiles(e.target.files)}
            />
          </div>

          {uploaded.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {uploaded.map(url => (
                <img
                  key={url}
                  src={url}
                  alt="receipt"
                  style={{ height: 72, borderRadius: 4, border: '1px solid var(--border)', objectFit: 'cover' }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onDone}>Skip</button>
          <button className="btn btn-primary" onClick={onDone}>
            <Check size={13} /> Done
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BusinessPage({ expenses, accounts, onAdd, onUpdate, onDelete }) {
  const [modal,         setModal]         = useState(null) // 'add' | 'edit' | 'receipt' | null
  const [editExpense,   setEditExpense]   = useState(null)
  const [receiptTarget, setReceiptTarget] = useState(null) // { id, name }

  const thisYear = new Date().getFullYear()

  const summary = useMemo(() => {
    const allTime     = groupByCurrency(expenses)
    const yearItems   = expenses.filter(e => e.date?.startsWith(String(thisYear)))
    const yearTotals  = groupByCurrency(yearItems)

    const byCategory = {}
    for (const cat of CATEGORIES) {
      const catItems = expenses.filter(e => e.category === cat.value)
      if (catItems.length > 0) {
        byCategory[cat.value] = { color: cat.color, totals: groupByCurrency(catItems) }
      }
    }
    return { allTime, yearTotals, byCategory }
  }, [expenses, thisYear])

  async function handleAdd(data) {
    const newExp = await onAdd(data)
    if (newExp?.id) {
      setReceiptTarget({ id: newExp.id, name: newExp.vendor || newExp.category })
      setModal('receipt')
    } else {
      setModal(null)
    }
  }

  async function handleUpdate(data) {
    await onUpdate(editExpense.id, data)
    setModal(null)
    setEditExpense(null)
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this expense? This will also remove any attached receipt images.')) return
    await onDelete(id)
  }

  function exportCSV() {
    const headers = ['Date', 'Category', 'Vendor', 'Amount', 'Currency', 'Account', 'Recurring', 'Notes']
    const rows = expenses.map(e => {
      const accName = accounts.find(a => a.id === e.account_id)?.name ?? ''
      return [e.date, e.category, e.vendor, e.amount, e.currency, accName, e.recurring ? 'Yes' : 'No', e.notes]
        .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`)
    })
    const csv  = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'business_expenses.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const sorted = useMemo(
    () => [...expenses].sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0)),
    [expenses]
  )

  return (
    <div className="page-section">
      <div className="page-header">
        <Briefcase size={16} />
        <span className="page-title">Business Expenses</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={exportCSV} disabled={expenses.length === 0}>
            <Download size={13} /> Export CSV
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setModal('add')}>
            <Plus size={13} /> Add Expense
          </button>
        </div>
      </div>

      {/* ── Summary cards ─────────────────────────────────────────────────── */}
      <div className="expense-summary-row">
        <div className="stat-card">
          <div className="stat-label">Total Spent (All Time)</div>
          <div className="stat-value">{formatCurrencyTotals(summary.allTime)}</div>
          <div className="stat-sub">{expenses.length} expense{expenses.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total This Year ({thisYear})</div>
          <div className="stat-value">{formatCurrencyTotals(summary.yearTotals)}</div>
        </div>
        <div className="stat-card expense-cat-card">
          <div className="stat-label" style={{ marginBottom: 8 }}>By Category</div>
          {Object.keys(summary.byCategory).length === 0 ? (
            <div className="stat-sub">No expenses yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(summary.byCategory).map(([cat, { color, totals }]) => (
                <div key={cat} className="expense-cat-row">
                  <div className="expense-cat-dot" style={{ background: color }} />
                  <span className="expense-cat-name">{cat}</span>
                  <span className="expense-cat-total">{formatCurrencyTotals(totals)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Expense table ──────────────────────────────────────────────────── */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <div className="card-title">
            <Briefcase size={14} />All Expenses ({expenses.length})
          </div>
        </div>
        {expenses.length === 0 ? (
          <div className="empty-state">
            <p>No expenses yet. Click "+ Add Expense" to get started.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="trades-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Vendor</th>
                  <th>Amount</th>
                  <th></th>
                  <th>Account</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(exp => {
                  const acc   = accounts.find(a => a.id === exp.account_id)
                  const color = catColor(exp.category)
                  return (
                    <tr key={exp.id}>
                      <td className="td-date">{exp.date}</td>
                      <td>
                        <span
                          className="tag-pill"
                          style={{ background: color + '22', color, border: `1px solid ${color}44` }}
                        >
                          {exp.category}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-1)' }}>{exp.vendor || '—'}</td>
                      <td className="td-mono" style={{ color: 'var(--red)' }}>
                        {fmtAmt(exp.amount, exp.currency)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                          {exp.recurring  ? <Repeat    size={12} style={{ color: 'var(--text-2)' }} title="Recurring"   /> : null}
                          {exp.has_receipt ? <Paperclip size={12} style={{ color: 'var(--text-2)' }} title="Has receipt" /> : null}
                        </div>
                      </td>
                      <td>
                        {acc ? (
                          <span
                            className="tag-pill"
                            style={{ background: acc.color + '22', color: acc.color, border: `1px solid ${acc.color}44` }}
                          >
                            {acc.name}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="row-action-btn"
                            title="Edit"
                            onClick={() => { setEditExpense(exp); setModal('edit') }}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            className="row-action-btn danger"
                            title="Delete"
                            onClick={() => handleDelete(exp.id)}
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
        )}
      </div>

      {modal === 'add' && (
        <ExpenseModal
          mode="add"
          accounts={accounts}
          onSave={handleAdd}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'edit' && editExpense && (
        <ExpenseModal
          mode="edit"
          expense={editExpense}
          accounts={accounts}
          onSave={handleUpdate}
          onClose={() => { setModal(null); setEditExpense(null) }}
        />
      )}

      {modal === 'receipt' && receiptTarget && (
        <ReceiptUploadModal
          expenseId={receiptTarget.id}
          expenseName={receiptTarget.name}
          onDone={() => { setModal(null); setReceiptTarget(null) }}
        />
      )}
    </div>
  )
}
