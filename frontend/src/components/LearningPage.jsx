import React, { useState, useEffect, useRef } from 'react'
import {
  GraduationCap, Plus, Trash2, Pencil, ChevronDown, ChevronRight,
  Link2, X, Upload, Video, Save, ExternalLink,
} from 'lucide-react'
import { Lightbox } from './TradeDetail.jsx'

const STATUSES = [
  { value: 'to_learn', label: 'To Learn', color: '#8a9bb0' },
  { value: 'learning', label: 'Learning', color: '#fbbf24' },
  { value: 'mastered', label: 'Mastered', color: '#2bd97c' },
]

function statusMeta(value) {
  return STATUSES.find(s => s.value === value) || STATUSES[0]
}

function extractYoutubeId(url) {
  const m = (url || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/)
  return m ? m[1] : null
}

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

function TopicCard({ topic, expanded, onToggle, onUpdate, onDelete }) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft,   setTitleDraft]   = useState(topic.title)

  const [notes,      setNotes]      = useState(topic.notes || '')
  const [notesSaved,  setNotesSaved] = useState(false)

  const [linkUrl,   setLinkUrl]   = useState('')
  const [linkTitle, setLinkTitle] = useState('')

  const [images,    setImages]    = useState([])
  const [uploading, setUploading] = useState(false)
  const [dragOver,  setDragOver]  = useState(false)
  const [lightboxIdx, setLightboxIdx] = useState(null)

  const [videos,         setVideos]         = useState([])
  const [videoUploading, setVideoUploading] = useState(false)

  const mediaLoaded  = useRef(false)
  const fileInputRef  = useRef(null)
  const videoInputRef = useRef(null)

  useEffect(() => {
    setNotes(topic.notes || '')
  }, [topic.id])

  useEffect(() => {
    if (!expanded || mediaLoaded.current) return
    mediaLoaded.current = true
    fetch(`/api/learning-topics/${topic.id}/images`).then(r => r.json()).then(setImages).catch(() => setImages([]))
    fetch(`/api/learning-topics/${topic.id}/videos`).then(r => r.json()).then(setVideos).catch(() => setVideos([]))
  }, [expanded, topic.id])

  function saveTitle() {
    const title = titleDraft.trim()
    setEditingTitle(false)
    if (title && title !== topic.title) onUpdate(topic.id, { title })
    else setTitleDraft(topic.title)
  }

  async function saveNotes() {
    await onUpdate(topic.id, { notes })
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 1500)
  }

  function addLink() {
    const url = linkUrl.trim()
    if (!url) return
    const newLinks = [...(topic.links || []), { id: `l_${Date.now()}`, url, title: linkTitle.trim() }]
    onUpdate(topic.id, { links: newLinks })
    setLinkUrl('')
    setLinkTitle('')
  }

  function removeLink(id) {
    onUpdate(topic.id, { links: (topic.links || []).filter(l => l.id !== id) })
  }

  async function uploadFiles(files) {
    const valid = [...files].filter(f => f.size <= 8 * 1024 * 1024 && f.type.startsWith('image/'))
    if (!valid.length) return
    setUploading(true)
    const fd = new FormData()
    valid.forEach(f => fd.append('file', f))
    try {
      await fetch(`/api/learning-topics/${topic.id}/images`, { method: 'POST', body: fd })
      const updated = await fetch(`/api/learning-topics/${topic.id}/images`).then(r => r.json())
      setImages(updated)
    } finally {
      setUploading(false)
    }
  }

  async function deleteImage(url) {
    const filename = url.split('/').pop()
    await fetch(`/api/learning-topics/${topic.id}/images/${filename}`, { method: 'DELETE' })
    setImages(prev => prev.filter(u => u !== url))
  }

  async function uploadVideo(file) {
    if (!file) return
    if (!file.type.startsWith('video/')) return
    if (file.size > 500 * 1024 * 1024) { alert('Video must be under 500 MB'); return }
    setVideoUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res  = await fetch(`/api/learning-topics/${topic.id}/videos`, { method: 'POST', body: fd })
      const data = await res.json()
      if (data.url) setVideos(prev => [...prev, data.url])
    } finally {
      setVideoUploading(false)
    }
  }

  async function deleteVideo(url) {
    const filename = url.split('/').pop()
    await fetch(`/api/learning-topics/${topic.id}/videos/${filename}`, { method: 'DELETE' })
    setVideos(prev => prev.filter(u => u !== url))
  }

  function confirmDelete(e) {
    e.stopPropagation()
    if (window.confirm(`Delete the "${topic.title}" topic? This removes its notes, links, images and videos.`)) {
      onDelete(topic.id)
    }
  }

  const meta = statusMeta(topic.status)

  return (
    <div className="strat-card">
      <div className="strat-card-header" onClick={onToggle}>
        {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}

        {editingTitle ? (
          <input
            autoFocus
            className="form-input learning-title-input"
            value={titleDraft}
            onClick={e => e.stopPropagation()}
            onChange={e => setTitleDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitleDraft(topic.title); setEditingTitle(false) } }}
            onBlur={saveTitle}
          />
        ) : (
          <span className="strat-card-name">{topic.title}</span>
        )}

        <span
          className="learning-status-badge"
          style={{ background: meta.color + '22', color: meta.color, border: `1px solid ${meta.color}44` }}
        >
          {meta.label}
        </span>

        <div className="strat-card-actions" onClick={e => e.stopPropagation()}>
          <button className="row-action-btn" title="Rename" onClick={() => setEditingTitle(true)}>
            <Pencil size={13} />
          </button>
          <button className="row-action-btn danger" title="Delete" onClick={confirmDelete}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="strat-card-body">
          <div className="journal-section">
            <label className="journal-label">Status</label>
            <SegmentedControl options={STATUSES} value={topic.status} onChange={v => onUpdate(topic.id, { status: v })} />
          </div>

          <div className="journal-section">
            <label className="journal-label">My Notes</label>
            <textarea
              className="form-textarea"
              rows={5}
              placeholder="What is this concept? What have you learned so far, key rules, examples…"
              value={notes}
              onChange={e => { setNotes(e.target.value); setNotesSaved(false) }}
            />
            <button className={`btn btn-secondary btn-sm learning-save-notes${notesSaved ? ' btn-saved' : ''}`} onClick={saveNotes}>
              <Save size={13} /> {notesSaved ? 'Saved ✓' : 'Save Notes'}
            </button>
          </div>

          <div className="journal-section">
            <label className="journal-label">Learning Resources</label>
            {(topic.links || []).length > 0 && (
              <div className="learning-links-list">
                {topic.links.map(link => {
                  const ytId = extractYoutubeId(link.url)
                  return (
                    <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="learning-link-card">
                      {ytId ? (
                        <img className="learning-link-thumb" src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt="" />
                      ) : (
                        <div className="learning-link-thumb learning-link-thumb-generic"><Link2 size={16} /></div>
                      )}
                      <div className="learning-link-info">
                        <div className="learning-link-title">{link.title || (ytId ? 'YouTube video' : link.url)}</div>
                        <div className="learning-link-url">{link.url}</div>
                      </div>
                      <ExternalLink size={12} className="learning-link-external" />
                      <button
                        className="learning-link-remove"
                        title="Remove link"
                        onClick={e => { e.preventDefault(); e.stopPropagation(); removeLink(link.id) }}
                      >
                        <X size={12} />
                      </button>
                    </a>
                  )
                })}
              </div>
            )}
            <div className="learning-add-link-row">
              <input
                className="form-input"
                placeholder="Paste a YouTube or article link…"
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addLink() }}
              />
              <input
                className="form-input"
                placeholder="Title (optional)"
                style={{ maxWidth: 200 }}
                value={linkTitle}
                onChange={e => setLinkTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addLink() }}
              />
              <button className="btn btn-secondary btn-sm" onClick={addLink} disabled={!linkUrl.trim()}>
                <Plus size={13} /> Add
              </button>
            </div>
          </div>

          <div className="journal-section">
            <label className="journal-label">My Images</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              multiple
              style={{ display: 'none' }}
              onChange={e => { uploadFiles(e.target.files); e.target.value = '' }}
            />
            <div
              className={`drop-zone${dragOver ? ' drag-over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files) }}
            >
              <Upload size={30} style={{ opacity: dragOver ? 0.7 : 0.3 }} />
              <p>{uploading ? 'Uploading…' : 'Drag & drop screenshots here'}</p>
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

            {images.length > 0 && (
              <div className="image-thumbs">
                {images.map((url, i) => (
                  <div key={url} className="image-thumb">
                    <img src={url} alt="learning" onClick={() => setLightboxIdx(i)} />
                    <button className="image-thumb-delete" title="Remove image" onClick={() => deleteImage(url)}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
            style={{ display: 'none' }}
            onChange={e => { uploadVideo(e.target.files?.[0]); e.target.value = '' }}
          />
          <div className="video-section">
            <div className="video-section-header">
              <Video size={14} />
              <span>My Videos</span>
              <button
                className="btn btn-secondary btn-sm"
                style={{ marginLeft: 'auto' }}
                onClick={() => videoInputRef.current?.click()}
                disabled={videoUploading}
              >
                {videoUploading ? 'Uploading…' : '+ Add Video'}
              </button>
            </div>

            {videos.length === 0 && !videoUploading && (
              <div className="video-empty" onClick={() => videoInputRef.current?.click()}>
                <Video size={22} style={{ opacity: 0.25, marginBottom: 6 }} />
                <span>Click to add a video you recorded about this topic</span>
                <span style={{ fontSize: '0.73rem', color: 'var(--text-3)' }}>MP4, WebM, MOV — up to 500 MB</span>
              </div>
            )}

            {videos.map(url => (
              <div key={url} className="video-player-wrap">
                <video src={url} controls className="video-player" preload="metadata" />
                <button className="video-delete-btn" title="Remove video" onClick={() => deleteVideo(url)}>
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {lightboxIdx !== null && (
        <Lightbox images={images} idx={lightboxIdx} onClose={() => setLightboxIdx(null)} onNav={setLightboxIdx} />
      )}
    </div>
  )
}

export default function LearningPage({ topics, onAddTopic, onUpdateTopic, onDeleteTopic }) {
  const [newTitle,   setNewTitle]   = useState('')
  const [expandedId, setExpandedId] = useState(null)

  async function handleAdd() {
    const title = newTitle.trim()
    if (!title) return
    const created = await onAddTopic({ title })
    setNewTitle('')
    if (created?.id) setExpandedId(created.id)
  }

  return (
    <div className="trades-section">
      <div className="trades-section-header">
        <div className="trades-section-title">
          Learning
          <span className="trade-count-badge">{topics.length}</span>
        </div>
      </div>

      <div className="learning-add-row">
        <input
          className="form-input"
          placeholder='Add a topic to learn… e.g. "Weekly Profile", "SMT"'
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
        />
        <button className="btn btn-primary" onClick={handleAdd} disabled={!newTitle.trim()}>
          <Plus size={14} /> Add Topic
        </button>
      </div>

      {topics.length === 0 ? (
        <div className="empty-state">
          <GraduationCap size={32} />
          <p>No topics yet. Add something you want to learn, then build your own notebook page for it — notes, links to videos you learned from, and your own screenshots and clips.</p>
        </div>
      ) : (
        <div className="strat-list">
          {topics.map(topic => (
            <TopicCard
              key={topic.id}
              topic={topic}
              expanded={expandedId === topic.id}
              onToggle={() => setExpandedId(prev => prev === topic.id ? null : topic.id)}
              onUpdate={onUpdateTopic}
              onDelete={id => { onDeleteTopic(id); setExpandedId(prev => prev === id ? null : prev) }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
