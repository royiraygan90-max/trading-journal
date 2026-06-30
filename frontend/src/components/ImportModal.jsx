import React, { useRef, useState } from 'react'
import { X, Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react'

export default function ImportModal({ accounts, selectedAccountId, onClose, onImported }) {
  const fileRef   = useRef(null)
  const [file,      setFile]      = useState(null)
  const [accountId, setAccountId] = useState(
    (selectedAccountId && selectedAccountId !== 'all') ? selectedAccountId : ''
  )
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState(null)
  const [error,   setError]   = useState(null)

  function pickFile(f) {
    if (!f) return
    setFile(f)
    setResult(null)
    setError(null)
  }

  async function handleImport() {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)

    const fd = new FormData()
    fd.append('file', file)
    if (accountId) fd.append('account_id', accountId)

    try {
      const res  = await fetch('/api/import/csv', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import failed')
      setResult(data)
      if (data.imported > 0) onImported()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 460 }}>

        <div className="modal-header">
          <span className="modal-title">
            <Upload size={15} />
            Import from Tradovate
          </span>
          <button className="modal-close" onClick={onClose}><X size={14} /></button>
        </div>

        <div className="modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Drop zone */}
          <div
            className="import-dropzone"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); pickFile(e.dataTransfer.files?.[0]) }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={e => pickFile(e.target.files?.[0])}
            />
            <FileText size={28} style={{ color: 'var(--text-3)', marginBottom: 8 }} />
            {file
              ? <span style={{ color: 'var(--text-0)', fontWeight: 600, fontSize: '0.88rem' }}>{file.name}</span>
              : <>
                  <span style={{ color: 'var(--text-1)', fontSize: '0.88rem' }}>
                    גרור לכאן או <u style={{ cursor: 'pointer' }}>בחר קובץ</u>
                  </span>
                  <span style={{ color: 'var(--text-3)', fontSize: '0.75rem', marginTop: 4 }}>
                    Tradovate → Orders export (.csv)
                  </span>
                </>
            }
          </div>

          {/* Account selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-2)', fontWeight: 500 }}>
              שייך לחשבון (אופציונלי)
            </label>
            <select
              className="header-input"
              style={{ width: '100%', padding: '7px 10px' }}
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
            >
              <option value="">— ללא חשבון —</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          {/* How-to hint */}
          {!result && !error && (
            <div style={{
              background: 'var(--bg-3)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              fontSize: '0.77rem',
              color: 'var(--text-3)',
              lineHeight: 1.6,
            }}>
              <strong style={{ color: 'var(--text-2)' }}>איך לייצא מ-Tradovate:</strong><br />
              Dashboard → Orders → סנן תאריך → Export
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`import-result ${result.imported > 0 ? 'success' : 'warn'}`}>
              <CheckCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontWeight: 600 }}>
                  {result.imported} עסקאות יובאו בהצלחה
                  {result.skipped > 0 && ` · ${result.skipped} דולגו`}
                </div>
                {result.errors?.length > 0 && (
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {result.errors.map((e, i) => (
                      <span key={i} style={{ fontSize: '0.74rem', opacity: 0.8 }}>{e}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="import-result error">
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
          <button
            className="btn-add-trade"
            onClick={handleImport}
            disabled={!file || loading}
            style={{ opacity: (!file || loading) ? 0.5 : 1 }}
          >
            {loading ? 'מייבא…' : 'ייבא עסקאות'}
          </button>
        </div>

      </div>
    </div>
  )
}
