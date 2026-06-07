import React, { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Edit2, Trash2, Brain, Save, Image as ImageIcon,
  BookOpen, BarChart2, ChevronLeft, ChevronRight,
  Star, TrendingUp, Calendar, Upload, ExternalLink,
} from 'lucide-react'
import { fmt, parseTags } from '../utils.jsx'

function Lightbox({ images, idx, onClose, onNav }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && idx > 0) onNav(idx - 1)
      if (e.key === 'ArrowRight' && idx < images.length - 1) onNav(idx + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [idx, images.length, onClose, onNav])

  return createPortal(
    <div className="lightbox-backdrop" onClick={onClose}>
      <button className="lightbox-close" onClick={e => { e.stopPropagation(); onClose() }}>
        <X size={20} />
      </button>

      {images.length > 1 && idx > 0 && (
        <button className="lightbox-nav lightbox-nav-left" onClick={e => { e.stopPropagation(); onNav(idx - 1) }}>
          <ChevronLeft size={24} />
        </button>
      )}

      <img
        className="lightbox-img"
        src={images[idx]}
        alt="chart screenshot"
        onClick={e => e.stopPropagation()}
      />

      {images.length > 1 && idx < images.length - 1 && (
        <button className="lightbox-nav lightbox-nav-right" onClick={e => { e.stopPropagation(); onNav(idx + 1) }}>
          <ChevronRight size={24} />
        </button>
      )}

      {images.length > 1 && (
        <div className="lightbox-counter">{idx + 1} / {images.length}</div>
      )}
    </div>,
    document.body,
  )
}

const EMOTIONS = [
  { id: 'calm',       label: 'Calm',       emoji: '😌' },
  { id: 'confident',  label: 'Confident',  emoji: '💪' },
  { id: 'focused',    label: 'Focused',    emoji: '🎯' },
  { id: 'anxious',    label: 'Anxious',    emoji: '😰' },
  { id: 'fomo',       label: 'FOMO',       emoji: '🚀' },
  { id: 'revenge',    label: 'Revenge',    emoji: '😤' },
  { id: 'bored',      label: 'Bored',      emoji: '😴' },
  { id: 'frustrated', label: 'Frustrated', emoji: '😫' },
]

function ScoreRow({ label, value, onChange }) {
  return (
    <div className="score-row">
      <div className="score-label">{label}</div>
      <div className="score-dots">
        {[1,2,3,4,5,6,7,8,9,10].map(n => (
          <button
            key={n}
            type="button"
            className={`score-dot${value >= n ? ' filled' : ''}`}
            onClick={() => onChange(value === n ? 0 : n)}
            title={`${n}/10`}
          />
        ))}
        <span className="score-value">{value > 0 ? `${value}/10` : '—'}</span>
      </div>
    </div>
  )
}

function StarRating({ value, onChange }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="star-rating">
      {[1,2,3,4,5].map(n => (
        <button
          key={n}
          type="button"
          className={`star-btn${(hover || value) >= n ? ' active' : ''}`}
          onClick={() => onChange(value === n ? 0 : n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
        >
          <Star size={22} fill={(hover || value) >= n ? 'currentColor' : 'none'} />
        </button>
      ))}
      {value > 0 && <span className="star-label">{value}/5</span>}
    </div>
  )
}

function PlanButtons({ value, onChange }) {
  return (
    <div className="plan-btn-group">
      {[
        { id: 'yes',       label: 'Yes',       cls: 'plan-yes' },
        { id: 'partially', label: 'Partially', cls: 'plan-partial' },
        { id: 'no',        label: 'No',        cls: 'plan-no' },
      ].map(o => (
        <button
          key={o.id}
          type="button"
          className={`plan-btn ${o.cls}${value === o.id ? ' active' : ''}`}
          onClick={() => onChange(value === o.id ? '' : o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function ScoreBar({ label, value, max = 10 }) {
  const pct = value > 0 ? (value / max) * 100 : 0
  return (
    <div className="score-bar-row">
      <div className="score-bar-label">{label}</div>
      <div className="score-bar-track">
        {value > 0 && <div className="score-bar-thumb" style={{ left: `${pct}%` }} />}
      </div>
      <div className="score-bar-value">{value > 0 ? `${value}/${max}` : '—'}</div>
    </div>
  )
}

function getWeekKey(datetime) {
  if (!datetime) return ''
  const d = new Date(datetime)
  const year = d.getFullYear()
  const startOfYear = new Date(year, 0, 1)
  const week = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7)
  return `week_note_${year}_W${String(week).padStart(2, '0')}`
}

function getWeekLabel(datetime) {
  if (!datetime) return ''
  const d = new Date(datetime)
  const mon = new Date(d)
  mon.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  const fri = new Date(mon)
  fri.setDate(mon.getDate() + 4)
  const opts = { month: 'short', day: 'numeric' }
  return `Week of ${mon.toLocaleDateString('en-US', opts)} – ${fri.toLocaleDateString('en-US', opts)}`
}

function detectPatterns(trades) {
  const patterns = []
  const emotionRules = [
    { id: 'fomo',      label: 'FOMO entries',   icon: '🚀' },
    { id: 'revenge',   label: 'Revenge trades',  icon: '😤' },
    { id: 'anxious',   label: 'Anxious trades',  icon: '😰' },
    { id: 'bored',     label: 'Boredom trades',  icon: '😴' },
  ]
  for (const ep of emotionRules) {
    const matched = trades.filter(t => t.emotion === ep.id)
    if (matched.length >= 2) {
      const total = matched.reduce((s, t) => s + (t.pnl || 0), 0)
      patterns.push({ icon: ep.icon, label: ep.label, subtitle: `${matched.length} trades`, pnl: total, positive: total >= 0 })
    }
  }
  const aPlus = trades.filter(t => (t.entry_score || 0) >= 8)
  if (aPlus.length >= 2) {
    const total = aPlus.reduce((s, t) => s + (t.pnl || 0), 0)
    patterns.push({ icon: '⭐', label: 'A+ Setups (entry ≥ 8)', subtitle: `${aPlus.length} trades`, pnl: total, positive: total >= 0 })
  }
  const noplan = trades.filter(t => t.plan_followed === 'no')
  if (noplan.length >= 2) {
    const total = noplan.reduce((s, t) => s + (t.pnl || 0), 0)
    patterns.push({ icon: '⚠️', label: 'Plan not followed', subtitle: `${noplan.length} trades`, pnl: total, positive: total >= 0 })
  }
  return patterns.slice(0, 4)
}

const EMPTY_JOURNAL = {
  strategy: '', plan: '', execution: '', emotion: '',
  entry_score: 0, exit_score: 0, risk_score: 0,
  plan_followed: '', biggest_mistake: '', would_do_differently: '',
  overall_rating: 0, lessons: '', chart_link: '',
}

export default function TradeDetail({
  trade, trades, allTags, instruments,
  onEdit, onDelete, onClose, onUpdate, onNavigate,
}) {
  const sortedByDate = useMemo(
    () => [...trades].sort((a, b) => new Date(b.datetime) - new Date(a.datetime)),
    [trades],
  )
  const idx       = sortedByDate.findIndex(t => t.id === trade.id)
  const prevTrade = idx < sortedByDate.length - 1 ? sortedByDate[idx + 1] : null
  const nextTrade = idx > 0 ? sortedByDate[idx - 1] : null

  const [activeTab,  setActiveTab]  = useState('journal')
  const [aiLoading,  setAiLoading]  = useState(false)
  const [aiResult,   setAiResult]   = useState(null)
  const [aiError,    setAiError]    = useState(null)
  const [saved,      setSaved]      = useState(false)
  const [weekNote,   setWeekNote]   = useState('')
  const [weekSaved,  setWeekSaved]  = useState(false)
  const [journal,    setJournal]    = useState(EMPTY_JOURNAL)
  const [images,      setImages]      = useState([])
  const [uploading,   setUploading]   = useState(false)
  const [dragOver,    setDragOver]    = useState(false)
  const [lightboxIdx, setLightboxIdx] = useState(null)
  const [journalTags, setJournalTags] = useState([])
  const fileInputRef = useRef(null)

  useEffect(() => {
    setJournal({
      strategy:             trade.strategy             || '',
      plan:                 trade.plan                 || '',
      execution:            trade.execution            || '',
      emotion:              trade.emotion              || '',
      entry_score:          trade.entry_score          || 0,
      exit_score:           trade.exit_score           || 0,
      risk_score:           trade.risk_score           || 0,
      plan_followed:        trade.plan_followed        || '',
      biggest_mistake:      trade.biggest_mistake      || '',
      would_do_differently: trade.would_do_differently || '',
      overall_rating:       trade.overall_rating       || 0,
      lessons:              trade.lessons              || '',
      chart_link:           trade.chart_link           || '',
    })
    setJournalTags(parseTags(trade.tags))
    setAiResult(null)
    setAiError(null)
    setSaved(false)
    const key = getWeekKey(trade.datetime)
    if (key) {
      fetch('/api/settings').then(r => r.json()).then(s => setWeekNote(s[key] || ''))
    }
    fetch(`/api/trades/${trade.id}/images`).then(r => r.json()).then(setImages).catch(() => setImages([]))
  }, [trade.id])

  function setJ(key, val) {
    setSaved(false)
    setJournal(prev => ({ ...prev, [key]: val }))
  }

  async function saveJournal() {
    await onUpdate(trade.id, { ...trade, ...journal, tags: journalTags })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function saveWeekNote() {
    const key = getWeekKey(trade.datetime)
    await fetch(`/api/settings/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: weekNote }),
    })
    setWeekSaved(true)
    setTimeout(() => setWeekSaved(false), 2000)
  }

  async function uploadFiles(files) {
    const valid = [...files].filter(f => f.size <= 8 * 1024 * 1024 && f.type.startsWith('image/'))
    if (!valid.length) return
    setUploading(true)
    const fd = new FormData()
    valid.forEach(f => fd.append('file', f))
    try {
      await fetch(`/api/trades/${trade.id}/images`, { method: 'POST', body: fd })
      const updated = await fetch(`/api/trades/${trade.id}/images`).then(r => r.json())
      setImages(updated)
    } finally {
      setUploading(false)
    }
  }

  async function deleteImage(url) {
    const filename = url.split('/').pop()
    await fetch(`/api/trades/${trade.id}/images/${filename}`, { method: 'DELETE' })
    setImages(prev => prev.filter(u => u !== url))
  }

  async function runAiCoach() {
    setAiLoading(true)
    setAiError(null)
    setAiResult(null)
    try {
      const res  = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trade: { ...trade, ...journal } }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'AI analysis failed')
      setAiResult(body.analysis)
    } catch (err) {
      setAiError(err.message)
    } finally {
      setAiLoading(false)
    }
  }

  const tags    = parseTags(trade.tags)
  const isWin   = trade.pnl > 0
  const isLoss  = trade.pnl < 0
  const pnlCls  = isWin ? 'positive' : isLoss ? 'negative' : ''
  const inst    = instruments.find(i => i.symbol === trade.symbol)
  const patterns = useMemo(() => detectPatterns(sortedByDate.slice(0, 30)), [sortedByDate])

  const weekTrades = useMemo(() => {
    if (!trade.datetime) return []
    const wk = getWeekKey(trade.datetime)
    return trades.filter(t => getWeekKey(t.datetime) === wk)
      .sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
  }, [trades, trade.datetime])
  const weekPnl     = weekTrades.reduce((s, t) => s + (t.pnl || 0), 0)
  const weekWins    = weekTrades.filter(t => t.pnl > 0).length
  const weekWinRate = weekTrades.length > 0 ? Math.round((weekWins / weekTrades.length) * 100) : 0

  function confirmDelete() {
    if (window.confirm(`Delete this ${trade.symbol} trade?`)) { onDelete(); onClose() }
  }

  const TABS = [
    { id: 'journal',  label: 'Journal',       Icon: BookOpen  },
    { id: 'analysis', label: 'Deep Analysis', Icon: BarChart2 },
    { id: 'images',   label: 'Images',        Icon: ImageIcon },
    { id: 'weekly',   label: 'Weekly Review', Icon: Calendar  },
  ]

  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <div className="trade-panel-large">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="tpl-header">
          <div className="tpl-header-left">
            <span className={`dir-badge ${trade.direction === 'Long' ? 'long' : 'short'}`}>
              {trade.direction}
            </span>
            <span className="tpl-symbol">{trade.symbol}</span>
            {inst && <span className="tpl-inst">{inst.name}</span>}
            <span className="tpl-date">{fmt.datetime(trade.datetime)}</span>
          </div>

          <div className="tpl-header-center">
            <div className={`tpl-pnl ${pnlCls}`}>{fmt.pnl(trade.pnl)}</div>
            <div className="tpl-meta">
              {trade.ticks    != null && <span>{fmt.ticks(trade.ticks)} ticks</span>}
              {trade.r_multiple != null && <span>{fmt.r(trade.r_multiple)}</span>}
            </div>
          </div>

          <div className="tpl-header-right">
            <button
              className="tpl-nav-btn"
              onClick={prevTrade && onNavigate ? () => onNavigate(prevTrade) : undefined}
              disabled={!prevTrade}
              title="Previous trade"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="tpl-nav-btn"
              onClick={nextTrade && onNavigate ? () => onNavigate(nextTrade) : undefined}
              disabled={!nextTrade}
              title="Next trade"
            >
              <ChevronRight size={16} />
            </button>
            <button className="btn btn-sm btn-secondary" onClick={onEdit}>
              <Edit2 size={12} /> Edit
            </button>
            <button className="btn btn-sm btn-danger" onClick={confirmDelete}>
              <Trash2 size={12} /> Delete
            </button>
            <button className="btn-icon panel-close" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="tpl-tabs">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`panel-tab${activeTab === id ? ' active' : ''}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="tpl-body">

          {/* JOURNAL */}
          {activeTab === 'journal' && (
            <div className="tpl-journal">
              <div className="journal-section">
                <label className="journal-label">Strategy / Setup</label>
                <input
                  className="form-input"
                  placeholder="e.g. Break and Retest, Opening Range Breakout…"
                  value={journal.strategy}
                  onChange={e => setJ('strategy', e.target.value)}
                />
              </div>

              <div className="journal-section">
                <label className="journal-label">Plan Before Entry</label>
                <textarea className="form-textarea" rows={3}
                  placeholder="What was your plan? Key levels, entry trigger, target and stop…"
                  value={journal.plan} onChange={e => setJ('plan', e.target.value)} />
              </div>

              <div className="journal-section">
                <label className="journal-label">Actual Execution</label>
                <textarea className="form-textarea" rows={3}
                  placeholder="What actually happened? Did you follow the plan?"
                  value={journal.execution} onChange={e => setJ('execution', e.target.value)} />
              </div>

              <div className="journal-section">
                <label className="journal-label">Emotional State</label>
                <div className="emotion-grid">
                  {EMOTIONS.map(em => (
                    <button key={em.id} type="button"
                      className={`emotion-btn${journal.emotion === em.id ? ' active' : ''}`}
                      onClick={() => setJ('emotion', journal.emotion === em.id ? '' : em.id)}>
                      <span className="emotion-emoji">{em.emoji}</span>
                      <span className="emotion-label">{em.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="journal-section">
                <label className="journal-label">Quality Scores</label>
                <div className="scores-block">
                  <ScoreRow label="Entry"     value={journal.entry_score} onChange={v => setJ('entry_score', v)} />
                  <ScoreRow label="Exit"      value={journal.exit_score}  onChange={v => setJ('exit_score', v)} />
                  <ScoreRow label="Risk Mgmt" value={journal.risk_score}  onChange={v => setJ('risk_score', v)} />
                </div>
              </div>

              <div className="journal-section">
                <label className="journal-label">Did I Follow My Plan?</label>
                <PlanButtons value={journal.plan_followed} onChange={v => setJ('plan_followed', v)} />
              </div>

              <div className="journal-section">
                <label className="journal-label">Biggest Mistake</label>
                <textarea className="form-textarea" rows={2}
                  placeholder="What was your biggest mistake in this trade?"
                  value={journal.biggest_mistake} onChange={e => setJ('biggest_mistake', e.target.value)} />
              </div>

              <div className="journal-section">
                <label className="journal-label">What Would I Do Differently?</label>
                <textarea className="form-textarea" rows={2}
                  placeholder="If you could redo this trade, what would you change?"
                  value={journal.would_do_differently} onChange={e => setJ('would_do_differently', e.target.value)} />
              </div>

              <div className="journal-section">
                <label className="journal-label">Tags</label>
                <div className="journal-tags-row">
                  {journalTags.map(tagId => {
                    const meta = allTags.find(t => t.id === tagId)
                    if (!meta) return null
                    return (
                      <span key={tagId} className="tag-pill tag-pill-removable"
                        style={{ background: meta.color + '22', color: meta.color, border: `1px solid ${meta.color}44` }}>
                        {meta.label}
                        <button type="button" className="tag-pill-x"
                          onClick={() => setJournalTags(prev => prev.filter(id => id !== tagId))}>
                          <X size={10} />
                        </button>
                      </span>
                    )
                  })}
                  {allTags.filter(t => !journalTags.includes(t.id)).length > 0 && (
                    <select
                      className="tag-add-select"
                      value=""
                      onChange={e => {
                        if (e.target.value) setJournalTags(prev => [...prev, e.target.value])
                        e.target.value = ''
                      }}
                    >
                      <option value="">+ Add tag…</option>
                      {allTags.filter(t => !journalTags.includes(t.id)).map(t => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="journal-section">
                <label className="journal-label">Post-Trade Lessons</label>
                <textarea className="form-textarea" rows={2}
                  placeholder="What did you learn from this trade?"
                  value={journal.lessons} onChange={e => setJ('lessons', e.target.value)} />
              </div>

              <div className="journal-section">
                <label className="journal-label">Overall Rating</label>
                <StarRating value={journal.overall_rating} onChange={v => setJ('overall_rating', v)} />
              </div>

              <button className={`btn tpl-save-btn${saved ? ' btn-saved' : ''}`} onClick={saveJournal}>
                <Save size={15} /> {saved ? 'Saved ✓' : 'Save Journal'}
              </button>
            </div>
          )}

          {/* DEEP ANALYSIS */}
          {activeTab === 'analysis' && (
            <div className="tpl-analysis">
              <div className="tpl-analysis-left">
                <div className="analysis-section">
                  <div className="analysis-label">Trade Metrics</div>
                  <div className="analysis-grid tpl-metrics-grid">
                    {[
                      { label: 'Entry',      value: fmt.num(trade.entry, 2),  cls: '' },
                      { label: 'Exit',       value: fmt.num(trade.exit, 2),   cls: '' },
                      { label: 'Quantity',   value: trade.quantity,           cls: '' },
                      { label: 'Ticks',      value: trade.ticks      != null ? fmt.ticks(trade.ticks)      : '—', cls: pnlCls },
                      { label: 'R-Multiple', value: trade.r_multiple != null ? fmt.r(trade.r_multiple)     : '—', cls: pnlCls },
                      { label: 'Commission', value: fmt.currency(trade.commission || 0), cls: 'negative' },
                    ].map(({ label, value, cls }) => (
                      <div key={label} className="analysis-field">
                        <div className="af-label">{label}</div>
                        <div className={`af-value ${cls}`}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="analysis-section">
                  <div className="analysis-label">Execution Scores</div>
                  <div className="score-bars-block">
                    <ScoreBar label="Entry Quality" value={journal.entry_score} />
                    <ScoreBar label="Exit Quality"  value={journal.exit_score} />
                    <ScoreBar label="Risk Mgmt"     value={journal.risk_score} />
                  </div>
                </div>

                <div className="analysis-section">
                  <div className="analysis-label">Did I Follow My Plan?</div>
                  <PlanButtons value={journal.plan_followed} onChange={v => setJ('plan_followed', v)} />
                </div>

                {(journal.biggest_mistake || journal.would_do_differently) && (
                  <div className="analysis-section">
                    {journal.biggest_mistake && (
                      <>
                        <div className="analysis-label">Biggest Mistake</div>
                        <div className="analysis-notes">{journal.biggest_mistake}</div>
                      </>
                    )}
                    {journal.would_do_differently && (
                      <>
                        <div className="analysis-label" style={{ marginTop: 12 }}>Would Do Differently</div>
                        <div className="analysis-notes">{journal.would_do_differently}</div>
                      </>
                    )}
                  </div>
                )}

                <div className="analysis-section">
                  <div className="analysis-label">Overall Rating</div>
                  <StarRating value={journal.overall_rating} onChange={v => setJ('overall_rating', v)} />
                </div>

                {tags.length > 0 && (
                  <div className="analysis-section">
                    <div className="analysis-label">Tags</div>
                    <div className="analysis-tags">
                      {tags.map(tagId => {
                        const meta = allTags.find(t => t.id === tagId)
                        if (!meta) return null
                        return (
                          <span key={tagId} className="tag-pill" style={{
                            background: meta.color + '22', color: meta.color,
                            border: `1px solid ${meta.color}44`,
                          }}>
                            {meta.label}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}

                {trade.notes && (
                  <div className="analysis-section">
                    <div className="analysis-label">Notes</div>
                    <div className="analysis-notes">{trade.notes}</div>
                  </div>
                )}
              </div>

              <div className="tpl-analysis-right">
                <div className="ai-coach-card">
                  <div className="ai-coach-header">
                    <Brain size={15} /> AI Trade Analysis
                  </div>
                  {(aiResult || aiError) && (
                    <div className={`ai-result-body${aiError ? ' ai-result-error' : ''}`}>
                      {aiError || aiResult}
                    </div>
                  )}
                  <button className="btn tpl-analyze-btn" onClick={runAiCoach} disabled={aiLoading}>
                    <Brain size={14} /> {aiLoading ? 'Analyzing…' : 'Analyze this trade'}
                  </button>
                </div>

                {patterns.length > 0 && (
                  <div className="pattern-detection">
                    <div className="pattern-title"><TrendingUp size={14} /> Pattern Detection</div>
                    <div className="pattern-subtitle">Last 30 trades</div>
                    <div className="pattern-list">
                      {patterns.map((p, i) => (
                        <div key={i} className={`pattern-card ${p.positive ? 'pos' : 'neg'}`}>
                          <div className="pattern-icon">{p.icon}</div>
                          <div className="pattern-info">
                            <div className="pattern-label">{p.label}</div>
                            <div className="pattern-sub">{p.subtitle}</div>
                          </div>
                          <div className={`pattern-pnl ${p.positive ? 'positive' : 'negative'}`}>
                            {fmt.pnl(p.pnl)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* IMAGES */}
          {activeTab === 'images' && (
            <div className="tpl-images">
              {/* hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                multiple
                style={{ display: 'none' }}
                onChange={e => { uploadFiles(e.target.files); e.target.value = '' }}
              />

              {/* drop zone */}
              <div
                className={`drop-zone${dragOver ? ' drag-over' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files) }}
              >
                <Upload size={36} style={{ opacity: dragOver ? 0.7 : 0.3 }} />
                <p>{uploading ? 'Uploading…' : 'Drag & drop chart screenshots here'}</p>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-2)' }}>PNG, JPG, GIF, WebP — up to 8 MB each</p>
                <button
                  className="btn btn-secondary"
                  style={{ marginTop: 8 }}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  Browse Files
                </button>
              </div>

              {/* thumbnails */}
              {images.length > 0 && (
                <div className="image-thumbs">
                  {images.map((url, i) => (
                    <div key={url} className="image-thumb">
                      <img
                        src={url}
                        alt="chart screenshot"
                        onClick={() => setLightboxIdx(i)}
                      />
                      <button
                        className="image-thumb-delete"
                        title="Remove image"
                        onClick={() => deleteImage(url)}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="journal-section">
                <label className="journal-label">TradingView Chart Link</label>
                <div className="chart-link-row">
                  <input className="form-input" style={{ flex: 1 }}
                    placeholder="https://www.tradingview.com/chart/…"
                    value={journal.chart_link}
                    onChange={e => setJ('chart_link', e.target.value)} />
                  {journal.chart_link && (
                    <a href={journal.chart_link} target="_blank" rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }}>
                      <ExternalLink size={12} /> Open
                    </a>
                  )}
                </div>
              </div>

              <div className="replay-section">
                <div className="analysis-label" style={{ marginBottom: 10 }}>Replay &amp; Markup</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary">Add Annotation</button>
                  <button className="btn btn-secondary">Export Trade Card</button>
                </div>
              </div>

              <button className={`btn tpl-save-btn${saved ? ' btn-saved' : ''}`} onClick={saveJournal}>
                <Save size={15} /> {saved ? 'Saved ✓' : 'Save'}
              </button>
            </div>
          )}

          {/* WEEKLY REVIEW */}
          {activeTab === 'weekly' && (
            <div className="tpl-weekly">
              <div className="weekly-title">{getWeekLabel(trade.datetime)}</div>

              <div className="weekly-stats">
                <div className={`weekly-stat ${weekPnl >= 0 ? 'positive' : 'negative'}`}>
                  <div className="weekly-stat-label">Week P&L</div>
                  <div className="weekly-stat-value">{fmt.pnl(weekPnl)}</div>
                </div>
                <div className="weekly-stat">
                  <div className="weekly-stat-label">Win Rate</div>
                  <div className="weekly-stat-value">{weekWinRate}%</div>
                </div>
                <div className="weekly-stat">
                  <div className="weekly-stat-label">Trades</div>
                  <div className="weekly-stat-value">{weekTrades.length}</div>
                </div>
                <div className="weekly-stat">
                  <div className="weekly-stat-label">Wins / Losses</div>
                  <div className="weekly-stat-value">
                    <span className="positive">{weekWins}</span>
                    {' / '}
                    <span className="negative">{weekTrades.length - weekWins}</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="analysis-label" style={{ marginBottom: 8 }}>Trades this week</div>
                <div className="weekly-trades">
                  {weekTrades.map(t => (
                    <div key={t.id} className={`weekly-trade-row${t.id === trade.id ? ' current' : ''}`}>
                      <span className="wtd-dt">{fmt.datetime(t.datetime)}</span>
                      <span className={`dir-badge ${t.direction === 'Long' ? 'long' : 'short'}`}
                        style={{ padding: '1px 6px', fontSize: '0.65rem' }}>
                        {t.direction}
                      </span>
                      <span className="wtd-sym">{t.symbol}</span>
                      <span className={`wtd-pnl ${t.pnl > 0 ? 'positive' : t.pnl < 0 ? 'negative' : ''}`}>
                        {fmt.pnl(t.pnl)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="journal-section">
                <label className="journal-label">Weekly Reflection</label>
                <textarea className="form-textarea" rows={7}
                  placeholder="How did this week go overall? Key lessons, themes, what to focus on next week…"
                  value={weekNote} onChange={e => setWeekNote(e.target.value)} />
              </div>

              <button className={`btn tpl-save-btn${weekSaved ? ' btn-saved' : ''}`} onClick={saveWeekNote}>
                <Save size={15} /> {weekSaved ? 'Saved ✓' : 'Save Weekly Review'}
              </button>
            </div>
          )}

        </div>
      </div>

      {lightboxIdx !== null && (
        <Lightbox
          images={images}
          idx={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onNav={setLightboxIdx}
        />
      )}
    </>
  )
}
