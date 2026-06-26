import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Pencil } from 'lucide-react'
import Header          from './components/Header.jsx'
import Sidebar         from './components/Sidebar.jsx'
import StatsBar        from './components/StatsBar.jsx'
import EquityChart     from './components/EquityChart.jsx'
import Widgets         from './components/Widgets.jsx'
import TradesTable     from './components/TradesTable.jsx'
import TradeDetail     from './components/TradeDetail.jsx'
import Modals          from './components/Modals.jsx'
import CustomizeDrawer from './components/CustomizeDrawer.jsx'
import TagsPage        from './components/TagsPage.jsx'
import AccountsPage    from './components/AccountsPage.jsx'
import SettingsPage    from './components/SettingsPage.jsx'
import { calculateStats, filterTrades, buildEquityData } from './utils.jsx'

const DEFAULT_WIDGET_ORDER = ['equity_curve', 'daily_pnl', 'win_rate', 'streak', 'checklist', 'calendar']

function loadWidgetOrder() {
  try {
    const saved = JSON.parse(localStorage.getItem('widget_order'))
    if (Array.isArray(saved) && saved.length > 0) return saved
  } catch {}
  return DEFAULT_WIDGET_ORDER
}

const DEFAULT_LAYOUT = [
  { i: 'equity_curve', x: 0, y: 0,  w: 12, h: 5, minW: 4, minH: 3 },
  { i: 'daily_pnl',    x: 0, y: 5,  w: 4,  h: 4, minW: 3, minH: 3 },
  { i: 'win_rate',     x: 4, y: 5,  w: 4,  h: 4, minW: 3, minH: 3 },
  { i: 'streak',       x: 8, y: 5,  w: 4,  h: 4, minW: 3, minH: 3 },
  { i: 'checklist',    x: 0, y: 9,  w: 6,  h: 5, minW: 3, minH: 3 },
  { i: 'calendar',     x: 6, y: 9,  w: 6,  h: 5, minW: 4, minH: 4 },
]

function loadLayout() {
  try {
    const saved = JSON.parse(localStorage.getItem('dashboard_layout'))
    if (Array.isArray(saved) && saved.length > 0) return saved
  } catch {}
  return DEFAULT_LAYOUT
}

export default function App() {
  // ── data state ─────────────────────────────────────────────────────────────
  const [trades,            setTrades]            = useState([])
  const [instruments,       setInstruments]       = useState([])
  const [allTags,           setAllTags]           = useState([])
  const [accounts,          setAccounts]          = useState([])
  const [checklist,         setChecklist]         = useState([])
  const [settings,          setSettings]          = useState({})
  const [loading,           setLoading]           = useState(true)
  const [error,             setError]             = useState(null)
  const [selectedAccountId, setSelectedAccountId] = useState(
    () => localStorage.getItem('selected_account') || 'all'
  )

  // ── ui state ───────────────────────────────────────────────────────────────
  const [selectedTrade,     setSelectedTrade]     = useState(null)
  const [filters,           setFilters]           = useState({ dateFrom: '', dateTo: '', symbol: '', direction: '', outcome: '', tags: [], accountId: 'all' })
  const [showAddModal,      setShowAddModal]      = useState(false)
  const [editTrade,         setEditTrade]         = useState(null)
  const [showCustomize,     setShowCustomize]     = useState(false)
  const [sidebarCollapsed,  setSidebarCollapsed]  = useState(false)
  const [activeView,        setActiveView]        = useState('dashboard')
  const [sort,              setSort]              = useState({ key: 'datetime', dir: 'desc' })
  const [widgetOrder,       setWidgetOrder]       = useState(loadWidgetOrder)
  const [savedLayout,       setSavedLayout]       = useState(loadLayout)
  const [workingLayout,     setWorkingLayout]     = useState(loadLayout)
  const [isEditMode,        setIsEditMode]        = useState(false)

  useEffect(() => {
    localStorage.setItem('selected_account', selectedAccountId)
  }, [selectedAccountId])

  // ── initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
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
      .catch(err => { setError(err.message); setLoading(false) })
  }, [])

  // ── computed ───────────────────────────────────────────────────────────────
  const filteredTrades = useMemo(
    () => filterTrades(trades, { ...filters, accountId: selectedAccountId }),
    [trades, filters, selectedAccountId]
  )

  const sortedTrades = useMemo(() => {
    const arr = [...filteredTrades]
    arr.sort((a, b) => {
      let av = a[sort.key], bv = b[sort.key]
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      if (av < bv) return sort.dir === 'asc' ? -1 : 1
      if (av > bv) return sort.dir === 'asc' ?  1 : -1
      return 0
    })
    return arr
  }, [filteredTrades, sort])

  const stats      = useMemo(() => calculateStats(filteredTrades), [filteredTrades])
  const equityData = useMemo(() => buildEquityData(filteredTrades), [filteredTrades])

  const visibleWidgets = useMemo(() => {
    try { return JSON.parse(settings.visible_widgets || '[]') }
    catch { return [] }
  }, [settings])

  // ── api helpers ────────────────────────────────────────────────────────────
  const refetchTrades = useCallback(async () => {
    const r = await fetch('/api/trades')
    setTrades(await r.json())
  }, [])

  const addTrade = useCallback(async (data) => {
    await fetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    refetchTrades()
  }, [refetchTrades])

  const updateTrade = useCallback(async (id, data) => {
    await fetch(`/api/trades/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    refetchTrades()
    setSelectedTrade(prev => prev?.id === id ? { ...prev, ...data, id } : prev)
  }, [refetchTrades])

  const deleteTrade = useCallback(async (id) => {
    await fetch(`/api/trades/${id}`, { method: 'DELETE' })
    if (selectedTrade?.id === id) setSelectedTrade(null)
    refetchTrades()
  }, [refetchTrades, selectedTrade])

  const updateSetting = useCallback(async (key, value) => {
    await fetch(`/api/settings/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })
    setSettings(prev => ({ ...prev, [key]: value }))
  }, [])

  const refetchTags = useCallback(async () => {
    const r = await fetch('/api/tags')
    setAllTags(await r.json())
  }, [])

  const addTag = useCallback(async (data) => {
    await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    refetchTags()
  }, [refetchTags])

  const updateTag = useCallback(async (id, data) => {
    await fetch(`/api/tags/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    refetchTags()
  }, [refetchTags])

  const deleteTag = useCallback(async (id) => {
    const res = await fetch(`/api/tags/${id}`, { method: 'DELETE' })
    if (res.ok) refetchTags()
    return res
  }, [refetchTags])

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

  const refetchChecklist = useCallback(async () => {
    const r = await fetch('/api/checklist')
    setChecklist(await r.json())
  }, [])

  const addChecklistItem = useCallback(async (text) => {
    await fetch('/api/checklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    refetchChecklist()
  }, [refetchChecklist])

  const updateChecklistItem = useCallback(async (id, data) => {
    await fetch(`/api/checklist/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    refetchChecklist()
  }, [refetchChecklist])

  const deleteChecklistItem = useCallback(async (id) => {
    await fetch(`/api/checklist/${id}`, { method: 'DELETE' })
    setChecklist(prev => prev.filter(i => i.id !== id))
  }, [])

  const resetChecklist = useCallback(async () => {
    const r = await fetch('/api/checklist/reset', { method: 'POST' })
    setChecklist(await r.json())
  }, [])

  const reorderChecklist = useCallback(async (newOrderedItems) => {
    setChecklist(newOrderedItems)
    await Promise.all(
      newOrderedItems.map((item, i) =>
        fetch(`/api/checklist/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...item, sort_order: i }),
        })
      )
    )
  }, [])

  const toggleWidget = useCallback((id) => {
    const next = visibleWidgets.includes(id)
      ? visibleWidgets.filter(w => w !== id)
      : [...visibleWidgets, id]
    updateSetting('visible_widgets', JSON.stringify(next))
  }, [visibleWidgets, updateSetting])

  const reorderWidgets = useCallback((newOrder) => {
    setWidgetOrder(newOrder)
    localStorage.setItem('widget_order', JSON.stringify(newOrder))
  }, [])

  const enterEditMode  = useCallback(() => setIsEditMode(true), [])

  const saveLayout = useCallback(() => {
    localStorage.setItem('dashboard_layout', JSON.stringify(workingLayout))
    setSavedLayout(workingLayout)
    setIsEditMode(false)
  }, [workingLayout])

  const cancelLayout = useCallback(() => {
    setWorkingLayout(savedLayout)
    setIsEditMode(false)
  }, [savedLayout])

  const handleLayoutChange = useCallback((newLayout) => {
    setWorkingLayout(newLayout)
  }, [])

  // ── handlers ───────────────────────────────────────────────────────────────
  const handleEditTrade = useCallback((trade) => {
    setEditTrade(trade)
    setShowAddModal(false)
  }, [])

  const handleCloseModal = useCallback(() => {
    setShowAddModal(false)
    setEditTrade(null)
  }, [])

  const handleSaveTrade = useCallback(async (data) => {
    if (editTrade) {
      await updateTrade(editTrade.id, data)
    } else {
      await addTrade(data)
    }
    handleCloseModal()
  }, [editTrade, updateTrade, addTrade, handleCloseModal])

  // ── render ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="loading-screen">
      <div className="spinner" />
      <span>Loading Trading Journal…</span>
    </div>
  )

  if (error) return (
    <div className="error-screen">
      <span>Failed to connect to API: {error}</span>
    </div>
  )

  return (
    <div className="app">
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

      <div className="app-body">
        <Sidebar
          collapsed={sidebarCollapsed}
          activeView={activeView}
          onSetView={setActiveView}
        />

        <main className="main-content">
          {activeView === 'dashboard' && (
            <>
              <StatsBar stats={stats} />
              {isEditMode && (
                <div className="edit-mode-banner">
                  <Pencil size={12} />
                  Edit mode — drag widgets to reorder, drag corners to resize
                </div>
              )}
              <Widgets
                visibleWidgets={visibleWidgets}
                trades={filteredTrades}
                checklist={checklist}
                onAddChecklistItem={addChecklistItem}
                onUpdateChecklistItem={updateChecklistItem}
                onDeleteChecklistItem={deleteChecklistItem}
                onResetChecklist={resetChecklist}
                onReorderChecklist={reorderChecklist}
                layout={workingLayout}
                isEditMode={isEditMode}
                onLayoutChange={handleLayoutChange}
              />
              <TradesTable
                trades={sortedTrades}
                allTags={allTags}
                instruments={instruments}
                accounts={accounts}
                selectedTrade={selectedTrade}
                onSelectTrade={setSelectedTrade}
                onEditTrade={handleEditTrade}
                onDeleteTrade={deleteTrade}
                sort={sort}
                setSort={setSort}
              />
              {selectedTrade && (
                <TradeDetail
                  trade={selectedTrade}
                  trades={trades}
                  allTags={allTags}
                  instruments={instruments}
                  onEdit={() => handleEditTrade(selectedTrade)}
                  onDelete={() => deleteTrade(selectedTrade.id)}
                  onClose={() => setSelectedTrade(null)}
                  onUpdate={updateTrade}
                  onNavigate={setSelectedTrade}
                />
              )}
            </>
          )}

          {activeView === 'trades' && (
            <>
              <TradesTable
                trades={sortedTrades}
                allTags={allTags}
                instruments={instruments}
                accounts={accounts}
                selectedTrade={selectedTrade}
                onSelectTrade={setSelectedTrade}
                onEditTrade={handleEditTrade}
                onDeleteTrade={deleteTrade}
                sort={sort}
                setSort={setSort}
              />
              {selectedTrade && (
                <TradeDetail
                  trade={selectedTrade}
                  trades={trades}
                  allTags={allTags}
                  instruments={instruments}
                  onEdit={() => handleEditTrade(selectedTrade)}
                  onDelete={() => deleteTrade(selectedTrade.id)}
                  onClose={() => setSelectedTrade(null)}
                  onUpdate={updateTrade}
                  onNavigate={setSelectedTrade}
                />
              )}
            </>
          )}

          {activeView === 'calendar' && (
            <Widgets
              visibleWidgets={['calendar']}
              trades={filteredTrades}
              checklist={checklist}
              onAddChecklistItem={addChecklistItem}
              onUpdateChecklistItem={updateChecklistItem}
              onDeleteChecklistItem={deleteChecklistItem}
              onResetChecklist={resetChecklist}
            />
          )}

          {activeView === 'analytics' && (
            <>
              <StatsBar stats={stats} />
              <EquityChart data={equityData} />
              <Widgets
                visibleWidgets={['daily_pnl', 'win_rate', 'streak']}
                trades={filteredTrades}
                checklist={checklist}
                onAddChecklistItem={addChecklistItem}
                onUpdateChecklistItem={updateChecklistItem}
                onDeleteChecklistItem={deleteChecklistItem}
                onResetChecklist={resetChecklist}
                onReorderChecklist={reorderChecklist}
              />
            </>
          )}

          {activeView === 'tags' && (
            <TagsPage
              allTags={allTags}
              onAdd={addTag}
              onUpdate={updateTag}
              onDelete={deleteTag}
            />
          )}

          {activeView === 'accounts' && (
            <AccountsPage
              accounts={accounts}
              onAdd={addAccount}
              onUpdate={updateAccount}
              onDelete={deleteAccount}
            />
          )}

          {activeView === 'settings' && (
            <SettingsPage
              visibleWidgets={visibleWidgets}
              onToggleWidget={toggleWidget}
            />
          )}
        </main>
      </div>

      {(showAddModal || editTrade) && (
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
      )}

      {showCustomize && (
        <CustomizeDrawer
          visibleWidgets={visibleWidgets}
          widgetOrder={widgetOrder}
          onToggleWidget={toggleWidget}
          onReorder={reorderWidgets}
          onClose={() => setShowCustomize(false)}
        />
      )}
    </div>
  )
}
