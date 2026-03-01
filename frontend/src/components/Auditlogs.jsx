import { useEffect, useState } from 'react'
import api from '../services/api'
import { ClipboardList, Search, Download, FileJson, X, FileText, Loader2 } from 'lucide-react'
import DocumentDetailPanel from './DocumentDetailPanel'
import { useDocumentDetail } from '../hooks/useDocumentDetail'
import { useTheme } from '../context/Themecontext'

const AuditLogs = () => {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [logs, setLogs]             = useState([])
  const [filter, setFilter]         = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const { doc, explanation, loadingDoc, loadingExplain, load, reset } = useDocumentDetail()
  const [selectedLogId, setSelectedLogId] = useState(null)

  useEffect(() => { fetchLogs() }, [])

  const fetchLogs = async () => {
    try { const { data } = await api.get('/documents/'); setLogs(data) }
    catch (e) { console.error(e) }
  }

  const handleRowClick = (log) => {
    if (selectedLogId === log.id) { setSelectedLogId(null); reset() }
    else { setSelectedLogId(log.id); load(log.id) }
  }

  const closePanel = () => { setSelectedLogId(null); reset() }

  const filteredLogs = logs.filter(log => {
    const matchText = log.file_name?.toLowerCase().includes(filter.toLowerCase()) ||
      log.status?.toLowerCase().includes(filter.toLowerCase()) ||
      log.document_type?.toLowerCase().includes(filter.toLowerCase())
    return matchText && (!statusFilter || log.status === statusFilter)
  })

  const exportCSV = () => {
    const headers = ['ID','File Name','Document Type','Status','Confidence','Fraud Risk','Fraudulent','Created At']
    const rows = filteredLogs.map(l => [l.id, l.file_name, l.document_type||'unknown', l.status, (l.confidence_score||0).toFixed(2), (l.fraud_risk_score||0).toFixed(2), l.is_fraudulent?'Yes':'No', new Date(l.created_at).toLocaleString()])
    const csv = [headers,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    dl(csv,'audit_logs.csv','text/csv')
  }
  const exportJSON = () => {
    const data = filteredLogs.map(l => ({ id:l.id, file_name:l.file_name, document_type:l.document_type||'unknown', status:l.status, confidence_score:l.confidence_score||0, fraud_risk_score:l.fraud_risk_score||0, is_fraudulent:l.is_fraudulent||false, created_at:l.created_at }))
    dl(JSON.stringify(data,null,2),'audit_logs.json','application/json')
  }
  const dl = (content, filename, mime) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content],{type:mime})); a.download=filename; a.click() }

  // Dark mode styles
  const card      = isDark ? { backgroundColor: '#1e2535', borderColor: '#2d3748' } : {}
  const textMain  = isDark ? { color: '#d1d5db' } : {}
  const textSub   = isDark ? { color: '#6b7280' } : {}
  const textLabel = isDark ? { color: '#4b5563' } : {}
  const inputSt   = isDark ? { backgroundColor: '#252d40', borderColor: '#2d3748', color: '#d1d5db' } : {}
  const tableHead = isDark ? { backgroundColor: '#171f2e', borderColor: '#252d40' } : {}
  const rowHover  = isDark ? '#1a2030' : '#f8fafc'
  const divider   = isDark ? { borderColor: '#252d40' } : { borderColor: '#f1f5f9' }

  const statusStyle = {
    completed:  isDark ? { backgroundColor: 'rgba(16,185,129,0.12)', color: '#34d399' } : { backgroundColor: '#d1fae5', color: '#065f46' },
    processing: isDark ? { backgroundColor: 'rgba(245,158,11,0.12)', color: '#fbbf24' } : { backgroundColor: '#fef3c7', color: '#92400e' },
    failed:     isDark ? { backgroundColor: 'rgba(239,68,68,0.12)',  color: '#f87171' } : { backgroundColor: '#fee2e2', color: '#991b1b' },
    pending:    isDark ? { backgroundColor: 'rgba(59,130,246,0.12)', color: '#60a5fa' } : { backgroundColor: '#dbeafe', color: '#1e40af' },
  }

  const confColor = (v) => isDark
    ? v >= 80 ? '#34d399' : v >= 50 ? '#fbbf24' : '#f87171'
    : v >= 80 ? '#059669' : v >= 50 ? '#d97706' : '#dc2626'

  const fraudColor = (v) => isDark
    ? v > 70 ? '#f87171' : v > 30 ? '#fbbf24' : '#34d399'
    : v > 70 ? '#dc2626' : v > 30 ? '#d97706' : '#059669'

  const panelOpen = selectedLogId && (loadingDoc || doc)

  return (
    <div className="flex gap-6">
      {/* Table */}
      <div className={`space-y-6 transition-all duration-300 ${panelOpen ? 'w-1/2' : 'w-full'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="section-title" style={textMain}>Audit Logs</h2>
            <p className="mt-1 text-sm" style={textSub}>Click any row to view full details · {filteredLogs.length} records</p>
          </div>
          <div className="flex gap-3">
            <button onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border transition-colors"
              style={isDark ? { backgroundColor: '#1e2535', borderColor: '#2d3748', color: '#9ca3af' } : {}}>
              <Download className="w-4 h-4" /> CSV
            </button>
            <button onClick={exportJSON}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border transition-colors"
              style={isDark ? { backgroundColor: '#1e2535', borderColor: '#2d3748', color: '#9ca3af' } : {}}>
              <FileJson className="w-4 h-4" /> JSON
            </button>
          </div>
        </div>

        <div className="card overflow-hidden" style={card}>
          {/* Search bar */}
          <div className="p-4 border-b flex gap-3" style={divider}>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={textSub} />
              <input type="text" placeholder="Search..." value={filter} onChange={e => setFilter(e.target.value)}
                className="input-field pl-10 w-full" style={inputSt} />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="input-field max-w-[150px]" style={inputSt}>
              <option value="">All</option>
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
            </select>
            {(filter || statusFilter) && (
              <button onClick={() => { setFilter(''); setStatusFilter('') }}
                className="text-sm transition-colors" style={textSub}>Clear</button>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={tableHead}>
                  {['Document','Type','Status','Confidence','Fraud Risk','Date'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider border-b" style={{ ...textLabel, ...{ borderColor: isDark ? '#252d40' : '#e2e8f0' } }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, idx) => {
                  const isSelected = selectedLogId === log.id
                  return (
                    <tr key={log.id} onClick={() => handleRowClick(log)}
                      className="cursor-pointer transition-colors border-b last:border-0"
                      style={{
                        borderColor: isDark ? '#252d40' : '#f1f5f9',
                        borderLeft: isSelected ? '3px solid #3b82f6' : '3px solid transparent',
                        backgroundColor: isSelected ? (isDark ? 'rgba(37,99,235,0.08)' : '#eff6ff') : 'transparent',
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = rowHover }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent' }}
                    >
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-sm truncate max-w-[150px]" style={textMain}>{log.file_name}</p>
                        <p className="text-xs font-mono mt-0.5" style={textLabel}>{log.id.slice(0,8)}...</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-sm capitalize" style={textSub}>{log.document_type?.replace(/_/g,' ') || 'Auto'}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex px-2.5 py-1 text-xs font-bold rounded-full"
                          style={statusStyle[log.status] || statusStyle.pending}>
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-sm font-bold" style={{ color: confColor(log.confidence_score||0) }}>
                          {(log.confidence_score||0).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-sm font-bold" style={{ color: fraudColor(log.fraud_risk_score||0) }}>
                          {(log.fraud_risk_score||0).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs whitespace-nowrap" style={textSub}>
                        {new Date(log.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {filteredLogs.length === 0 && (
            <div className="text-center py-16">
              <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-20" style={textSub} />
              <p style={textSub}>No logs found</p>
            </div>
          )}

          {/* Footer */}
          {filteredLogs.length > 0 && (
            <div className="p-4 border-t flex justify-between text-xs" style={{ ...divider, ...textSub }}>
              <span>{filteredLogs.length} of {logs.length} records</span>
              <div className="flex gap-4">
                <span style={{ color: '#34d399' }}>✓ {filteredLogs.filter(l => l.status==='completed').length} completed</span>
                <span style={{ color: '#f87171' }}>✗ {filteredLogs.filter(l => l.status==='failed').length} failed</span>
                <span style={{ color: isDark ? '#f87171' : '#dc2626' }}>⚠ {filteredLogs.filter(l => l.is_fraudulent).length} fraudulent</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      {panelOpen && (
        <div className="w-1/2 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="section-title" style={textMain}>Document Details</h3>
              {doc && (
                <p className="text-sm mt-0.5 capitalize" style={textSub}>
                  {doc.document_type?.replace(/_/g,' ') || 'Unknown'} ·&nbsp;
                  <span style={{ color: doc.status==='completed' ? '#34d399' : doc.status==='failed' ? '#f87171' : '#fbbf24' }}>{doc.status}</span>
                </p>
              )}
            </div>
            <button onClick={closePanel} className="p-2 rounded-lg transition-colors"
              style={isDark ? {} : {}}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = isDark ? '#252d40' : '#f1f5f9'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
              <X className="w-5 h-5" style={textSub} />
            </button>
          </div>

          {loadingDoc ? (
            <div className="card p-12 flex items-center justify-center gap-2" style={card}>
              <Loader2 className="w-5 h-5 animate-spin text-accent-500" />
              <span style={textSub}>Loading...</span>
            </div>
          ) : doc ? (
            <div className="overflow-y-auto max-h-[calc(100vh-180px)] pr-1 space-y-1">
              <div className="card p-3 flex items-center gap-3" style={card}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={isDark ? { backgroundColor: 'rgba(37,99,235,0.15)' } : { backgroundColor: '#eff6ff' }}>
                  <FileText className="w-4 h-4 text-accent-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate" style={textMain}>{doc.file_name}</p>
                  <p className="text-xs" style={textSub}>{new Date(doc.created_at).toLocaleString()}</p>
                </div>
                {doc.is_fraudulent && (
                  <span className="inline-flex px-2 py-0.5 text-xs font-bold rounded-full flex-shrink-0"
                    style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                    ⚠ Flagged
                  </span>
                )}
              </div>
              <DocumentDetailPanel doc={doc} explanation={explanation} loadingExplain={loadingExplain} compact />
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

export default AuditLogs