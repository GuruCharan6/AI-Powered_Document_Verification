import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import api from '../services/api'
import {
  FileText, AlertTriangle, CheckCircle, XCircle,
  Stamp, PenTool, User, Shield, ArrowLeft, Brain,
  Loader2, AlertCircle, Calendar, Hash
} from 'lucide-react'
import ScoreRing from './ui/ScoreRing'
import ProgressBar from './ui/ProgressBar'
import Badge from './ui/Badge'

const verdictStyle = {
  APPROVE: { card: 'bg-emerald-50 border-emerald-200', badge: 'success', label: 'Approved' },
  REVIEW:  { card: 'bg-amber-50  border-amber-200',  badge: 'warning', label: 'Needs Review' },
  REJECT:  { card: 'bg-red-50    border-red-200',    badge: 'danger',  label: 'Rejected' },
}

const ELEMENT_ICON = {
  stamp:     <Stamp    className="w-5 h-5" />,
  signature: <PenTool  className="w-5 h-5" />,
  photo:     <User     className="w-5 h-5" />,
  seal:      <Shield   className="w-5 h-5" />,
  watermark: <FileText className="w-5 h-5" />,
}
const ELEMENT_COLOR = {
  stamp:     'text-blue-500   bg-blue-50   border-blue-100',
  signature: 'text-purple-500 bg-purple-50 border-purple-100',
  photo:     'text-emerald-500 bg-emerald-50 border-emerald-100',
  seal:      'text-amber-500  bg-amber-50  border-amber-100',
  watermark: 'text-indigo-500 bg-indigo-50 border-indigo-100',
}

const SectionHeader = ({ icon, title, count }) => (
  <div className="flex items-center gap-2 mb-4">
    <div className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center border border-primary-100">
      {icon}
    </div>
    <h3 className="font-bold text-primary-800 text-sm">{title}</h3>
    {count !== undefined && (
      <span className="text-xs text-primary-400 bg-primary-100 px-2 py-0.5 rounded-full">{count}</span>
    )}
  </div>
)

const ExtractedDetails = () => {
  const [searchParams] = useSearchParams()
  const documentId = searchParams.get('id')
  const [doc, setDoc]               = useState(null)
  const [explanation, setExplanation] = useState(null)
  const [loadingDoc, setLoadingDoc] = useState(true)
  const [loadingExplain, setLoadingExplain] = useState(false)

  useEffect(() => {
    if (documentId) fetchDocument()
  }, [documentId])

  const fetchDocument = async () => {
    try {
      const { data } = await api.get(`/documents/${documentId}`)
      setDoc(data)
      if (data.status === 'completed' && data.extracted_fields?.length > 0) {
        fetchExplanation()
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoadingDoc(false)
    }
  }

  const fetchExplanation = async () => {
    setLoadingExplain(true)
    try {
      const { data } = await api.get(`/documents/${documentId}/explain`)
      setExplanation(data)
    } catch (error) {
      console.error('Explanation failed:', error)
    } finally {
      setLoadingExplain(false)
    }
  }

  if (loadingDoc) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-primary-400">
      <Loader2 className="w-7 h-7 animate-spin text-accent-500" />
      <p className="text-sm">Loading document details...</p>
    </div>
  )

  if (!doc) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center">
        <FileText className="w-7 h-7 text-primary-300" />
      </div>
      <p className="text-primary-500 font-medium">Document not found</p>
      <Link to="/dashboard" className="text-sm text-accent-600 hover:underline">← Back to Dashboard</Link>
    </div>
  )

  const vs = explanation?.verdict ? verdictStyle[explanation.verdict] : null

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/dashboard"
          className="w-9 h-9 flex items-center justify-center bg-white border border-primary-200 rounded-xl hover:bg-primary-50 transition-colors flex-shrink-0">
          <ArrowLeft className="w-4 h-4 text-primary-500" />
        </Link>
        <div className="flex-1 min-w-0">
          <h2 className="section-title truncate">{doc.file_name}</h2>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-primary-400 capitalize bg-primary-100 px-2 py-0.5 rounded-full">
              {doc.document_type?.replace(/_/g, ' ') || 'Unknown type'}
            </span>
            <span className="flex items-center gap-1 text-xs text-primary-400">
              <Calendar className="w-3 h-3" />
              {new Date(doc.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <span className="flex items-center gap-1 text-xs text-primary-400">
              <Hash className="w-3 h-3" />
              {documentId?.slice(0, 8)}...
            </span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              doc.status === 'completed' ? 'text-emerald-700 bg-emerald-50' :
              doc.status === 'failed'    ? 'text-red-700 bg-red-50' : 'text-amber-700 bg-amber-50'
            }`}>{doc.status}</span>
          </div>
        </div>
        {vs && <Badge variant={vs.badge} className="flex-shrink-0">{vs.label}</Badge>}
      </div>

      {/* Score Overview */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { score: Math.round(doc.confidence_score || 0),              label: 'Document Confidence', gradient: 'from-blue-50 to-blue-100/40' },
          { score: Math.round(doc.summary?.avg_field_confidence || 0), label: 'Field Extraction',    gradient: 'from-emerald-50 to-emerald-100/40' },
          { score: Math.round(100 - (doc.fraud_risk_score || 0)),      label: 'Security Score',      gradient: 'from-purple-50 to-purple-100/40' },
          { score: Math.round(doc.visual_confidence_score || 0),       label: 'Visual Verification', gradient: 'from-amber-50 to-amber-100/40' },
        ].map((item, i) => (
          <div key={i} className={`card p-6 flex flex-col items-center bg-gradient-to-b ${item.gradient} border-0`}>
            <ScoreRing score={item.score} size={100} label={item.label} />
          </div>
        ))}
      </div>

      {/* AI Summary — prominent at top */}
      {(loadingExplain || explanation) && (
        <div className={`card p-5 border-2 ${vs?.card || 'bg-gradient-to-br from-accent-50 to-blue-50 border-accent-200'}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white/80 rounded-xl flex items-center justify-center flex-shrink-0">
                <Brain className="w-5 h-5 text-accent-600" />
              </div>
              <div>
                <h3 className="font-bold text-primary-800 text-sm">AI Verification Summary</h3>
                {explanation?.verdict && (
                  <p className={`text-xs mt-0.5 font-semibold ${vs?.card.includes('emerald') ? 'text-emerald-600' : vs?.card.includes('amber') ? 'text-amber-600' : 'text-red-600'}`}>
                    {vs?.label}
                  </p>
                )}
              </div>
            </div>
            {explanation?.verdict && <Badge variant={vs?.badge}>{explanation.verdict}</Badge>}
          </div>

          <div className="mt-4">
            {loadingExplain ? (
              <div className="flex items-center gap-2 text-primary-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Generating analysis...
              </div>
            ) : (
              <div>
                <p className="text-sm text-primary-700 leading-relaxed">
                  {explanation.explanation || explanation.confidence_breakdown?.explanation}
                </p>
                {explanation.valid_fields_count !== undefined && (
                  <div className="flex gap-6 text-xs mt-3 pt-3 border-t border-current/10">
                    <span className="text-emerald-700 font-bold">✓ {explanation.valid_fields_count} valid fields</span>
                    <span className="text-red-600 font-bold">✗ {explanation.invalid_fields_count} missing fields</span>
                    {explanation.suspicious_checks_count > 0 && (
                      <span className="text-amber-700 font-bold">⚠ {explanation.suspicious_checks_count} suspicious</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main grid: Fraud + Visual */}
      <div className="grid grid-cols-2 gap-4">

        {/* Fraud Analysis */}
        <div className="card p-5">
          <SectionHeader
            icon={<AlertTriangle className="w-4 h-4 text-red-500" />}
            title="Fraud Analysis"
            count={doc.fraud_checks?.length}
          />
          <div className="space-y-3">
            {doc.fraud_checks?.map((check, idx) => (
              <div key={idx} className={`p-4 rounded-xl border ${check.is_suspicious ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-primary-900 capitalize">
                    {check.check_type.replace(/_/g, ' ')}
                  </span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${check.is_suspicious ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {check.is_suspicious ? 'Suspicious' : 'Clean'}
                  </span>
                </div>
                <ProgressBar value={check.risk_score} />
                {check.details && (
                  <div className="mt-2 space-y-1">
                    {Object.entries(check.details)
                      .filter(([k, v]) => k !== 'error' && !Array.isArray(v))
                      .slice(0, 2)
                      .map(([k, v]) => (
                        <div key={k} className="flex justify-between text-xs text-primary-500">
                          <span className="capitalize">{k.replace(/_/g, ' ')}:</span>
                          <span className="font-semibold text-primary-700">{String(v)}</span>
                        </div>
                      ))}
                    {check.details.issues?.length > 0 && (
                      <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3 h-3" /> {check.details.issues.join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Visual Elements */}
        <div className="card p-5">
          <SectionHeader
            icon={<Shield className="w-4 h-4 text-purple-500" />}
            title="Visual Elements"
          />
          <div className="space-y-3">
            {doc.visual_elements?.map((el, idx) => {
              const colorCls = el.is_present
                ? (ELEMENT_COLOR[el.element_type] || 'text-accent-500 bg-accent-50 border-accent-100')
                : 'text-primary-300 bg-primary-50 border-primary-100'
              const [textCls] = colorCls.split(' ')
              return (
                <div key={idx} className={`flex items-center justify-between p-4 rounded-xl border ${colorCls}`}>
                  <div className="flex items-center gap-3">
                    <span className={textCls}>{ELEMENT_ICON[el.element_type]}</span>
                    <div>
                      <p className="text-sm font-semibold text-primary-800 capitalize">{el.element_type}</p>
                      <p className={`text-xs ${el.is_present ? textCls : 'text-primary-400'}`}>
                        {el.is_present ? 'Detected' : 'Not detected'}
                      </p>
                    </div>
                  </div>
                  {el.is_present ? (
                    <div className="text-right">
                      <span className={`text-lg font-bold ${textCls}`}>{el.confidence_score}%</span>
                      <p className="text-xs text-primary-400">confidence</p>
                    </div>
                  ) : (
                    <XCircle className="w-5 h-5 text-primary-200" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Extracted Fields — full width at bottom */}
      <div className="card p-5">
        <SectionHeader
          icon={<FileText className="w-4 h-4 text-accent-600" />}
          title="Extracted Information"
          count={doc.extracted_fields?.length}
        />

        {!doc.extracted_fields?.length ? (
          <div className="text-center py-12 text-primary-300">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm italic">No fields extracted for this document</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {doc.extracted_fields.map((field, idx) => (
              <div key={field.id || idx} className="p-4 bg-primary-50 rounded-xl border border-primary-100 hover:border-primary-200 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    {field.field_name.includes('name')
                      ? <User    className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" />
                      : <FileText className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" />}
                    <span className="text-xs font-bold uppercase tracking-wider text-primary-400 leading-tight">
                      {field.field_name.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {field.is_valid
                    ? <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    : <XCircle    className="w-4 h-4 text-red-400 flex-shrink-0" />}
                </div>

                <p className="text-base font-bold text-primary-900 mb-2 break-words">
                  {field.field_value
                    ? field.field_value
                    : <span className="text-primary-300 italic font-normal text-sm">Not detected</span>}
                </p>

                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <ProgressBar value={field.confidence_score} size="sm" />
                  </div>
                  <span className="text-xs font-semibold text-primary-500 w-8 text-right">{field.confidence_score}%</span>
                </div>

                {field.validation_message && field.validation_message !== 'Valid' && (
                  <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" /> {field.validation_message}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}

export default ExtractedDetails