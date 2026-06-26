import React, { useState } from 'react'
import { Wallet, Plus, Trash2, Check, ChevronDown, ChevronRight } from 'lucide-react'

const PRESET_COLORS = [
  '#4f9cf9', '#a78bfa', '#f59e0b', '#2bd97c', '#ef5e5e',
  '#f97316', '#ec4899', '#14b8a6', '#8a9bb0', '#f5b942',
]

const STATUS_OPTIONS = ['active', 'passed', 'failed', 'archived']

function ColorSwatches({ selected, onSelect }) {
  return (
    <div className="tag-swatches">
      {PRESET_COLORS.map(c => (
        <button
          key={c}
          type="button"
          className={`tag-swatch${selected === c ? ' active' : ''}`}
          style={{ background: c }}
          onClick={() => onSelect(c)}
          title={c}
        />
      ))}
    </div>
  )
}

function AccountTypeBadge({ type }) {
  const isChallenge = type === 'challenge'
  return (
    <span
      className="account-type-badge"
      style={{
        background: isChallenge ? 'rgba(251,146,60,0.15)' : 'rgba(43,217,124,0.15)',
        color:      isChallenge ? '#fb923c'               : '#2bd97c',
        border:     `1px solid ${isChallenge ? 'rgba(251,146,60,0.35)' : 'rgba(43,217,124,0.35)'}`,
      }}
    >
      {isChallenge ? 'Challenge' : 'Live'}
    </span>
  )
}

function AccountRow({ account, onUpdate, onDelete }) {
  const [open, setOpen]     = useState(false)
  const [form, setForm]     = useState({
    name:            account.name,
    firm:            account.firm || '',
    account_type:    account.account_type || 'live',
    status:          account.status || 'active',
    account_size:    account.account_size ?? '',
    risk_per_trade:  account.risk_per_trade ?? '',
    max_daily_loss:  account.max_daily_loss ?? '',
    max_weekly_loss: account.max_weekly_loss ?? '',
    color:           account.color || '#4f9cf9',
  })
  const [showRisk, setShowRisk] = useState(false)

  function set(key, val) { setForm(prev => ({ ...prev, [key]: val })) }

  function handleSave() {
    if (!form.name.trim()) return
    onUpdate(account.id, {
      ...form,
      account_size:    form.account_size    !== '' ? parseFloat(form.account_size)    : null,
      risk_per_trade:  form.risk_per_trade  !== '' ? parseFloat(form.risk_per_trade)  : null,
      max_daily_loss:  form.max_daily_loss  !== '' ? parseFloat(form.max_daily_loss)  : null,
      max_weekly_loss: form.max_weekly_loss !== '' ? parseFloat(form.max_weekly_loss) : null,
    })
    setOpen(false)
  }

  return (
    <div className="tag-mgmt-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="tag-mgmt-dot" style={{ background: account.color, flexShrink: 0 }} />
        <span className="tag-mgmt-label" style={{ flex: 1 }}>
          <span style={{ fontWeight: 500 }}>{account.name}</span>
          {account.firm && (
            <span style={{ color: 'var(--text-2)', marginLeft: 6 }}>{account.firm}</span>
          )}
        </span>
        <AccountTypeBadge type={account.account_type} />
        <span style={{ color: 'var(--text-2)', fontSize: 11, minWidth: 52, textAlign: 'center' }}>
          {account.status}
        </span>
        {account.account_size != null && (
          <span style={{ color: 'var(--text-1)', fontSize: 11 }}>
            ${Number(account.account_size).toLocaleString()}
          </span>
        )}
        <button className="btn-icon" onClick={() => setOpen(v => !v)} title="Edit">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <button
          className="btn-icon tag-mgmt-delete"
          onClick={() => onDelete(account.id)}
          title="Delete account"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {open && (
        <div style={{ padding: '12px 0 4px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="form-grid">
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Name *</label>
              <input
                className="form-input"
                value={form.name}
                onChange={e => set('name', e.target.value)}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Firm</label>
              <input
                className="form-input"
                value={form.firm}
                onChange={e => set('firm', e.target.value)}
              />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Type</label>
              <div className="form-dir-toggle">
                <button
                  type="button"
                  className={`dir-toggle-btn long${form.account_type === 'live' ? ' active' : ''}`}
                  onClick={() => set('account_type', 'live')}
                >
                  Live
                </button>
                <button
                  type="button"
                  className={`dir-toggle-btn short${form.account_type === 'challenge' ? ' active' : ''}`}
                  onClick={() => set('account_type', 'challenge')}
                >
                  Challenge
                </button>
              </div>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Status</label>
              <select
                className="form-select"
                value={form.status}
                onChange={e => set('status', e.target.value)}
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="form-grid">
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Account Size ($)</label>
              <input
                type="number"
                className="form-input"
                placeholder="e.g. 50000"
                value={form.account_size}
                onChange={e => set('account_size', e.target.value)}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Color</label>
              <ColorSwatches selected={form.color} onSelect={c => set('color', c)} />
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ alignSelf: 'flex-start', fontSize: 11 }}
            onClick={() => setShowRisk(v => !v)}
          >
            {showRisk ? '▾' : '▸'} Risk rules (optional)
          </button>

          {showRisk && (
            <div className="form-grid cols-3">
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Risk/Trade ($)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="e.g. 200"
                  value={form.risk_per_trade}
                  onChange={e => set('risk_per_trade', e.target.value)}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Max Daily Loss ($)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="e.g. 500"
                  value={form.max_daily_loss}
                  onChange={e => set('max_daily_loss', e.target.value)}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Max Weekly Loss ($)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="e.g. 1000"
                  value={form.max_weekly_loss}
                  onChange={e => set('max_weekly_loss', e.target.value)}
                />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={!form.name.trim()}
            >
              <Check size={12} /> Save
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AccountsPage({ accounts, onAdd, onUpdate, onDelete }) {
  const [showForm,  setShowForm]  = useState(false)
  const [newName,   setNewName]   = useState('')
  const [newFirm,   setNewFirm]   = useState('')
  const [newType,   setNewType]   = useState('live')
  const [newStatus, setNewStatus] = useState('active')
  const [newSize,   setNewSize]   = useState('')
  const [newColor,  setNewColor]  = useState(PRESET_COLORS[0])
  const [newRiskPT, setNewRiskPT] = useState('')
  const [newMaxDL,  setNewMaxDL]  = useState('')
  const [newMaxWL,  setNewMaxWL]  = useState('')
  const [showRisk,  setShowRisk]  = useState(false)

  async function handleAdd() {
    if (!newName.trim()) return
    await onAdd({
      name:            newName.trim(),
      firm:            newFirm.trim(),
      account_type:    newType,
      status:          newStatus,
      account_size:    newSize   !== '' ? parseFloat(newSize)   : null,
      risk_per_trade:  newRiskPT !== '' ? parseFloat(newRiskPT) : null,
      max_daily_loss:  newMaxDL  !== '' ? parseFloat(newMaxDL)  : null,
      max_weekly_loss: newMaxWL  !== '' ? parseFloat(newMaxWL)  : null,
      color:           newColor,
    })
    setNewName(''); setNewFirm(''); setNewType('live'); setNewStatus('active')
    setNewSize(''); setNewRiskPT(''); setNewMaxDL(''); setNewMaxWL('')
    setNewColor(PRESET_COLORS[0]); setShowForm(false); setShowRisk(false)
  }

  async function handleDelete(id) {
    const res = await onDelete(id)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      alert(body.error || 'Cannot delete account.')
    }
  }

  return (
    <div className="page-section">
      <div className="page-header">
        <Wallet size={16} />
        <span className="page-title">Accounts</span>
        <button
          className="btn btn-primary btn-sm"
          style={{ marginLeft: 'auto' }}
          onClick={() => setShowForm(v => !v)}
        >
          <Plus size={13} /> New Account
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ maxWidth: 600, marginBottom: 16 }}>
          <div className="card-header"><div className="card-title">Create Account</div></div>
          <div className="card-body" style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-grid">
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Name *</label>
                <input
                  className="form-input"
                  placeholder="e.g. MFFU Live"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  autoFocus
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Firm</label>
                <input
                  className="form-input"
                  placeholder="e.g. MFFU"
                  value={newFirm}
                  onChange={e => setNewFirm(e.target.value)}
                />
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Type</label>
                <div className="form-dir-toggle">
                  <button
                    type="button"
                    className={`dir-toggle-btn long${newType === 'live' ? ' active' : ''}`}
                    onClick={() => setNewType('live')}
                  >
                    Live
                  </button>
                  <button
                    type="button"
                    className={`dir-toggle-btn short${newType === 'challenge' ? ' active' : ''}`}
                    onClick={() => setNewType('challenge')}
                  >
                    Challenge
                  </button>
                </div>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value)}
                >
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Account Size ($)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="e.g. 50000"
                  value={newSize}
                  onChange={e => setNewSize(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Color</label>
                <ColorSwatches selected={newColor} onSelect={setNewColor} />
              </div>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ alignSelf: 'flex-start', fontSize: 11 }}
              onClick={() => setShowRisk(v => !v)}
            >
              {showRisk ? '▾' : '▸'} Risk rules (optional)
            </button>

            {showRisk && (
              <div className="form-grid cols-3">
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Risk/Trade ($)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="e.g. 200"
                    value={newRiskPT}
                    onChange={e => setNewRiskPT(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Max Daily Loss ($)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="e.g. 500"
                    value={newMaxDL}
                    onChange={e => setNewMaxDL(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Max Weekly Loss ($)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="e.g. 1000"
                    value={newMaxWL}
                    onChange={e => setNewMaxWL(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={handleAdd} disabled={!newName.trim()}>
                <Check size={13} /> Create
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => { setShowForm(false); setNewName('') }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ maxWidth: 760 }}>
        <div className="card-header">
          <div className="card-title">All Accounts ({accounts.length})</div>
        </div>
        {accounts.length === 0 ? (
          <div className="empty-state"><p>No accounts yet. Click "New Account" to create one.</p></div>
        ) : (
          <div className="tag-mgmt-list">
            {accounts.map(acc => (
              <AccountRow
                key={acc.id}
                account={acc}
                onUpdate={onUpdate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
