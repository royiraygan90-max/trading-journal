import React, { useState, useRef, useEffect } from 'react'
import { Tag, Plus, Trash2, Check } from 'lucide-react'

const PRESET_COLORS = [
  '#4f9cf9', '#a78bfa', '#f59e0b', '#2bd97c', '#ef5e5e',
  '#f97316', '#ec4899', '#14b8a6', '#8a9bb0', '#f5b942',
]

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

function TagRow({ tag, onUpdate, onDelete }) {
  const [editing, setEditing]   = useState(false)
  const [label,   setLabel]     = useState(tag.label)
  const inputRef                = useRef(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function commitLabel() {
    setEditing(false)
    const trimmed = label.trim()
    if (trimmed && trimmed !== tag.label) {
      onUpdate(tag.id, { label: trimmed, color: tag.color })
    } else {
      setLabel(tag.label)
    }
  }

  function changeColor(color) {
    onUpdate(tag.id, { label: tag.label, color })
  }

  const canDelete = tag.count === 0

  return (
    <div className="tag-mgmt-row">
      <div className="tag-mgmt-dot" style={{ background: tag.color }} />

      {editing ? (
        <input
          ref={inputRef}
          className="tag-mgmt-input"
          value={label}
          onChange={e => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={e => {
            if (e.key === 'Enter') commitLabel()
            if (e.key === 'Escape') { setLabel(tag.label); setEditing(false) }
          }}
        />
      ) : (
        <span className="tag-mgmt-label" onClick={() => setEditing(true)} title="Click to rename">
          <span className="tag-pill"
            style={{ background: tag.color + '22', color: tag.color, border: `1px solid ${tag.color}44` }}>
            {tag.label}
          </span>
        </span>
      )}

      <ColorSwatches selected={tag.color} onSelect={changeColor} />

      <span className="tag-mgmt-count">
        {tag.count > 0 ? `${tag.count} trade${tag.count === 1 ? '' : 's'}` : 'Unused'}
      </span>

      <button
        className="btn-icon tag-mgmt-delete"
        onClick={() => canDelete && onDelete(tag.id)}
        disabled={!canDelete}
        title={canDelete ? 'Delete tag' : 'Cannot delete — tag is in use'}
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

export default function TagsPage({ allTags, onAdd, onUpdate, onDelete }) {
  const [newLabel,  setNewLabel]  = useState('')
  const [newColor,  setNewColor]  = useState(PRESET_COLORS[0])
  const [showForm,  setShowForm]  = useState(false)

  async function handleAdd() {
    const t = newLabel.trim()
    if (!t) return
    await onAdd({ label: t, color: newColor })
    setNewLabel('')
    setNewColor(PRESET_COLORS[0])
    setShowForm(false)
  }

  return (
    <div className="page-section">
      <div className="page-header">
        <Tag size={16} />
        <span className="page-title">Tags</span>
        <button
          className="btn btn-primary btn-sm"
          style={{ marginLeft: 'auto' }}
          onClick={() => setShowForm(v => !v)}
        >
          <Plus size={13} /> New Tag
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ maxWidth: 560, marginBottom: 16 }}>
          <div className="card-header"><div className="card-title">Create Tag</div></div>
          <div className="card-body" style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Label</label>
              <input
                className="form-input"
                placeholder="e.g. Breakout"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                autoFocus
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Color</label>
              <ColorSwatches selected={newColor} onSelect={setNewColor} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={handleAdd} disabled={!newLabel.trim()}>
                <Check size={13} /> Create
              </button>
              <button className="btn btn-secondary" onClick={() => { setShowForm(false); setNewLabel('') }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ maxWidth: 720 }}>
        <div className="card-header">
          <div className="card-title">All Tags ({allTags.length})</div>
        </div>
        {allTags.length === 0 ? (
          <div className="empty-state"><p>No tags yet. Click "New Tag" to create one.</p></div>
        ) : (
          <div className="tag-mgmt-list">
            {allTags.map(tag => (
              <TagRow
                key={tag.id}
                tag={tag}
                onUpdate={onUpdate}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
