# Multi-Account Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add prop-firm account separation to the Trading Journal so trades can be filtered and assigned per account (live vs. challenge).

**Architecture:** New `accounts` table in SQLite with full CRUD in Flask; `account_id` FK column added to `trades` via idempotent ALTER TABLE; frontend adds an AccountsPage (modeled on TagsPage), an account switcher in Header, account field in the trade modal, an Account column in TradesTable, and account-based filtering wired into the existing `filterTrades` utility.

**Tech Stack:** Flask + SQLite (Python), React 18 + Vite (JSX), lucide-react icons, existing CSS class conventions.

## Global Constraints

- Flask runs on port 5001 (`app.py` line 421)
- DB path: `/app/data/trading_journal.db` (env: `DB_PATH`)
- Account ID format: `'acc_' + uuid4().hex[:8]`
- Seed accounts: `acc_mffu_live` (MFFU Live, live, #2bd97c) and `acc_mffu_challenge` (MFFU Challenge, challenge, #fb923c)
- Client-side filtering only — `filterTrades` in `utils.jsx` is the single filter path
- Follow existing CSS class naming: `tag-pill`, `header-input`, `sidebar-item`, `card`, `form-group`, `form-label`, `form-input`, `btn`, `btn-primary`, `btn-secondary`, `btn-icon`
- No new visual language; dark theme variables only (`--bg-*`, `--text-*`, `--border*`, `--green`, `--orange`, etc.)
- Do NOT push to remote after commit

---

### Task 1: Database — accounts table + trades.account_id migration

**Files:**
- Modify: `database.py`

**Interfaces:**
- Produces: `accounts` table with columns `id, name, firm, account_type, status, account_size, risk_per_trade, max_daily_loss, max_weekly_loss, color, sort_order, created_at`; `trades.account_id TEXT DEFAULT NULL`; two seed rows

- [ ] **Step 1: Add accounts table to the executescript block**

In `database.py`, inside the `c.executescript(...)` string (after the `tags` table, before the closing `'''`), add:

```sql
        CREATE TABLE IF NOT EXISTS accounts (
            id            TEXT PRIMARY KEY,
            name          TEXT NOT NULL,
            firm          TEXT DEFAULT '',
            account_type  TEXT DEFAULT 'live',
            status        TEXT DEFAULT 'active',
            account_size  REAL,
            risk_per_trade   REAL,
            max_daily_loss   REAL,
            max_weekly_loss  REAL,
            color         TEXT DEFAULT '#4f9cf9',
            sort_order    INTEGER DEFAULT 0,
            created_at    TEXT DEFAULT (datetime('now'))
        );
```

- [ ] **Step 2: Seed the two default accounts**

After the `# Seed tags` block (around line 96), add:

```python
    # Seed accounts
    c.execute('SELECT COUNT(*) FROM accounts')
    if c.fetchone()[0] == 0:
        c.executemany(
            'INSERT INTO accounts (id,name,firm,account_type,status,color,sort_order) VALUES (?,?,?,?,?,?,?)',
            [
                ('acc_mffu_live',      'MFFU Live',      'MFFU', 'live',      'active', '#2bd97c', 1),
                ('acc_mffu_challenge', 'MFFU Challenge', 'MFFU', 'challenge', 'active', '#fb923c', 2),
            ]
        )
```

- [ ] **Step 3: Add account_id column to trades via idempotent ALTER TABLE**

At the end of the `journal_cols` list (around line 137), append one more entry:

```python
        "ALTER TABLE trades ADD COLUMN account_id TEXT DEFAULT NULL",
```

- [ ] **Step 4: Verify migration runs clean**

```bash
cd /Users/royiraygan/Documents/Projects/trading-journal
python -c "from database import init_db; init_db(); print('OK')"
```

Expected output: `OK` (no exceptions)

- [ ] **Step 5: Commit**

```bash
git add database.py
git commit -m "feat: add accounts table and trades.account_id column"
```

---

### Task 2: Backend API — /api/accounts CRUD + update trade endpoints

**Files:**
- Modify: `app.py`

**Interfaces:**
- Consumes: `accounts` table from Task 1; existing `get_db()`, `row_to_dict()`, `uuid` import
- Produces:
  - `GET /api/accounts` → list of account dicts ordered by `sort_order`
  - `POST /api/accounts` → creates account, returns 201 with new row
  - `PUT /api/accounts/<id>` → updates account fields, returns updated row
  - `DELETE /api/accounts/<id>` → 409 if trades reference it, else deletes
  - `add_trade()` and `update_trade()` accept and persist `account_id`

- [ ] **Step 1: Add accounts CRUD routes after the tags section (after line 237)**

```python
# ── accounts ──────────────────────────────────────────────────────────────────
@app.route('/api/accounts', methods=['GET'])
def get_accounts():
    db   = get_db()
    rows = db.execute('SELECT * FROM accounts ORDER BY sort_order').fetchall()
    db.close()
    return jsonify([row_to_dict(r) for r in rows])


@app.route('/api/accounts', methods=['POST'])
def add_account():
    data = request.get_json()
    acc_id = 'acc_' + uuid.uuid4().hex[:8]
    db = get_db()
    db.execute(
        '''INSERT INTO accounts
               (id, name, firm, account_type, status, account_size,
                risk_per_trade, max_daily_loss, max_weekly_loss, color, sort_order)
           VALUES (:id,:name,:firm,:account_type,:status,:account_size,
                   :risk_per_trade,:max_daily_loss,:max_weekly_loss,:color,:sort_order)''',
        {
            'id':              acc_id,
            'name':            data.get('name', ''),
            'firm':            data.get('firm', ''),
            'account_type':    data.get('account_type', 'live'),
            'status':          data.get('status', 'active'),
            'account_size':    data.get('account_size'),
            'risk_per_trade':  data.get('risk_per_trade'),
            'max_daily_loss':  data.get('max_daily_loss'),
            'max_weekly_loss': data.get('max_weekly_loss'),
            'color':           data.get('color', '#4f9cf9'),
            'sort_order':      data.get('sort_order', 0),
        }
    )
    db.commit()
    row = db.execute('SELECT * FROM accounts WHERE id=?', (acc_id,)).fetchone()
    db.close()
    return jsonify(row_to_dict(row)), 201


@app.route('/api/accounts/<acc_id>', methods=['PUT'])
def update_account(acc_id):
    data = request.get_json()
    db = get_db()
    db.execute(
        '''UPDATE accounts SET
               name=:name, firm=:firm, account_type=:account_type, status=:status,
               account_size=:account_size, risk_per_trade=:risk_per_trade,
               max_daily_loss=:max_daily_loss, max_weekly_loss=:max_weekly_loss,
               color=:color, sort_order=:sort_order
           WHERE id=:id''',
        {
            'id':              acc_id,
            'name':            data.get('name', ''),
            'firm':            data.get('firm', ''),
            'account_type':    data.get('account_type', 'live'),
            'status':          data.get('status', 'active'),
            'account_size':    data.get('account_size'),
            'risk_per_trade':  data.get('risk_per_trade'),
            'max_daily_loss':  data.get('max_daily_loss'),
            'max_weekly_loss': data.get('max_weekly_loss'),
            'color':           data.get('color', '#4f9cf9'),
            'sort_order':      data.get('sort_order', 0),
        }
    )
    db.commit()
    row = db.execute('SELECT * FROM accounts WHERE id=?', (acc_id,)).fetchone()
    db.close()
    if row is None:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(row_to_dict(row))


@app.route('/api/accounts/<acc_id>', methods=['DELETE'])
def delete_account(acc_id):
    db = get_db()
    count = db.execute(
        'SELECT COUNT(*) FROM trades WHERE account_id=?', (acc_id,)
    ).fetchone()[0]
    if count > 0:
        db.close()
        return jsonify({'error': 'Account has trades assigned to it'}), 409
    db.execute('DELETE FROM accounts WHERE id=?', (acc_id,))
    db.commit()
    db.close()
    return jsonify({'ok': True})
```

- [ ] **Step 2: Update add_trade() to include account_id**

In `add_trade()`, add `account_id` to the INSERT column list and VALUES:

Change the INSERT statement's column list from ending at `...chart_link)` to:
```python
    db.execute('''
        INSERT INTO trades
            (datetime, symbol, direction, entry, exit, quantity,
             ticks, r_multiple, pnl, commission, notes, tags, has_screenshot,
             strategy, plan, execution, emotion,
             entry_score, exit_score, risk_score, plan_adherence, lessons,
             plan_followed, biggest_mistake, would_do_differently, overall_rating,
             chart_link, account_id)
        VALUES (:datetime,:symbol,:direction,:entry,:exit,:quantity,
                :ticks,:r_multiple,:pnl,:commission,:notes,:tags,:has_screenshot,
                :strategy,:plan,:execution,:emotion,
                :entry_score,:exit_score,:risk_score,:plan_adherence,:lessons,
                :plan_followed,:biggest_mistake,:would_do_differently,:overall_rating,
                :chart_link,:account_id)
    ''', {
        ...existing fields...,
        'account_id': data.get('account_id'),
    })
```

- [ ] **Step 3: Update update_trade() to include account_id**

In `update_trade()`, add to the SET clause:
```python
            account_id=:account_id
```
And in the params dict:
```python
        'account_id': data.get('account_id'),
```

- [ ] **Step 4: Smoke-test the API**

```bash
cd /Users/royiraygan/Documents/Projects/trading-journal
python -c "
import app as a
with a.app.test_client() as c:
    r = c.get('/api/accounts')
    import json
    accs = json.loads(r.data)
    assert len(accs) == 2, f'Expected 2 accounts, got {len(accs)}'
    assert accs[0]['id'] == 'acc_mffu_live'
    print('API OK:', [a[\"name\"] for a in accs])
"
```

Expected: `API OK: ['MFFU Live', 'MFFU Challenge']`

- [ ] **Step 5: Commit**

```bash
git add app.py
git commit -m "feat: accounts CRUD API + account_id on trades endpoints"
```

---

### Task 3: utils.jsx — accountId filter

**Files:**
- Modify: `frontend/src/utils.jsx`

**Interfaces:**
- Consumes: existing `filterTrades(trades, filters)` signature
- Produces: same function, now also checks `filters.accountId` against `t.account_id`

- [ ] **Step 1: Add the accountId check inside filterTrades**

In `filterTrades`, after the tags block (around line 198), add:

```js
    if (filters.accountId && filters.accountId !== 'all' && t.account_id !== filters.accountId) return false
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/utils.jsx
git commit -m "feat: add accountId filter to filterTrades"
```

---

### Task 4: AccountsPage.jsx — new accounts management page

**Files:**
- Create: `frontend/src/components/AccountsPage.jsx`

**Interfaces:**
- Consumes: `accounts` prop (array of account objects with `id, name, firm, account_type, status, account_size, color`); `onAdd(data)`, `onUpdate(id, data)`, `onDelete(id)` callbacks
- Produces: exported default `AccountsPage` component

- [ ] **Step 1: Create the file**

```jsx
import React, { useState, useRef, useEffect } from 'react'
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
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    name:         account.name,
    firm:         account.firm || '',
    account_type: account.account_type || 'live',
    status:       account.status || 'active',
    account_size: account.account_size ?? '',
    risk_per_trade:  account.risk_per_trade ?? '',
    max_daily_loss:  account.max_daily_loss ?? '',
    max_weekly_loss: account.max_weekly_loss ?? '',
    color:        account.color || '#4f9cf9',
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
          {account.firm && <span style={{ color: 'var(--text-2)', marginLeft: 6 }}>{account.firm}</span>}
        </span>
        <AccountTypeBadge type={account.account_type} />
        <span style={{ color: 'var(--text-2)', fontSize: 11, minWidth: 52, textAlign: 'center' }}>
          {account.status}
        </span>
        {account.account_size && (
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
              <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Firm</label>
              <input className="form-input" value={form.firm} onChange={e => set('firm', e.target.value)} />
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
              <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="form-grid">
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Account Size ($)</label>
              <input type="number" className="form-input" placeholder="e.g. 50000" value={form.account_size} onChange={e => set('account_size', e.target.value)} />
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
                <input type="number" className="form-input" placeholder="e.g. 200" value={form.risk_per_trade} onChange={e => set('risk_per_trade', e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Max Daily Loss ($)</label>
                <input type="number" className="form-input" placeholder="e.g. 500" value={form.max_daily_loss} onChange={e => set('max_daily_loss', e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Max Weekly Loss ($)</label>
                <input type="number" className="form-input" placeholder="e.g. 1000" value={form.max_weekly_loss} onChange={e => set('max_weekly_loss', e.target.value)} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!form.name.trim()}>
              <Check size={12} /> Save
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setOpen(false)}>Cancel</button>
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
      name:         newName.trim(),
      firm:         newFirm.trim(),
      account_type: newType,
      status:       newStatus,
      account_size:    newSize   !== '' ? parseFloat(newSize)   : null,
      risk_per_trade:  newRiskPT !== '' ? parseFloat(newRiskPT) : null,
      max_daily_loss:  newMaxDL  !== '' ? parseFloat(newMaxDL)  : null,
      max_weekly_loss: newMaxWL  !== '' ? parseFloat(newMaxWL)  : null,
      color: newColor,
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
                  <button type="button" className={`dir-toggle-btn long${newType === 'live' ? ' active' : ''}`} onClick={() => setNewType('live')}>Live</button>
                  <button type="button" className={`dir-toggle-btn short${newType === 'challenge' ? ' active' : ''}`} onClick={() => setNewType('challenge')}>Challenge</button>
                </div>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Status</label>
                <select className="form-select" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Account Size ($)</label>
                <input type="number" className="form-input" placeholder="e.g. 50000" value={newSize} onChange={e => setNewSize(e.target.value)} />
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
                  <input type="number" className="form-input" placeholder="e.g. 200" value={newRiskPT} onChange={e => setNewRiskPT(e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Max Daily Loss ($)</label>
                  <input type="number" className="form-input" placeholder="e.g. 500" value={newMaxDL} onChange={e => setNewMaxDL(e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Max Weekly Loss ($)</label>
                  <input type="number" className="form-input" placeholder="e.g. 1000" value={newMaxWL} onChange={e => setNewMaxWL(e.target.value)} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={handleAdd} disabled={!newName.trim()}>
                <Check size={13} /> Create
              </button>
              <button className="btn btn-secondary" onClick={() => { setShowForm(false); setNewName('') }}>
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/AccountsPage.jsx
git commit -m "feat: AccountsPage component"
```

---

### Task 5: Sidebar.jsx — add Accounts nav item

**Files:**
- Modify: `frontend/src/components/Sidebar.jsx`

**Interfaces:**
- Consumes: existing `NAV` array, lucide-react icon imports
- Produces: `accounts` nav item visible between Tags and Settings

- [ ] **Step 1: Add Wallet import and accounts nav entry**

Change the import line to add `Wallet`:
```js
import {
  LayoutDashboard, List, CalendarDays, BarChart2,
  Tag, Settings, Wallet,
} from 'lucide-react'
```

Add to the `NAV` array after `tags`:
```js
  { id: 'accounts',  label: 'Accounts',   icon: Wallet },
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Sidebar.jsx
git commit -m "feat: add Accounts nav item to sidebar"
```

---

### Task 6: App.jsx — accounts state, routing, API callbacks, filter wiring

**Files:**
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Consumes: `AccountsPage` component from Task 4; `/api/accounts` endpoints from Task 2; `filterTrades` now accepting `accountId` from Task 3
- Produces: `accounts`, `selectedAccountId` state; `addAccount`, `updateAccount`, `deleteAccount`, `refetchAccounts` callbacks; `accountId` in filters; view routing for `accounts`; passes `accounts`/`selectedAccountId`/`setSelectedAccountId` to `Header`; passes `accounts` to `Modals`; passes `accounts` to both `<TradesTable>` renders

- [ ] **Step 1: Add AccountsPage import**

After the `TagsPage` import add:
```js
import AccountsPage    from './components/AccountsPage.jsx'
```

- [ ] **Step 2: Add accounts state and selectedAccountId**

After the `allTags` state line, add:
```js
  const [accounts,         setAccounts]         = useState([])
  const [selectedAccountId, setSelectedAccountId] = useState(
    () => localStorage.getItem('selected_account') || 'all'
  )
```

- [ ] **Step 3: Persist selectedAccountId to localStorage**

After the `loadLayout` / `loadWidgetOrder` section, add a useEffect:
```js
  useEffect(() => {
    localStorage.setItem('selected_account', selectedAccountId)
  }, [selectedAccountId])
```

- [ ] **Step 4: Fetch accounts in the initial Promise.all**

Change the Promise.all block:
```js
    Promise.all([
      fetch('/api/trades').then(r => r.json()),
      fetch('/api/instruments').then(r => r.json()),
      fetch('/api/tags').then(r => r.json()),
      fetch('/api/checklist').then(r => r.json()),
      fetch('/api/settings').then(r => r.json()),
      fetch('/api/accounts').then(r => r.json()),
    ])
      .then(([t, instr, tags, cl, sett, accs]) => {
        setTrades(t)
        setInstruments(instr)
        setAllTags(tags)
        setChecklist(cl)
        setSettings(sett)
        setAccounts(accs)
        setLoading(false)
      })
```

- [ ] **Step 5: Add accountId to filters state and computed filteredTrades**

Change the `filters` initial state:
```js
  const [filters, setFilters] = useState({
    dateFrom: '', dateTo: '', symbol: '', direction: '', outcome: '', tags: [],
    accountId: selectedAccountId,
  })
```

Change the `filteredTrades` memo to merge in `selectedAccountId`:
```js
  const filteredTrades = useMemo(
    () => filterTrades(trades, { ...filters, accountId: selectedAccountId }),
    [trades, filters, selectedAccountId]
  )
```

- [ ] **Step 6: Add accounts API callbacks**

After `refetchTags` / `deleteTag`, add:
```js
  const refetchAccounts = useCallback(async () => {
    const r = await fetch('/api/accounts')
    setAccounts(await r.json())
  }, [])

  const addAccount = useCallback(async (data) => {
    await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    refetchAccounts()
  }, [refetchAccounts])

  const updateAccount = useCallback(async (id, data) => {
    await fetch(`/api/accounts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    refetchAccounts()
  }, [refetchAccounts])

  const deleteAccount = useCallback(async (id) => {
    const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' })
    if (res.ok) refetchAccounts()
    return res
  }, [refetchAccounts])
```

- [ ] **Step 7: Update Header props to include accounts**

Change the `<Header ...>` JSX:
```jsx
      <Header
        filters={filters}
        setFilters={setFilters}
        instruments={instruments}
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        onSelectAccount={setSelectedAccountId}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(v => !v)}
        onAddTrade={() => setShowAddModal(true)}
        onCustomize={() => setShowCustomize(true)}
        isEditMode={isEditMode}
        onEditLayout={enterEditMode}
        onSaveLayout={saveLayout}
        onCancelLayout={cancelLayout}
      />
```

- [ ] **Step 8: Update Modals props to include accounts**

Change the `<Modals ...>` JSX:
```jsx
        <Modals
          mode={editTrade ? 'edit' : 'add'}
          trade={editTrade}
          instruments={instruments}
          allTags={allTags}
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onSave={handleSaveTrade}
          onClose={handleCloseModal}
        />
```

- [ ] **Step 9: Pass accounts to both TradesTable renders**

In both `<TradesTable ...>` JSX blocks, add:
```jsx
                accounts={accounts}
```

- [ ] **Step 10: Add accounts view routing**

After the `activeView === 'tags'` block, add:
```jsx
          {activeView === 'accounts' && (
            <AccountsPage
              accounts={accounts}
              onAdd={addAccount}
              onUpdate={updateAccount}
              onDelete={deleteAccount}
            />
          )}
```

- [ ] **Step 11: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: wire accounts state, filtering, routing in App.jsx"
```

---

### Task 7: Header.jsx — account switcher dropdown

**Files:**
- Modify: `frontend/src/components/Header.jsx`

**Interfaces:**
- Consumes: new `accounts`, `selectedAccountId`, `onSelectAccount` props
- Produces: account switcher `<select>` placed between the logo button and the date filters; `hasFilters` updated to include `accountId`

- [ ] **Step 1: Update component signature and add the switcher**

Change the props destructuring:
```js
export default function Header({
  filters, setFilters,
  instruments,
  accounts, selectedAccountId, onSelectAccount,
  sidebarCollapsed, onToggleSidebar,
  onAddTrade, onCustomize,
  isEditMode, onEditLayout, onSaveLayout, onCancelLayout,
}) {
```

Update `hasFilters` to include the accountId check:
```js
  const hasFilters = filters.dateFrom || filters.dateTo || filters.symbol
    || filters.direction || filters.outcome || filters.tags?.length
    || (selectedAccountId && selectedAccountId !== 'all')
```

Update `clearFilters` to also reset the account:
```js
  function clearFilters() {
    setFilters({ dateFrom: '', dateTo: '', symbol: '', direction: '', outcome: '', tags: [] })
    onSelectAccount('all')
  }
```

Add the account switcher between the logo button and the `header-filters` div:
```jsx
      {/* Account switcher */}
      {accounts && accounts.length > 0 && (
        <div className="account-switcher">
          <select
            className="header-input account-select"
            value={selectedAccountId}
            onChange={e => onSelectAccount(e.target.value)}
          >
            <option value="all">All Accounts</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </select>
        </div>
      )}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Header.jsx
git commit -m "feat: account switcher dropdown in header"
```

---

### Task 8: Modals.jsx — account_id field in trade form

**Files:**
- Modify: `frontend/src/components/Modals.jsx`

**Interfaces:**
- Consumes: new `accounts` and `selectedAccountId` props; existing `DEFAULT_FORM`, `handleSubmit`, `onSave` payload
- Produces: `account_id` in form state; "Account" select in form UI; validation guard; `account_id` included in `onSave(...)` payload

- [ ] **Step 1: Add account_id to DEFAULT_FORM**

Change `DEFAULT_FORM`:
```js
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
```

- [ ] **Step 2: Update component signature**

```js
export default function Modals({ mode, trade, instruments, allTags, accounts, selectedAccountId, onSave, onClose }) {
```

- [ ] **Step 3: Populate account_id when editing, default it when adding**

In the `useEffect` that populates the form, update the `else` branch:
```js
    } else {
      const now = new Date()
      const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      const lastUsed = localStorage.getItem('last_used_account_id') || ''
      const defaultAcc = (selectedAccountId && selectedAccountId !== 'all')
        ? selectedAccountId
        : lastUsed
      setForm({ ...DEFAULT_FORM, datetime: local.toISOString().slice(0, 16), account_id: defaultAcc })
    }
```

In the `mode === 'edit'` branch, add to the setForm call:
```js
        account_id: trade.account_id || '',
```

- [ ] **Step 4: Add validation in handleSubmit**

Replace the existing validation block:
```js
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
```

- [ ] **Step 5: Add Account select field in the form (after the Symbol row)**

After the closing `</div>` of the first `form-grid` (the Date + Symbol row), add:
```jsx
            {/* Account */}
            <div className="form-group" style={{ marginTop: 14 }}>
              <label className="form-label">Account *</label>
              <select
                className="form-select"
                value={form.account_id}
                onChange={e => set('account_id', e.target.value)}
                required
              >
                <option value="">— Select account —</option>
                {(accounts || []).map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Modals.jsx
git commit -m "feat: account_id field in trade modal"
```

---

### Task 9: TradesTable.jsx — Account column

**Files:**
- Modify: `frontend/src/components/TradesTable.jsx`

**Interfaces:**
- Consumes: new `accounts` prop (array of account objects with `id, name, color`)
- Produces: "Account" column in COLUMNS; colored badge showing account name; `—` for null account_id

- [ ] **Step 1: Add accounts prop and helper**

Change the component signature:
```js
export default function TradesTable({
  trades, allTags, instruments, accounts,
  selectedTrade, onSelectTrade,
  onEditTrade, onDeleteTrade,
  sort, setSort,
}) {
```

Add a helper after `getTagMeta`:
```js
  function getAccountMeta(accountId) {
    return accounts?.find(a => a.id === accountId)
  }
```

- [ ] **Step 2: Add Account column to COLUMNS array**

Insert after the `symbol` entry:
```js
  { key: 'account',    label: 'Account',      sortable: false },
```

- [ ] **Step 3: Add account cell in the table row**

After the `<td className="td-symbol">` cell, add:
```jsx
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
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/TradesTable.jsx
git commit -m "feat: account column in trades table"
```

---

### Task 10: styles.css — minimal new CSS

**Files:**
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Produces: `.account-type-badge`, `.account-switcher`, `.header-input.account-select` styles

- [ ] **Step 1: Append new CSS at end of styles.css**

```css
/* ── Accounts ─────────────────────────────────────────────────────────────── */
.account-type-badge {
  display:       inline-flex;
  align-items:   center;
  padding:       2px 7px;
  border-radius: var(--radius-xs);
  font-size:     10px;
  font-weight:   600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  white-space:   nowrap;
}

.account-switcher {
  display:     flex;
  align-items: center;
  margin:      0 8px;
}

.header-input.account-select {
  min-width: 140px;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/styles.css
git commit -m "feat: account badge and switcher CSS"
```

---

### Task 11: Build & final verify

**Files:**
- No code changes

- [ ] **Step 1: Build the frontend**

```bash
cd /Users/royiraygan/Documents/Projects/trading-journal/frontend && npm run build
```

Expected: no errors; `dist/` written. Warnings about chunk size are acceptable.

- [ ] **Step 2: Verify DB migration runs clean**

```bash
cd /Users/royiraygan/Documents/Projects/trading-journal
python -c "from database import init_db; init_db(); print('DB OK')"
```

Expected: `DB OK`

- [ ] **Step 3: Verify seed accounts are present**

```bash
python -c "
from database import get_db
db = get_db()
rows = db.execute('SELECT id, name, account_type, color FROM accounts ORDER BY sort_order').fetchall()
for r in rows: print(dict(r))
db.close()
"
```

Expected output:
```
{'id': 'acc_mffu_live', 'name': 'MFFU Live', 'account_type': 'live', 'color': '#2bd97c'}
{'id': 'acc_mffu_challenge', 'name': 'MFFU Challenge', 'account_type': 'challenge', 'color': '#fb923c'}
```

- [ ] **Step 4: Final commit**

```bash
cd /Users/royiraygan/Documents/Projects/trading-journal
git add -A
git commit -m "feat: multi-account support (live/challenge separation)"
```

Expected: clean commit (all individual task commits already landed; this is a safety net for any unstaged leftovers).
