import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  FlaskConical, Plus, Edit2, Trash2, ChevronDown, ChevronRight,
  Paperclip, Check, X, Upload,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { fmt } from '../utils.jsx'

// ── Constants ─────────────────────────────────────────────────────────────────
const OUTCOMES = [
  { value: 'worked',     label: 'Worked',      color: '#2bd97c' },
  { value: 'partial',    label: 'Partial',     color: '#fbbf24' },
  { value: 'didnt_work', label: "Didn't Work", color: '#f87171' },
]

const MATCH_QUALITY = [
  { value: 'a', label: 'A — Textbook', color: '#2bd97c' },
  { value: 'b', label: 'B — Mostly',   color: '#fbbf24' },
  { value: 'c', label: 'C — Loose',    color: '#f87171' },
]

const STATUSES = ['testing', 'active', 'promoted', 'rejected', 'retired']

const STATUS_COLOR = {
  testing:  '#fbbf24',
  active:   '#2bd97c',
  promoted: '#4f9cf9',
  rejected: '#f87171',
  retired:  '#9ca3af',
}

const PRESET_COLORS = [
  '#4f9cf9', '#a78bfa', '#f59e0b', '#2bd97c', '#ef5e5e',
  '#f97316', '#ec4899', '#14b8a6', '#8a9bb0', '#f5b942',
]

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildObsStats(obs) {
  const total   = obs.length
  const worked  = obs.filter(o => o.outcome === 'worked').length
  const partial = obs.filter(o => o.outcome === 'partial').length
  const didnt   = obs.filter(o => o.outcome === 'didnt_work').length
  const traded  = obs.filter(o => o.traded).length
  const pct     = total > 0 ? Math.round((worked / total) * 100) : null
  return { total, worked, partial, didnt, traded, pct }
}

function buildDowData(obs) {
  const counts = Array(7).fill(null).map((_, i) => ({ day: DOW_LABELS[i], total: 0, worked: 0 }))
  for (const o of obs) {
    if (!o.date) continue
    const dow = new Date(o.date + 'T12:00:00').getDay()
    counts[dow].total++
    if (o.outcome === 'worked') counts[dow].worked++
  }
  return counts
    .filter(d => d.total >= 1)
    .map(d => ({ day: d.day, pct: Math.round((d.worked / d.total) * 100), total: d.total }))
}

function todayStr() { return new Date().toISOString().slice(0, 10) }

function flatStrategyList(strategies) {
  const bases    = strategies.filter(s => !s.parent_id).sort((a, b) => a.sort_order - b.sort_order)
  const variants = strategies.filter(s =>  s.parent_id)
  const result   = []
  for (const base of bases) {
    result.push({ strat: base, indent: false })
    variants
      .filter(v => v.parent_id === base.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .forEach(v => result.push({ strat: v, indent: true }))
  }
  return result
}

// ── Shared sub-components ─────────────────────────────────────────────────────
function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="seg-ctrl">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          className={`seg-btn${value === opt.value ? ' active' : ''}`}
          style={value === opt.value
            ? { background: opt.color + '22', borderColor: opt.color + '88', color: opt.color }
            : {}
          }
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

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

function StatusBadge({ status }) {
  const color = STATUS_COLOR[status] ?? '#9ca3af'
  return (
    <span
      className="tag-pill"
      style={{ background: color + '22', color, border: `1px solid ${color}44`, textTransform: 'capitalize' }}
    >
      {status}
    </span>
  )
}

function OutcomeBadge({ outcome }) {
  const o     = OUTCOMES.find(x => x.value === outcome)
  const color = o?.color ?? '#9ca3af'
  return (
    <span className="tag-pill" style={{ background: color + '22', color, border: `1px solid ${color}44` }}>
      {o?.label ?? outcome}
    </span>
  )
}

function MqBadge({ mq }) {
  const m     = MATCH_QUALITY.find(x => x.value === mq)
  const color = m?.color ?? '#9ca3af'
  return (
    <span className="tag-pill" style={{ background: color + '22', color, border: `1px solid ${color}44` }}>
      {m?.label ?? mq}
    </span>
  )
}

// ── Strategy modal ────────────────────────────────────────────────────────────
const DEFAULT_STRAT_FORM = { name: '', description: '', status: 'testing', color: PRESET_COLORS[0] }

function StrategyModal({ mode, strat, parentId, onSave, onClose }) {
  const [form, setForm] = useState(() =>
    mode === 'edit' && strat
      ? { name: strat.name || '', description: strat.description || '', status: strat.status || 'testing', color: strat.color || PRESET_COLORS[0] }
      : { ...DEFAULT_STRAT_FORM }
  )
  function set(k, v) { setForm(p => ({ ...p, [k]: v })) }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave({
      ...form,
      parent_id: mode === 'edit' ? (strat?.parent_id ?? null) : (parentId ?? null),
    })
  }

  const isVariant = mode === 'edit' ? Boolean(strat?.parent_id) : Boolean(parentId)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">
            {mode === 'edit' ? <Edit2 size={15} /> : <Plus size={15} />}
            {mode === 'edit' ? 'Edit Strategy' : (isVariant ? 'Add Variant' : 'New Strategy')}
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input
                className="form-input"
                placeholder={isVariant ? 'e.g. With Volume Filter' : 'e.g. Supply / Demand Break'}
                value={form.name}
                onChange={e => set('name', e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="form-group" style={{ marginTop: 14 }}>
              <label className="form-label">Description / Criteria</label>
              <textarea
                className="form-textarea"
                placeholder="Define the setup criteria and rules for this strategy…"
                value={form.description}
                onChange={e => set('description', e.target.value)}
                rows={4}
              />
            </div>
            <div className="form-grid" style={{ marginTop: 14 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Status</label>
                <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
                  {STATUSES.map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Color</label>
                <ColorSwatches selected={form.color} onSelect={c => set('color', c)} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={!form.name.trim()}>
              {mode === 'edit' ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Observation modal ─────────────────────────────────────────────────────────
const DEFAULT_OBS_FORM = {
  date: '', strategy_id: '', outcome: 'partial', match_quality: 'b',
  traded: false, trade_id: null, notes: '',
}

function ObsModal({ mode, obs, strategies, trades, defaultStratId, onSave, onClose }) {
  const [form, setForm] = useState(() => {
    if (mode === 'edit' && obs) {
      return {
        date: obs.date || todayStr(), strategy_id: obs.strategy_id || '',
        outcome: obs.outcome || 'partial', match_quality: obs.match_quality || 'b',
        traded: Boolean(obs.traded), trade_id: obs.trade_id || null, notes: obs.notes || '',
      }
    }
    return { ...DEFAULT_OBS_FORM, date: todayStr(), strategy_id: defaultStratId || '' }
  })

  const [tradeSearch, setTradeSearch] = useState(() => {
    if (mode === 'edit' && obs?.trade_id) {
      const t = trades.find(tr => tr.id === obs.trade_id)
      return t ? `${t.symbol} · ${fmt.date(t.datetime)}` : ''
    }
    return ''
  })

  function set(k, v) {
    setForm(p => {
      const n = { ...p, [k]: v }
      if (k === 'traded' && !v) n.trade_id = null
      return n
    })
  }

  const flat = useMemo(() => flatStrategyList(strategies), [strategies])

  const matchingTrades = useMemo(() => {
    if (!tradeSearch.trim() || form.trade_id) return []
    const q = tradeSearch.toLowerCase()
    return trades
      .filter(t => t.symbol?.toLowerCase().includes(q) || t.datetime?.includes(q))
      .slice(0, 6)
  }, [trades, tradeSearch, form.trade_id])

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.date || !form.strategy_id) { alert('Date and Strategy are required.'); return }
    onSave({ ...form, traded: form.traded ? 1 : 0, trade_id: form.traded ? form.trade_id : null })
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">
            {mode === 'edit' ? <Edit2 size={15} /> : <Plus size={15} />}
            {mode === 'edit' ? 'Edit Observation' : 'Log Observation'}
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input type="date" className="form-input" value={form.date}
                  onChange={e => set('date', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Strategy *</label>
                <select className="form-select" value={form.strategy_id}
                  onChange={e => set('strategy_id', e.target.value)} required>
                  <option value="">— Select strategy —</option>
                  {flat.map(({ strat, indent }) => (
                    <option key={strat.id} value={strat.id}>
                      {indent ? `    ${strat.name}` : strat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 14 }}>
              <label className="form-label">Outcome *</label>
              <SegmentedControl options={OUTCOMES} value={form.outcome} onChange={v => set('outcome', v)} />
            </div>

            <div className="form-group" style={{ marginTop: 14 }}>
              <label className="form-label">Match Quality *</label>
              <SegmentedControl options={MATCH_QUALITY} value={form.match_quality} onChange={v => set('match_quality', v)} />
            </div>

            <div className="form-group" style={{ marginTop: 14 }}>
              <label className="expense-checkbox-label">
                <input type="checkbox" checked={form.traded} onChange={e => set('traded', e.target.checked)} />
                I actually traded this
              </label>
            </div>

            {form.traded && (
              <div className="form-group" style={{ marginTop: 10, position: 'relative' }}>
                <label className="form-label">Link to Trade (optional)</label>
                <input
                  className="form-input"
                  placeholder="Search by symbol or date…"
                  value={tradeSearch}
                  onChange={e => { setTradeSearch(e.target.value); if (form.trade_id) set('trade_id', null) }}
                  autoComplete="off"
                />
                {matchingTrades.length > 0 && (
                  <div className="obs-trade-picker">
                    {matchingTrades.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        className="obs-trade-option"
                        onClick={() => { set('trade_id', t.id); setTradeSearch(`${t.symbol} · ${fmt.date(t.datetime)}`) }}
                      >
                        <span style={{ color: 'var(--text-0)', fontWeight: 600 }}>{t.symbol}</span>
                        <span style={{ color: 'var(--text-2)', margin: '0 6px' }}>·</span>
                        <span style={{ color: 'var(--text-1)', flex: 1 }}>{fmt.date(t.datetime)}</span>
                        <span style={{ color: t.pnl >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                          {fmt.pnl(t.pnl)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {form.trade_id && (
                  <div style={{ marginTop: 4, fontSize: '0.75rem', color: 'var(--text-2)' }}>
                    Linked ✓{' '}
                    <button type="button"
                      style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}
                      onClick={() => { set('trade_id', null); setTradeSearch('') }}>
                      clear
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="form-group" style={{ marginTop: 14 }}>
              <label className="form-label">Notes</label>
              <textarea className="form-textarea" placeholder="What did you observe? What happened?"
                value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">
              {mode === 'edit' ? 'Save Changes' : 'Log Observation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Observation screenshot modal ──────────────────────────────────────────────
function ObsReceiptModal({ obsId, obsName, onDone }) {
  const fileRef               = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [uploaded,  setUploaded]  = useState([])
  const [dragOver,  setDragOver]  = useState(false)

  async function uploadFiles(files) {
    if (!files?.length) return
    setUploading(true)
    const fd = new FormData()
    for (const f of files) fd.append('file', f)
    try {
      const r = await fetch(`/api/observations/${obsId}/images`, { method: 'POST', body: fd })
      if (r.ok) { const imgs = await r.json(); setUploaded(p => [...p, ...imgs]) }
    } finally { setUploading(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onDone()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title"><Paperclip size={15} />Attach Screenshot</div>
          <button className="modal-close" onClick={onDone}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: '0.82rem', color: 'var(--text-1)', marginBottom: 14 }}>
            Observation for <strong style={{ color: 'var(--text-0)' }}>{obsName}</strong> logged.
            Optionally attach a screenshot.
          </p>
          <div
            className={`receipt-drop-zone${dragOver ? ' drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files) }}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={20} style={{ color: 'var(--text-2)' }} />
            <span style={{ fontSize: '0.82rem', color: 'var(--text-2)' }}>
              {uploading ? 'Uploading…' : 'Click or drag a screenshot here'}
            </span>
            <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
              onChange={e => uploadFiles(e.target.files)} />
          </div>
          {uploaded.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {uploaded.map(url => (
                <img key={url} src={url} alt="screenshot"
                  style={{ height: 72, borderRadius: 4, border: '1px solid var(--border)', objectFit: 'cover' }} />
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onDone}>Skip</button>
          <button className="btn btn-primary" onClick={onDone}><Check size={13} /> Done</button>
        </div>
      </div>
    </div>
  )
}

// ── Strategy Card ─────────────────────────────────────────────────────────────
function StrategyCard({ strat, variants, observations, onEdit, onDelete, onAddVariant, onAddObs }) {
  const [expanded,  setExpanded]  = useState(false)
  const [images,    setImages]    = useState(null)
  const [dragOver,  setDragOver]  = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    if (expanded && images === null) {
      fetch(`/api/strategies/${strat.id}/images`)
        .then(r => r.json()).then(setImages).catch(() => setImages([]))
    }
  }, [expanded, strat.id, images])

  async function uploadImages(files) {
    if (!files?.length || uploading) return
    setUploading(true)
    const fd = new FormData()
    for (const f of files) fd.append('file', f)
    try {
      const r = await fetch(`/api/strategies/${strat.id}/images`, { method: 'POST', body: fd })
      if (r.ok) { const imgs = await r.json(); setImages(p => [...(p || []), ...imgs]) }
    } finally { setUploading(false) }
  }

  async function deleteImage(url) {
    const fn = url.split('/').pop()
    await fetch(`/api/strategies/${strat.id}/images/${fn}`, { method: 'DELETE' })
    setImages(p => (p || []).filter(u => u !== url))
  }

  const variantIds  = variants.map(v => v.id)
  const allIds      = [strat.id, ...variantIds]
  const combinedObs = observations.filter(o => allIds.includes(o.strategy_id))
  const directObs   = observations.filter(o => o.strategy_id === strat.id)
  const stats       = buildObsStats(combinedObs)
  const dowData     = buildDowData(combinedObs)

  const compRows = [
    { key: strat.id, name: `${strat.name} (direct)`, status: strat.status, color: strat.color, obs: directObs },
    ...variants
      .map(v => ({ key: v.id, name: v.name, status: v.status, color: v.color, obs: observations.filter(o => o.strategy_id === v.id) }))
      .sort((a, b) => b.obs.length - a.obs.length),
  ]

  return (
    <div className="strat-card">
      <div className="strat-card-header" onClick={() => setExpanded(v => !v)}>
        <div className="strat-card-dot" style={{ background: strat.color }} />
        <span className="strat-card-name">{strat.name}</span>
        <StatusBadge status={strat.status} />
        {combinedObs.length > 0 && (
          <span className="strat-obs-count">{combinedObs.length} obs</span>
        )}
        {variants.length > 0 && (
          <span style={{ fontSize: '0.72rem', color: 'var(--text-2)' }}>
            {variants.length} variant{variants.length !== 1 ? 's' : ''}
          </span>
        )}
        <div className="strat-card-actions" onClick={e => e.stopPropagation()}>
          <button className="row-action-btn" title="Edit" onClick={() => onEdit(strat)}><Edit2 size={13} /></button>
          <button className="row-action-btn danger" title="Delete" onClick={() => onDelete(strat.id)}><Trash2 size={13} /></button>
        </div>
        {expanded
          ? <ChevronDown  size={14} style={{ color: 'var(--text-2)', flexShrink: 0 }} />
          : <ChevronRight size={14} style={{ color: 'var(--text-2)', flexShrink: 0 }} />}
      </div>

      {expanded && (
        <div className="strat-card-body">
          {strat.description && (
            <p className="strat-description">{strat.description}</p>
          )}

          {/* Reference images */}
          <div style={{ marginBottom: 16 }}>
            <div className="form-label" style={{ marginBottom: 6 }}>Reference Images</div>
            {images && images.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {images.map(url => (
                  <div key={url} className="strat-image-thumb">
                    <img src={url} alt="reference" />
                    <button className="strat-image-delete" onClick={() => deleteImage(url)} title="Remove">
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div
              className={`receipt-drop-zone${dragOver ? ' drag-over' : ''}`}
              style={{ padding: '10px 14px', gap: 6, flexDirection: 'row' }}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); uploadImages(e.dataTransfer.files) }}
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={13} style={{ color: 'var(--text-2)' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>
                {uploading ? 'Uploading…' : 'Add reference image'}
              </span>
              <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                onChange={e => uploadImages(e.target.files)} />
            </div>
          </div>

          {/* Combined summary */}
          {combinedObs.length > 0 && (
            <div className="strat-summary-block">
              <div className="strat-summary-stats">
                {[
                  { label: 'Obs',       val: stats.total,    cls: '' },
                  { label: 'Worked',    val: stats.worked,   cls: 'positive' },
                  { label: 'Partial',   val: stats.partial,  cls: 'accent' },
                  { label: "Didn't",    val: stats.didnt,    cls: 'negative' },
                  { label: '% Worked',  val: stats.pct != null ? `${stats.pct}%` : '—', cls: stats.pct != null ? (stats.pct >= 50 ? 'positive' : 'negative') : '' },
                  { label: 'Traded',    val: stats.traded,   cls: '' },
                ].map(({ label, val, cls }) => (
                  <div key={label} className="strat-stat-item">
                    <div className="stat-label">{label}</div>
                    <div className={`stat-value${cls ? ` ${cls}` : ''}`} style={{ fontSize: '1rem' }}>{val}</div>
                  </div>
                ))}
              </div>

              {dowData.length > 0 && (
                <div className="strat-dow-chart">
                  <div className="stat-label" style={{ marginBottom: 6 }}>% Worked by Day</div>
                  <ResponsiveContainer width="100%" height={100}>
                    <BarChart data={dowData} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                      <XAxis dataKey="day" tick={{ fill: 'var(--text-2)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'var(--text-2)', fontSize: 9 }} axisLine={false} tickLine={false}
                        tickFormatter={v => `${v}%`} domain={[0, 100]} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const { day, pct, total } = payload[0]?.payload || {}
                          return (
                            <div className="custom-tooltip">
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-1)' }}>{day} ({total} obs)</div>
                              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--green)' }}>{pct}% worked</div>
                            </div>
                          )
                        }}
                      />
                      <Bar dataKey="pct" radius={[3, 3, 0, 0]} maxBarSize={30} fill="var(--accent)" fillOpacity={0.8} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Variant comparison table */}
          {(directObs.length > 0 || variants.length > 0) && (
            <div style={{ marginTop: 16 }}>
              <div className="stat-label" style={{ marginBottom: 8 }}>Variant Comparison</div>
              <div className="table-wrap">
                <table className="strat-comp-table">
                  <thead>
                    <tr>
                      <th>Strategy / Variant</th>
                      <th>Status</th>
                      <th>Obs</th>
                      <th>Worked</th>
                      <th>Partial</th>
                      <th>Didn't</th>
                      <th>% Worked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compRows.map(row => {
                      const s = buildObsStats(row.obs)
                      return (
                        <tr key={row.key}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: row.color, flexShrink: 0 }} />
                              <span style={{ fontSize: '0.82rem', color: 'var(--text-0)' }}>{row.name}</span>
                            </div>
                          </td>
                          <td><StatusBadge status={row.status} /></td>
                          <td className="td-mono">{s.total}</td>
                          <td className="td-mono positive">{s.worked}</td>
                          <td className="td-mono accent">{s.partial}</td>
                          <td className="td-mono negative">{s.didnt}</td>
                          <td className="td-mono" style={{
                            color: s.pct != null ? (s.pct >= 50 ? 'var(--green)' : 'var(--red)') : 'var(--text-2)'
                          }}>
                            {s.pct != null ? `${s.pct}%` : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Card actions */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => onAddVariant(strat)}>
              <Plus size={12} /> Add Variant
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => onAddObs(strat.id)}>
              <Plus size={12} /> Log Observation
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Playbook view ─────────────────────────────────────────────────────────────
function PlaybookView({ strategies, observations, onAddStrategy, onEditStrategy, onDeleteStrategy, onAddVariant, onAddObs }) {
  const bases = strategies
    .filter(s => !s.parent_id)
    .sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={onAddStrategy}>
          <Plus size={13} /> New Strategy
        </button>
      </div>
      {bases.length === 0 ? (
        <div className="empty-state" style={{ height: 200 }}>
          <p>No strategies yet. Click "+ New Strategy" to build your playbook.</p>
        </div>
      ) : (
        <div className="strat-list">
          {bases.map(base => (
            <StrategyCard
              key={base.id}
              strat={base}
              variants={strategies.filter(s => s.parent_id === base.id)}
              observations={observations}
              onEdit={onEditStrategy}
              onDelete={onDeleteStrategy}
              onAddVariant={onAddVariant}
              onAddObs={onAddObs}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Log view ──────────────────────────────────────────────────────────────────
function LogView({ observations, strategies, trades, onAddObs, onEditObs, onDeleteObs }) {
  const [filterStratId, setFilterStratId] = useState('all')
  const flat = useMemo(() => flatStrategyList(strategies), [strategies])

  const visible = useMemo(() => {
    const sorted = [...observations].sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))
    return filterStratId === 'all' ? sorted : sorted.filter(o => o.strategy_id === filterStratId)
  }, [observations, filterStratId])

  function getStrat(id) { return strategies.find(s => s.id === id) }
  function getTrade(id) { return id ? trades.find(t => t.id === id) : null }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <select
          className="header-input symbol"
          value={filterStratId}
          onChange={e => setFilterStratId(e.target.value)}
          style={{ minWidth: 220 }}
        >
          <option value="all">All Strategies</option>
          {flat.map(({ strat, indent }) => (
            <option key={strat.id} value={strat.id}>
              {indent ? `    ${strat.name}` : strat.name}
            </option>
          ))}
        </select>
        <button
          className="btn btn-primary btn-sm"
          style={{ marginLeft: 'auto' }}
          onClick={() => onAddObs(filterStratId !== 'all' ? filterStratId : '')}
        >
          <Plus size={13} /> Add Observation
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="empty-state" style={{ height: 180 }}>
          <p>No observations yet. Click "+ Add Observation" to start logging.</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="trades-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Strategy</th>
                  <th>Outcome</th>
                  <th>Quality</th>
                  <th></th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(obs => {
                  const strat = getStrat(obs.strategy_id)
                  const trade = getTrade(obs.trade_id)
                  return (
                    <tr key={obs.id}>
                      <td className="td-date">{obs.date}</td>
                      <td>
                        {strat ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: strat.color, flexShrink: 0 }} />
                            <span style={{ color: 'var(--text-0)', fontSize: '0.82rem' }}>{strat.name}</span>
                          </div>
                        ) : <span style={{ color: 'var(--text-2)' }}>—</span>}
                      </td>
                      <td><OutcomeBadge outcome={obs.outcome} /></td>
                      <td><MqBadge mq={obs.match_quality} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                          {obs.traded ? (
                            <span
                              title={trade ? `${trade.symbol} · ${fmt.pnl(trade.pnl)}` : 'Traded'}
                              style={{ color: 'var(--green)', display: 'flex' }}
                            >
                              <Check size={12} />
                            </span>
                          ) : null}
                          {obs.has_image ? <Paperclip size={12} style={{ color: 'var(--text-2)' }} title="Has screenshot" /> : null}
                        </div>
                      </td>
                      <td style={{
                        color: 'var(--text-1)', maxWidth: 220,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.82rem',
                      }}>
                        {obs.notes || '—'}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button className="row-action-btn" title="Edit" onClick={() => onEditObs(obs)}><Edit2 size={13} /></button>
                          <button className="row-action-btn danger" title="Delete" onClick={() => onDeleteObs(obs.id)}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function StrategiesPage({
  strategies, observations, trades,
  onAddStrategy, onUpdateStrategy, onDeleteStrategy,
  onAddObservation, onUpdateObservation, onDeleteObservation,
}) {
  const [tab,        setTab]        = useState('playbook')
  const [stratModal, setStratModal] = useState(null) // { mode, strat?, parentId? }
  const [obsModal,   setObsModal]   = useState(null) // { mode, obs?, defaultStratId? }
  const [obsReceipt, setObsReceipt] = useState(null) // { id, name }

  async function handleSaveStrat(data) {
    if (stratModal.mode === 'edit') {
      await onUpdateStrategy(stratModal.strat.id, data)
    } else {
      await onAddStrategy(data)
    }
    setStratModal(null)
  }

  async function handleDeleteStrat(id) {
    if (!window.confirm('Delete this strategy? This cannot be undone.')) return
    const res = await onDeleteStrategy(id)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      alert(body.error || 'Cannot delete strategy.')
    }
  }

  async function handleSaveObs(data) {
    if (obsModal.mode === 'edit') {
      await onUpdateObservation(obsModal.obs.id, data)
      setObsModal(null)
    } else {
      const newObs = await onAddObservation(data)
      setObsModal(null)
      if (newObs?.id) {
        const strat = strategies.find(s => s.id === data.strategy_id)
        setObsReceipt({ id: newObs.id, name: strat?.name ?? 'observation' })
      }
    }
  }

  async function handleDeleteObs(id) {
    if (!window.confirm('Delete this observation and any attached screenshot?')) return
    await onDeleteObservation(id)
  }

  return (
    <div className="page-section">
      <div className="page-header">
        <FlaskConical size={16} />
        <span className="page-title">Strategies</span>
      </div>

      <div className="strat-tab-bar">
        <button className={`strat-tab-btn${tab === 'playbook' ? ' active' : ''}`} onClick={() => setTab('playbook')}>
          Playbook
        </button>
        <button className={`strat-tab-btn${tab === 'log' ? ' active' : ''}`} onClick={() => setTab('log')}>
          Log
          {observations.length > 0 && <span className="strat-tab-count">{observations.length}</span>}
        </button>
      </div>

      {tab === 'playbook' && (
        <PlaybookView
          strategies={strategies}
          observations={observations}
          onAddStrategy={() => setStratModal({ mode: 'add', parentId: null })}
          onEditStrategy={strat => setStratModal({ mode: 'edit', strat })}
          onDeleteStrategy={handleDeleteStrat}
          onAddVariant={base => setStratModal({ mode: 'add', parentId: base.id })}
          onAddObs={defaultStratId => setObsModal({ mode: 'add', defaultStratId })}
        />
      )}

      {tab === 'log' && (
        <LogView
          observations={observations}
          strategies={strategies}
          trades={trades}
          onAddObs={defaultStratId => setObsModal({ mode: 'add', defaultStratId })}
          onEditObs={obs => setObsModal({ mode: 'edit', obs })}
          onDeleteObs={handleDeleteObs}
        />
      )}

      {stratModal && (
        <StrategyModal
          mode={stratModal.mode}
          strat={stratModal.strat}
          parentId={stratModal.parentId}
          onSave={handleSaveStrat}
          onClose={() => setStratModal(null)}
        />
      )}

      {obsModal && (
        <ObsModal
          mode={obsModal.mode}
          obs={obsModal.obs}
          strategies={strategies}
          trades={trades}
          defaultStratId={obsModal.defaultStratId}
          onSave={handleSaveObs}
          onClose={() => setObsModal(null)}
        />
      )}

      {obsReceipt && (
        <ObsReceiptModal
          obsId={obsReceipt.id}
          obsName={obsReceipt.name}
          onDone={() => setObsReceipt(null)}
        />
      )}
    </div>
  )
}
