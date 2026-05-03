import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Header          from './components/Header.jsx'
import Sidebar         from './components/Sidebar.jsx'
import StatsBar        from './components/StatsBar.jsx'
import EquityChart     from './components/EquityChart.jsx'
import Widgets         from './components/Widgets.jsx'
import TradesTable     from './components/TradesTable.jsx'
import TradeDetail     from './components/TradeDetail.jsx'
import Modals          from './components/Modals.jsx'
import CustomizeDrawer from './components/CustomizeDrawer.jsx'
import { calculateStats, filterTrades, buildEquityData } from './utils.jsx'

export default function App() {
  // ── data state ─────────────────────────────────────────────────────────────
  const [trades,      setTrades]      = useState([])
  const [instruments, setInstruments] = useState([])
  const [allTags,     setAllTags]     = useState([])
  const [checklist,   setChecklist]   = useState([])
  const [settings,    setSettings]    = useState({})
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)

  // ── ui state ───────────────────────────────────────────────────────────────
  const [selectedTrade,     setSelectedTrade]     = useState(null)
  const [filters,           setFilters]           = useState({ dateFrom: '', dateTo: '', symbol: '', direction: '', outcome: '', tags: [] })
  const [showAddModal,      setShowAddModal]      = useState(false)
  const [editTrade,         setEditTrade]         = useState(null)
  const [showCustomize,     setShowCustomize]     = useState(false)
  const [sidebarCollapsed,  setSidebarCollapsed]  = useState(false)
  const [sort,              setSort]              = useState({ key: 'datetime', dir: 'desc' })

  // ── initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch('/api/trades').then(r => r.json()),
      fetch('/api/instruments').then(r => r.json()),
      fetch('/api/tags').then(r => r.json()),
      fetch('/api/checklist').then(r => r.json()),
      fetch('/api/settings').then(r => r.json()),
    ])
      .then(([t, instr, tags, cl, sett]) => {
        setTrades(t)
        setInstruments(instr)
        setAllTags(tags)
        setChecklist(cl)
        setSettings(sett)
        setLoading(false)
      })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [])

  // ── computed ───────────────────────────────────────────────────────────────
  const filteredTrades = useMemo(() => filterTrades(trades, filters), [trades, filters])

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

  const toggleWidget = useCallback((id) => {
    const next = visibleWidgets.includes(id)
      ? visibleWidgets.filter(w => w !== id)
      : [...visibleWidgets, id]
    updateSetting('visible_widgets', JSON.stringify(next))
  }, [visibleWidgets, updateSetting])

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
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(v => !v)}
        onAddTrade={() => setShowAddModal(true)}
        onCustomize={() => setShowCustomize(true)}
      />

      <div className="app-body">
        <Sidebar
          collapsed={sidebarCollapsed}
        />

        <main className="main-content">
          <StatsBar stats={stats} />

          <EquityChart data={equityData} />

          <Widgets
            visibleWidgets={visibleWidgets}
            trades={filteredTrades}
            checklist={checklist}
            onAddChecklistItem={addChecklistItem}
            onUpdateChecklistItem={updateChecklistItem}
            onDeleteChecklistItem={deleteChecklistItem}
          />

          <TradesTable
            trades={sortedTrades}
            allTags={allTags}
            instruments={instruments}
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
              allTags={allTags}
              instruments={instruments}
              onEdit={() => handleEditTrade(selectedTrade)}
              onDelete={() => deleteTrade(selectedTrade.id)}
              onClose={() => setSelectedTrade(null)}
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
          onSave={handleSaveTrade}
          onClose={handleCloseModal}
        />
      )}

      {showCustomize && (
        <CustomizeDrawer
          visibleWidgets={visibleWidgets}
          onToggleWidget={toggleWidget}
          onClose={() => setShowCustomize(false)}
        />
      )}
    </div>
  )
}
