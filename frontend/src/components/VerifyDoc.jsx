import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Link } from 'react-router-dom'
import api from '../services/api'
import {
  Upload, File, X, Loader2, CheckCircle, AlertCircle,
  FileText, AlertTriangle, Shield, Brain, Stamp,
  PenTool, User, ArrowUpRight, ChevronDown,
  XCircle, Sparkles, ScanLine, Lock, Zap
} from 'lucide-react'
import ProgressBar from './ui/ProgressBar'
import ScoreRing from './ui/ScoreRing'
import Badge from './ui/Badge'
import { useDocumentDetail } from '../hooks/useDocumentDetail'
import { useTheme } from '../context/Themecontext'

const DOC_TYPES = [
  { value: '', label: 'Auto-detect document type' },
  { value: 'aadhaar', label: 'Aadhaar Card' },
  { value: 'pan', label: 'PAN Card' },
  { value: 'passport', label: 'Passport' },
  { value: 'driving_license', label: 'Driving License' },
  { value: 'voter_id', label: 'Voter ID' },
  { value: 'ration_card', label: 'Ration Card' },
  { value: 'caste_certificate', label: 'Caste Certificate' },
  { value: 'income_certificate', label: 'Income Certificate' },
  { value: 'land_document', label: 'Land Document' },
  { value: 'birth_certificate', label: 'Birth Certificate' },
  { value: 'domicile_certificate', label: 'Domicile Certificate' },
]

const ELEMENT_ICON_MAP = {
  stamp:     <Stamp    className="w-5 h-5" />,
  signature: <PenTool  className="w-5 h-5" />,
  photo:     <User     className="w-5 h-5" />,
  seal:      <Shield   className="w-5 h-5" />,
  watermark: <FileText className="w-5 h-5" />,
}

const PROCESSING_STEPS = [
  { label: 'Uploading',            icon: <Upload   className="w-4 h-4" /> },
  { label: 'OCR & Classification', icon: <ScanLine className="w-4 h-4" /> },
  { label: 'Extracting Fields',    icon: <FileText className="w-4 h-4" /> },
  { label: 'Fraud Detection',      icon: <Shield   className="w-4 h-4" /> },
  { label: 'Visual Analysis',      icon: <Zap      className="w-4 h-4" /> },
  { label: 'Finalizing',           icon: <Sparkles className="w-4 h-4" /> },
]

// Dark mode style helpers
const d = (dark, light) => dark  // used as: style={isDark ? d({...}) : {}}

const VerifyDoc = () => {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [file, setFile]             = useState(null)
  const [documentType, setDocumentType] = useState('')
  const [uploading, setUploading]   = useState(false)
  const [progress, setProgress]     = useState(0)
  const [stepIndex, setStepIndex]   = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [uploadedId, setUploadedId] = useState(null)

  const { doc, explanation, loadingDoc, loadingExplain, load, reset } = useDocumentDetail()

  const onDrop = useCallback((accepted) => {
    if (accepted.length > 0) { setFile(accepted[0]); setUploadError(''); reset(); setUploadedId(null) }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png'], 'application/pdf': ['.pdf'] },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
  })

  const handleUpload = async () => {
    if (!file) return
    setUploading(true); setProgress(5); setStepIndex(0); setUploadError(''); reset()
    const formData = new FormData()
    formData.append('file', file)
    if (documentType) formData.append('document_type', documentType)
    try {
      const { data } = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => setProgress(Math.min(Math.round((e.loaded * 100) / e.total), 15)),
      })
      setUploadedId(data.id); pollStatus(data.id)
    } catch (err) { setUploadError(err.response?.data?.detail || 'Upload failed'); setUploading(false) }
  }

  const pollStatus = (id) => {
    let attempts = 0
    let errorCount = 0
    const MAX_ERRORS = 5      // allow up to 5 network errors before giving up
    const MAX_ATTEMPTS = 60   // ~2.5 minutes max polling time

    const check = async () => {
      try {
        const { data } = await api.get(`/documents/${id}/status`)
        attempts++
        errorCount = 0  // reset error count on success
        setStepIndex(Math.min(Math.floor(attempts / 2) + 1, PROCESSING_STEPS.length - 1))
        setProgress(Math.min(15 + attempts * 7, 88))

        if (data.status === 'completed') {
          setProgress(95); setStepIndex(PROCESSING_STEPS.length - 1)
          await load(id); setProgress(100); setUploading(false)
        } else if (data.status === 'failed') {
          setUploadError(data.error_message || 'Processing failed')
          setUploading(false)
        } else if (attempts >= MAX_ATTEMPTS) {
          setUploadError('Processing is taking too long. Please try again.')
          setUploading(false)
        } else {
          setTimeout(check, 2500)
        }
      } catch (err) {
        errorCount++
        console.warn(`Poll attempt ${attempts} failed (${errorCount}/${MAX_ERRORS}):`, err)
        if (errorCount >= MAX_ERRORS) {
          setUploadError('Connection error. Please refresh and check your document in the Dashboard.')
          setUploading(false)
        } else {
          // Retry after a short delay — don't give up on transient errors
          setTimeout(check, 3000)
        }
      }
    }
    check()
  }

  const handleReset = () => { setFile(null); setUploadError(''); setProgress(0); setStepIndex(0); setUploadedId(null); reset() }

  const hasResults = doc && !loadingDoc

  // Dark mode styles
  const cardStyle    = isDark ? { backgroundColor: '#1e2535', borderColor: '#2d3748' } : {}
  const textMain     = isDark ? { color: '#d1d5db' } : {}
  const textSub      = isDark ? { color: '#6b7280' } : {}
  const textLabel    = isDark ? { color: '#4b5563' } : {}
  const inputStyle   = isDark ? { backgroundColor: '#252d40', borderColor: '#2d3748', color: '#d1d5db' } : {}
  const dropzoneBase = isDark ? { borderColor: '#374151', backgroundColor: '#1e2535' } : {}
  const dropzoneHover= isDark ? { borderColor: '#3b82f6', backgroundColor: '#1e2535' } : {}
  const fieldCard    = isDark ? { backgroundColor: '#252d40', borderColor: '#374151' } : {}
  const sectionIcon  = isDark ? { backgroundColor: '#252d40' } : {}

  const fraudRowStyle = (isSusp) => isDark
    ? { backgroundColor: isSusp ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.08)', borderColor: isSusp ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)' }
    : {}

  const visualRowStyle = (isPresent) => isDark
    ? { backgroundColor: isPresent ? 'rgba(59,130,246,0.1)' : '#252d40', borderColor: isPresent ? 'rgba(59,130,246,0.2)' : '#374151' }
    : {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="section-title" style={textMain}>Verify Document</h2>
          <p className="mt-1 text-sm" style={textSub}>Upload any government document for instant AI-powered verification</p>
        </div>
        {hasResults && (
          <Link to={`/details?id=${uploadedId}`}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-accent-600 rounded-xl hover:bg-accent-700 transition-colors shadow-sm">
            Full Report <ArrowUpRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      <div className="flex flex-col items-center space-y-6">

        {/* Upload Panel */}
        <div className="w-full max-w-2xl space-y-4">

          {/* Doc type */}
          <div className="card p-5" style={cardStyle}>
            <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={textLabel}>Document Type</label>
            <div className="relative">
              <select value={documentType} onChange={e => setDocumentType(e.target.value)}
                className="input-field pr-10 appearance-none w-full text-sm" style={inputStyle} disabled={uploading}>
                {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={textSub} />
            </div>
          </div>

          {/* Dropzone */}
          <div className="card p-5" style={cardStyle}>
            <label className="block text-xs font-bold uppercase tracking-widest mb-3" style={textLabel}>Upload File</label>
            <div {...getRootProps()}
              style={isDragActive ? { ...dropzoneBase, borderColor: '#3b82f6', backgroundColor: isDark ? '#1a2744' : undefined, transform: 'scale(1.01)' } : dropzoneBase}
              className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200
                ${!isDark && (isDragActive ? 'border-accent-400 bg-accent-50 scale-[1.01]' : 'border-primary-200 hover:border-accent-300 hover:bg-primary-50/60')}
                ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <input {...getInputProps()} />
              {file ? (
                <div className="flex items-center gap-3 text-left">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border"
                    style={isDark ? { backgroundColor: 'rgba(37,99,235,0.15)', borderColor: 'rgba(37,99,235,0.3)' } : { backgroundColor: '#eff6ff', borderColor: '#dbeafe' }}>
                    <File className="w-6 h-6 text-accent-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={textMain}>{file.name}</p>
                    <p className="text-xs mt-0.5" style={textSub}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  {!uploading && (
                    <button onClick={e => { e.stopPropagation(); handleReset() }}
                      className="p-2 rounded-lg transition-colors flex-shrink-0"
                      style={isDark ? { backgroundColor: 'rgba(239,68,68,0.1)' } : {}}>
                      <X className="w-4 h-4 text-red-400" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto transition-colors"
                    style={isDark ? { backgroundColor: '#252d40' } : { backgroundColor: '#f8fafc' }}>
                    <Upload className="w-7 h-7" style={isDark ? { color: '#4b5563' } : { color: '#cbd5e1' }} />
                  </div>
                  <div>
                    <p className="font-semibold" style={textMain}>{isDragActive ? 'Drop it here!' : 'Drag & drop your document'}</p>
                    <p className="text-xs mt-1" style={textSub}>or click to browse · JPG, PNG, PDF · Max 10MB</p>
                  </div>
                </div>
              )}
            </div>

            {uploadError && (
              <div className="mt-3 flex items-start gap-2 p-3 rounded-xl border"
                style={isDark ? { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)' } : { backgroundColor: '#fef2f2', borderColor: '#fee2e2' }}>
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-500">{uploadError}</p>
              </div>
            )}

            {uploading && (
              <div className="mt-5 space-y-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium flex items-center gap-1.5" style={textMain}>
                    <Loader2 className="w-3 h-3 animate-spin text-accent-500" />
                    {PROCESSING_STEPS[stepIndex]?.label}...
                  </span>
                  <span className="font-bold text-accent-500">{progress}%</span>
                </div>
                <ProgressBar value={progress} size="lg" showValue={false} />
                <div className="flex gap-1 mt-2">
                  {PROCESSING_STEPS.map((_, i) => (
                    <div key={i} className={`flex-1 h-1 rounded-full transition-all duration-500 ${i <= stepIndex ? 'bg-accent-500' : ''}`}
                      style={i > stepIndex ? (isDark ? { backgroundColor: '#2d3748' } : { backgroundColor: '#e2e8f0' }) : {}} />
                  ))}
                </div>
              </div>
            )}

            <button onClick={handleUpload} disabled={!file || uploading}
              className="btn-primary w-full mt-4 py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
              {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : <><Sparkles className="w-4 h-4" /> Upload & Verify Document</>}
            </button>
          </div>

          {/* Trust badges */}
          {!hasResults && !uploading && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: <Brain  className="w-5 h-5 text-accent-500" />,   iconBg: isDark ? 'rgba(37,99,235,0.15)' : '#eff6ff',  title: 'AI Classification', desc: '11+ document types' },
                { icon: <Lock   className="w-5 h-5 text-emerald-500" />,  iconBg: isDark ? 'rgba(16,185,129,0.12)' : '#ecfdf5',  title: 'Fraud Detection',   desc: 'ELA & metadata checks' },
                { icon: <Shield className="w-5 h-5 text-purple-400" />,   iconBg: isDark ? 'rgba(168,85,247,0.12)' : '#faf5ff',  title: 'Visual Scan',       desc: 'Stamp, seal & signature' },
              ].map((f, i) => (
                <div key={i} className="card p-4 text-center" style={cardStyle}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: f.iconBg }}>{f.icon}</div>
                  <p className="text-xs font-bold" style={textMain}>{f.title}</p>
                  <p className="text-xs mt-0.5" style={textSub}>{f.desc}</p>
                </div>
              ))}
            </div>
          )}

          {loadingDoc && (
            <div className="card p-8 flex flex-col items-center justify-center gap-3" style={cardStyle}>
              <Loader2 className="w-6 h-6 animate-spin text-accent-500" />
              <p className="text-sm" style={textSub}>Loading results...</p>
            </div>
          )}
        </div>

        {/* Results Panel */}
        {hasResults && (
          <div className="w-full space-y-4">

            {/* Success banner */}
            <div className="flex items-center justify-between p-4 rounded-2xl border"
              style={isDark ? { backgroundColor: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.25)' } : { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={isDark ? { backgroundColor: 'rgba(16,185,129,0.15)' } : { backgroundColor: '#dcfce7' }}>
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-500">Processed successfully</p>
                  <p className="text-xs text-emerald-600 capitalize mt-0.5">{doc.document_type?.replace(/_/g, ' ') || 'Unknown'} · {doc.file_name}</p>
                </div>
              </div>
              <button onClick={handleReset} className="text-xs underline transition-colors" style={textSub}>Verify another</button>
            </div>

            {/* Score panel */}
            {(() => {
              const scores = [
                { score: Math.round(doc.confidence_score || 0),              label: 'Confidence', bar: '#3b82f6', darkText: '#60a5fa', lightText: 'text-blue-600',    softDark: 'rgba(59,130,246,0.15)',  softLight: 'bg-blue-50 text-blue-700'   },
                { score: Math.round(doc.summary?.avg_field_confidence || 0), label: 'Fields',     bar: '#10b981', darkText: '#34d399', lightText: 'text-emerald-600', softDark: 'rgba(16,185,129,0.15)',  softLight: 'bg-emerald-50 text-emerald-700' },
                { score: Math.round(100 - (doc.fraud_risk_score || 0)),      label: 'Security',   bar: '#8b5cf6', darkText: '#a78bfa', lightText: 'text-purple-600',  softDark: 'rgba(139,92,246,0.15)',  softLight: 'bg-purple-50 text-purple-700'  },
                { score: Math.round(doc.visual_confidence_score || 0),       label: 'Visual',     bar: '#f59e0b', darkText: '#fbbf24', lightText: 'text-amber-600',   softDark: 'rgba(245,158,11,0.15)',  softLight: 'bg-amber-50 text-amber-700'    },
              ]
              const overall = Math.round(scores.reduce((a, s) => a + s.score, 0) / scores.length)
              const overallColor = overall >= 70 ? '#10b981' : overall >= 40 ? '#f59e0b' : '#ef4444'
              const overallBorderColor = overall >= 70 ? (isDark ? 'rgba(16,185,129,0.3)' : '#bbf7d0') : overall >= 40 ? (isDark ? 'rgba(245,158,11,0.3)' : '#fde68a') : (isDark ? 'rgba(239,68,68,0.3)' : '#fecaca')
              const overallBg = overall >= 70 ? (isDark ? 'rgba(16,185,129,0.07)' : '#f0fdf4') : overall >= 40 ? (isDark ? 'rgba(245,158,11,0.07)' : '#fffbeb') : (isDark ? 'rgba(239,68,68,0.07)' : '#fef2f2')
              return (
                <div className="rounded-2xl border-2 overflow-hidden" style={{ backgroundColor: overallBg, borderColor: overallBorderColor }}>
                  <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: overallBorderColor }}>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest" style={textLabel}>Verification Scores</p>
                      <p className="text-sm font-semibold mt-0.5 capitalize" style={textMain}>{doc.document_type?.replace(/_/g, ' ') || 'Document'} Analysis</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium" style={textSub}>Overall</p>
                      <p className="text-3xl font-black" style={{ color: overallColor }}>{overall}<span className="text-lg">%</span></p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 divide-x" style={{ borderColor: overallBorderColor }}>
                    {scores.map((s, i) => (
                      <div key={i} className="px-5 py-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-bold uppercase tracking-wider" style={textLabel}>{s.label}</span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={isDark ? { backgroundColor: s.softDark, color: s.darkText } : {}}>
                            {s.score >= 70 ? 'Good' : s.score >= 40 ? 'Fair' : 'Low'}
                          </span>
                        </div>
                        <p className="text-4xl font-black leading-none mb-3" style={{ color: isDark ? s.darkText : undefined }}>
                          {!isDark && <span className={s.lightText}>{s.score}</span>}
                          {isDark && s.score}
                          <span className="text-xl font-bold">%</span>
                        </p>
                        <div className="h-1.5 rounded-full overflow-hidden" style={isDark ? { backgroundColor: '#2d3748' } : { backgroundColor: '#e2e8f0' }}>
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${s.score}%`, backgroundColor: s.bar }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Fraud + Visual */}
            <div className="grid grid-cols-2 gap-4">
              <div className="card p-4" style={cardStyle}>
                <h4 className="text-sm font-bold mb-3 flex items-center gap-2" style={textMain}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={isDark ? { backgroundColor: 'rgba(239,68,68,0.15)' } : { backgroundColor: '#fef2f2' }}>
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  </div>
                  Fraud Analysis
                </h4>
                <div className="space-y-2">
                  {doc.fraud_checks?.map((c, i) => (
                    <div key={i} className="p-3 rounded-xl border" style={fraudRowStyle(c.is_suspicious)}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold capitalize" style={textMain}>{c.check_type.replace(/_/g, ' ')}</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={c.is_suspicious
                            ? { backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171' }
                            : { backgroundColor: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                          {c.is_suspicious ? 'Suspicious' : 'Clean'}
                        </span>
                      </div>
                      <ProgressBar value={c.risk_score} size="sm" />
                      {c.details?.issues?.length > 0 && (
                        <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {c.details.issues.join(', ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="card p-4" style={cardStyle}>
                <h4 className="text-sm font-bold mb-3 flex items-center gap-2" style={textMain}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={isDark ? { backgroundColor: 'rgba(168,85,247,0.15)' } : { backgroundColor: '#faf5ff' }}>
                    <Shield className="w-4 h-4 text-purple-500" />
                  </div>
                  Visual Elements
                </h4>
                <div className="space-y-2">
                  {doc.visual_elements?.map((el, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl border" style={visualRowStyle(el.is_present)}>
                      <div className="flex items-center gap-2.5">
                        <span style={{ color: el.is_present ? '#60a5fa' : (isDark ? '#4b5563' : '#cbd5e1') }}>
                          {ELEMENT_ICON_MAP[el.element_type]}
                        </span>
                        <span className="text-xs font-semibold capitalize" style={textMain}>{el.element_type}</span>
                      </div>
                      {el.is_present
                        ? <span className="text-xs font-bold text-blue-400">{el.confidence_score}%</span>
                        : <span className="text-xs" style={textSub}>Not found</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* AI Summary */}
            {(loadingExplain || explanation) && (
              <div className="card p-4 border-2" style={isDark
                ? { backgroundColor: 'rgba(37,99,235,0.08)', borderColor: 'rgba(59,130,246,0.25)' }
                : { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold flex items-center gap-2" style={textMain}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={isDark ? { backgroundColor: 'rgba(37,99,235,0.2)' } : { backgroundColor: 'rgba(255,255,255,0.7)' }}>
                      <Brain className="w-4 h-4 text-accent-500" />
                    </div>
                    AI Verification Summary
                  </h4>
                  {explanation?.verdict && <Badge variant={{ APPROVE: 'success', REVIEW: 'warning', REJECT: 'danger' }[explanation.verdict]}>{explanation.verdict}</Badge>}
                </div>
                {loadingExplain ? (
                  <div className="flex items-center gap-2 text-sm py-2" style={textSub}>
                    <Loader2 className="w-4 h-4 animate-spin text-accent-500" /> Generating analysis...
                  </div>
                ) : (
                  <div>
                    <p className="text-sm leading-relaxed" style={textMain}>{explanation.explanation}</p>
                    {explanation.valid_fields_count !== undefined && (
                      <div className="flex gap-4 text-xs mt-3 pt-3 border-t" style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                        <span className="text-emerald-500 font-semibold">✓ {explanation.valid_fields_count} valid</span>
                        <span className="text-red-500 font-semibold">✗ {explanation.invalid_fields_count} missing</span>
                        {explanation.suspicious_checks_count > 0 && <span className="text-amber-500 font-semibold">⚠ {explanation.suspicious_checks_count} suspicious</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Extracted Fields */}
            <div className="card p-4" style={cardStyle}>
              <h4 className="text-sm font-bold mb-4 flex items-center gap-2" style={textMain}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={isDark ? { backgroundColor: 'rgba(37,99,235,0.15)' } : { backgroundColor: '#eff6ff' }}>
                  <FileText className="w-4 h-4 text-accent-500" />
                </div>
                Extracted Fields
                <span className="text-xs font-normal px-2 py-0.5 rounded-full ml-1"
                  style={isDark ? { backgroundColor: '#252d40', color: '#6b7280' } : { backgroundColor: '#f1f5f9', color: '#94a3b8' }}>
                  {doc.extracted_fields?.length || 0} fields
                </span>
              </h4>
              {doc.extracted_fields?.length ? (
                <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                  {doc.extracted_fields.map((f, i) => (
                    <div key={i} className="p-3 rounded-xl border" style={fieldCard}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-bold uppercase tracking-wider" style={textLabel}>{f.field_name.replace(/_/g, ' ')}</p>
                        <div className="flex items-center gap-1">
                          <span className="text-xs" style={textSub}>{f.confidence_score}%</span>
                          {f.is_valid ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                        </div>
                      </div>
                      <p className="text-sm font-bold mt-1 truncate" style={textMain}>
                        {f.field_value || <span className="italic font-normal text-xs" style={textSub}>Not detected</span>}
                      </p>
                      {f.validation_message && f.validation_message !== 'Valid' && (
                        <p className="text-xs text-red-500 mt-1">{f.validation_message}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-20" style={textSub} />
                  <p className="text-sm italic" style={textSub}>No fields extracted</p>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}

export default VerifyDoc