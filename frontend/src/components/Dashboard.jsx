import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { FileText, AlertTriangle, CheckCircle, Clock, Loader2, ArrowUpRight, Search, RefreshCw, BarChart2 } from 'lucide-react'
import ScoreRing from './ui/ScoreRing'
import ProgressBar from './ui/ProgressBar'
import { useTheme } from '../context/Themecontext'

const Dashboard = () => {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [stats, setStats]         = useState(null)
  const [documents, setDocuments] = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filter, setFilter]       = useState('all')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { fetchData() }, [])

  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true); else setLoading(true)
    try {
      const [statsRes, docsRes] = await Promise.all([api.get('/dashboard/stats'), api.get('/documents/')])
      setStats(statsRes.data); setDocuments(docsRes.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false); setRefreshing(false) }
  }

  const filtered = documents.filter(d => {
    const matchSearch = d.file_name.toLowerCase().includes(search.toLowerCase()) || (d.document_type || '').toLowerCase().includes(search.toLowerCase())
    return matchSearch && (filter === 'all' || d.status === filter)
  })

  const approvalRate = stats?.total_documents ? Math.round(((stats.total_documents - (stats.fraud_detected || 0)) / stats.total_documents) * 100) : 0

  // Dark mode styles
  const card      = isDark ? { backgroundColor: '#1e2535', borderColor: '#2d3748' } : {}
  const textMain  = isDark ? { color: '#d1d5db' } : {}
  const textSub   = isDark ? { color: '#6b7280' } : {}
  const textLabel = isDark ? { color: '#4b5563' } : {}
  const inputSt   = isDark ? { backgroundColor: '#252d40', borderColor: '#2d3748', color: '#d1d5db' } : {}
  const divider   = isDark ? { borderColor: '#252d40' } : {}
  const tableHead = isDark ? { backgroundColor: '#1a2030', borderColor: '#252d40' } : {}
  const rowHover  = isDark ? '#1a2030' : '#f8fafc'
  const tagStyle  = isDark ? { backgroundColor: '#252d40', color: '#9ca3af' } : {}
  const filterBg  = isDark ? { backgroundColor: '#252d40' } : {}
  const filterActive = isDark ? { backgroundColor: '#1e2535', color: '#d1d5db' } : {}
  const filterInactive = isDark ? { color: '#6b7280' } : {}

  const statusDot = { completed: 'bg-emerald-500', processing: 'bg-amber-400 animate-pulse', failed: 'bg-red-500', pending: 'bg-primary-300' }
  const statusText = isDark
    ? { completed: '#34d399', processing: '#fbbf24', failed: '#f87171', pending: '#6b7280' }
    : { completed: '#059669', processing: '#d97706', failed: '#dc2626', pending: '#94a3b8' }

  const statCards = [
    { icon: <FileText className="w-5 h-5" />,      iconColor: '#3b82f6', iconBg: isDark ? 'rgba(59,130,246,0.15)'  : '#dbeafe', value: stats?.total_documents || 0,  label: 'Total Documents'  },
    { icon: <CheckCircle className="w-5 h-5" />,   iconColor: '#10b981', iconBg: isDark ? 'rgba(16,185,129,0.15)'  : '#d1fae5', value: stats?.processed_today || 0,  label: 'Processed Today'  },
    { icon: <Clock className="w-5 h-5" />,         iconColor: '#f59e0b', iconBg: isDark ? 'rgba(245,158,11,0.15)'  : '#fde68a', value: stats?.pending_documents || 0, label: 'Pending Review'   },
    { icon: <AlertTriangle className="w-5 h-5" />, iconColor: '#ef4444', iconBg: isDark ? 'rgba(239,68,68,0.15)'   : '#fecaca', value: stats?.fraud_detected || 0,    label: 'Fraud Detected', sub: stats?.total_documents ? `${100 - approvalRate}% of total` : undefined },
  ]

  const overviewTiles = [
    { label: 'Approval Rate',   value: `${approvalRate}%`,             color: '#10b981', bg: isDark ? 'rgba(16,185,129,0.08)'  : '#f0fdf4', border: isDark ? 'rgba(16,185,129,0.2)'  : '#bbf7d0' },
    { label: 'Fraud Rate',      value: `${100 - approvalRate}%`,        color: '#ef4444', bg: isDark ? 'rgba(239,68,68,0.08)'   : '#fef2f2', border: isDark ? 'rgba(239,68,68,0.2)'   : '#fecaca' },
    { label: 'Processed Today', value: stats?.processed_today || 0,     color: '#3b82f6', bg: isDark ? 'rgba(59,130,246,0.08)'  : '#eff6ff', border: isDark ? 'rgba(59,130,246,0.2)'  : '#bfdbfe' },
    { label: 'Pending Review',  value: stats?.pending_documents || 0,   color: '#f59e0b', bg: isDark ? 'rgba(245,158,11,0.08)'  : '#fffbeb', border: isDark ? 'rgba(245,158,11,0.2)'  : '#fde68a' },
  ]

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <Loader2 className="w-7 h-7 animate-spin text-accent-500" />
      <p className="text-sm" style={textSub}>Loading dashboard...</p>
    </div>
  )

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title" style={textMain}>Dashboard</h2>
          <p className="mt-1 text-sm" style={textSub}>Monitor your document verification activity</p>
        </div>
        <button onClick={() => fetchData(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border transition-colors shadow-sm"
          style={isDark ? { backgroundColor: '#1e2535', borderColor: '#2d3748', color: '#9ca3af' } : { backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#475569' }}>
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-5">
        {statCards.map((s, i) => (
          <div key={i} className="card p-6 relative overflow-hidden group" style={card}>
            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-10 group-hover:scale-125 transition-transform duration-300"
              style={{ backgroundColor: s.iconColor }} />
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: s.iconBg }}>
              <span style={{ color: s.iconColor }}>{s.icon}</span>
            </div>
            <p className="text-3xl font-black tracking-tight" style={textMain}>{s.value}</p>
            <p className="text-sm mt-1" style={textSub}>{s.label}</p>
            {s.sub && <p className="text-xs mt-0.5" style={textLabel}>{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Overview */}
      <div className="card p-6" style={card}>
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={isDark ? { backgroundColor: 'rgba(37,99,235,0.15)' } : { backgroundColor: '#eff6ff' }}>
            <BarChart2 className="w-4 h-4 text-accent-500" />
          </div>
          <h3 className="font-bold" style={textMain}>System Overview</h3>
        </div>
        <div className="grid grid-cols-4 gap-6">
          <div className="flex flex-col items-center">
            <ScoreRing score={Math.round(stats?.average_confidence || 0)} size={110} label="Avg Confidence" />
          </div>
          <div className="flex flex-col items-center">
            <ScoreRing score={Math.round(100 - (stats?.average_fraud_risk || 0))} size={110} label="Avg Security" />
          </div>
          <div className="col-span-2 grid grid-cols-2 gap-3 content-center">
            {overviewTiles.map((t, i) => (
              <div key={i} className="rounded-xl p-4 border" style={{ backgroundColor: t.bg, borderColor: t.border }}>
                <p className="text-xs mb-1" style={textSub}>{t.label}</p>
                <p className="text-2xl font-black" style={{ color: t.color }}>{t.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Document list */}
      <div className="card p-6" style={card}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={isDark ? { backgroundColor: '#252d40' } : { backgroundColor: '#f8fafc' }}>
              <FileText className="w-4 h-4" style={textSub} />
            </div>
            <h3 className="font-bold" style={textMain}>All Documents</h3>
            <span className="text-xs px-2 py-0.5 rounded-full" style={isDark ? { backgroundColor: '#252d40', color: '#6b7280' } : { backgroundColor: '#f1f5f9', color: '#94a3b8' }}>{filtered.length}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={textSub} />
              <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
                className="input-field pl-9 pr-4 py-2 text-sm w-48" style={inputSt} />
            </div>
            <div className="flex items-center gap-1 p-1 rounded-xl" style={filterBg}>
              {['all', 'completed', 'processing', 'failed'].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all capitalize"
                  style={filter === f ? filterActive : filterInactive}>
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" style={textSub} />
            <p className="text-sm font-medium" style={textSub}>No documents found</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border" style={isDark ? { borderColor: '#252d40' } : { borderColor: '#e2e8f0' }}>
            {/* Head */}
            <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b" style={tableHead}>
              {['Document','Type','Confidence','Status','Date',''].map((h, i) => (
                <div key={i} className={`text-xs font-bold uppercase tracking-wider ${i===0?'col-span-4':i===1?'col-span-2':i===2?'col-span-2':i===3?'col-span-1':i===4?'col-span-2':'col-span-1'}`} style={textLabel}>{h}</div>
              ))}
            </div>
            {/* Rows */}
            <div style={isDark ? { backgroundColor: '#1e2535' } : {}}>
              {filtered.map((doc, idx) => {
                const dot = statusDot[doc.status] || 'bg-primary-300'
                const stColor = statusText[doc.status] || statusText.pending
                return (
                  <div key={doc.id}
                    className="grid grid-cols-12 gap-4 items-center px-5 py-4 transition-colors group cursor-default border-b last:border-0"
                    style={{ borderColor: isDark ? '#252d40' : '#f1f5f9' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = rowHover}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <div className="col-span-4 flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border"
                        style={isDark ? { backgroundColor: 'rgba(37,99,235,0.12)', borderColor: 'rgba(37,99,235,0.2)' } : { backgroundColor: '#eff6ff', borderColor: '#dbeafe' }}>
                        <FileText className="w-4 h-4 text-accent-500" />
                      </div>
                      <p className="text-sm font-semibold truncate" style={textMain} title={doc.file_name}>{doc.file_name}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs font-medium px-2.5 py-1 rounded-lg capitalize" style={isDark ? tagStyle : { backgroundColor: '#f1f5f9', color: '#475569' }}>
                        {doc.document_type?.replace(/_/g, ' ') || 'Unknown'}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <div className="flex-1"><ProgressBar value={doc.confidence_score || 0} size="sm" /></div>
                      <span className="text-xs font-bold w-8 text-right" style={textMain}>{Math.round(doc.confidence_score || 0)}%</span>
                    </div>
                    <div className="col-span-1">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
                        <span className="text-xs font-semibold capitalize" style={{ color: stColor }}>{doc.status}</span>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs font-medium" style={textMain}>{new Date(doc.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      <p className="text-xs" style={textLabel}>{new Date(doc.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Link to={`/details?id=${doc.id}`}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-all opacity-0 group-hover:opacity-100 border"
                        style={isDark ? { backgroundColor: 'rgba(37,99,235,0.15)', borderColor: 'rgba(37,99,235,0.3)', color: '#60a5fa' } : { backgroundColor: '#eff6ff', borderColor: '#bfdbfe', color: '#2563eb' }}>
                        View <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard