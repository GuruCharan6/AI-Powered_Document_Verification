import {
  FileText, AlertTriangle, CheckCircle, XCircle,
  Shield, Brain, Loader2, Stamp, PenTool, User
} from 'lucide-react'
import ScoreRing from './ui/ScoreRing'
import ProgressBar from './ui/ProgressBar'
import Badge from './ui/Badge'

const verdictColor = {
  APPROVE: 'bg-emerald-50 border-emerald-200',
  REVIEW:  'bg-amber-50  border-amber-200',
  REJECT:  'bg-red-50    border-red-200',
}
const verdictVariant = { APPROVE: 'success', REVIEW: 'warning', REJECT: 'danger' }

const ELEMENT_ICONS = {
  stamp:     (cls) => <Stamp    className={`w-5 h-5 mx-auto mb-1 ${cls}`} />,
  signature: (cls) => <PenTool  className={`w-5 h-5 mx-auto mb-1 ${cls}`} />,
  photo:     (cls) => <User     className={`w-5 h-5 mx-auto mb-1 ${cls}`} />,
  seal:      (cls) => <Shield   className={`w-5 h-5 mx-auto mb-1 ${cls}`} />,
  watermark: (cls) => <FileText className={`w-5 h-5 mx-auto mb-1 ${cls}`} />,
}

/**
 * DocumentDetailPanel
 * Props:
 *   doc          – DocumentDetailResponse object
 *   explanation  – explain endpoint response (flat: {explanation, verdict, ...})
 *   loadingExplain – boolean
 *   compact      – boolean (smaller layout for side panels)
 */
const DocumentDetailPanel = ({ doc, explanation, loadingExplain, compact = false }) => {
  if (!doc) return null

  const ringSize = compact ? 72 : 90

  return (
    <div className="space-y-4">

      {/* Scores */}
      <div className={`grid gap-3 ${compact ? 'grid-cols-4' : 'grid-cols-4'}`}>
        {[
          { score: Math.round(doc.confidence_score || 0),                          label: 'Confidence' },
          { score: Math.round(doc.summary?.avg_field_confidence || 0),             label: 'Fields' },
          { score: Math.round(100 - (doc.fraud_risk_score || 0)),                  label: 'Security' },
          { score: Math.round(doc.visual_confidence_score || 0),                   label: 'Visual' },
        ].map((s, i) => (
          <div key={i} className="card p-3 flex flex-col items-center">
            <ScoreRing score={s.score} size={ringSize} label={s.label} />
          </div>
        ))}
      </div>

      <div className={`grid gap-4 ${compact ? 'grid-cols-1' : 'grid-cols-2'}`}>

        {/* Extracted Fields */}
        <div className="card p-4">
          <h4 className="font-semibold text-primary-800 mb-3 flex items-center gap-2 text-sm">
            <FileText className="w-4 h-4 text-accent-600" /> Extracted Fields
          </h4>
          {doc.extracted_fields?.length ? (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {doc.extracted_fields.map((f, i) => (
                <div key={i} className="flex items-start justify-between p-2.5 bg-primary-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold uppercase text-primary-400 mb-0.5">
                      {f.field_name.replace(/_/g, ' ')}
                    </p>
                    <p className="text-sm font-medium text-primary-900 truncate">
                      {f.field_value
                        ? f.field_value
                        : <span className="text-primary-300 italic font-normal">Not detected</span>}
                    </p>
                    {f.validation_message && f.validation_message !== 'Valid' && (
                      <p className="text-xs text-red-500 mt-0.5">{f.validation_message}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                    <span className="text-xs text-primary-400">{f.confidence_score}%</span>
                    {f.is_valid
                      ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                      : <XCircle    className="w-3.5 h-3.5 text-red-400" />}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-primary-400 italic">No fields extracted.</p>
          )}
        </div>

        {/* Fraud Checks */}
        <div className="card p-4">
          <h4 className="font-semibold text-primary-800 mb-3 flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-red-500" /> Fraud Analysis
          </h4>
          <div className="space-y-2">
            {doc.fraud_checks?.map((c, i) => (
              <div key={i} className={`p-2.5 rounded-lg border ${c.is_suspicious ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium capitalize">{c.check_type.replace(/_/g, ' ')}</span>
                  <Badge variant={c.is_suspicious ? 'danger' : 'success'}>
                    {c.is_suspicious ? 'Suspicious' : 'Clean'}
                  </Badge>
                </div>
                <ProgressBar value={c.risk_score} size="sm" />
                {c.details && (
                  <div className="mt-1.5 space-y-0.5">
                    {Object.entries(c.details)
                      .filter(([k, v]) => k !== 'error' && !Array.isArray(v))
                      .slice(0, 2)
                      .map(([k, v]) => (
                        <div key={k} className="flex justify-between text-xs text-primary-500">
                          <span className="capitalize">{k.replace(/_/g, ' ')}:</span>
                          <span className="font-medium text-primary-700">{String(v)}</span>
                        </div>
                      ))}
                    {c.details.issues?.length > 0 && (
                      <p className="text-xs text-red-500">{c.details.issues.join(', ')}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Visual Elements */}
      <div className="card p-4">
        <h4 className="font-semibold text-primary-800 mb-3 flex items-center gap-2 text-sm">
          <Shield className="w-4 h-4 text-purple-500" /> Visual Elements
        </h4>
        <div className="grid grid-cols-5 gap-2">
          {doc.visual_elements?.map((el, i) => {
            const iconFn  = ELEMENT_ICONS[el.element_type]
            const iconCls = el.is_present
              ? { stamp: 'text-blue-500', signature: 'text-purple-500', photo: 'text-emerald-500', seal: 'text-amber-500', watermark: 'text-indigo-500' }[el.element_type] || 'text-accent-500'
              : 'text-primary-300'
            return (
              <div key={i} className={`p-2.5 rounded-lg text-center ${el.is_present ? 'bg-blue-50 border border-blue-100' : 'bg-primary-50'}`}>
                {iconFn && iconFn(iconCls)}
                <p className="text-xs font-medium text-primary-700 capitalize">{el.element_type}</p>
                <p className={`text-xs ${el.is_present ? 'text-blue-600 font-medium' : 'text-primary-400'}`}>
                  {el.is_present ? `${el.confidence_score}%` : 'Not found'}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* AI Explanation — only if we have one */}
      {(loadingExplain || explanation) && (
        <div className={`card p-4 border ${explanation?.verdict ? verdictColor[explanation.verdict] : 'bg-accent-50 border-accent-100'}`}>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-primary-800 flex items-center gap-2 text-sm">
              <Brain className="w-4 h-4 text-accent-600" /> AI Verification Summary
            </h4>
            {explanation?.verdict && (
              <Badge variant={verdictVariant[explanation.verdict]}>{explanation.verdict}</Badge>
            )}
          </div>

          {loadingExplain ? (
            <div className="flex items-center gap-2 text-primary-400 text-sm">
              <Loader2 className="w-3 h-3 animate-spin" /> Generating analysis...
            </div>
          ) : (
            <div>
              <p className="text-sm text-primary-700 leading-relaxed">{explanation.explanation}</p>
              {explanation.valid_fields_count !== undefined && (
                <div className="flex gap-3 text-xs mt-2 pt-2 border-t border-current/10">
                  <span className="text-emerald-700">✓ {explanation.valid_fields_count} valid</span>
                  <span className="text-red-600">✗ {explanation.invalid_fields_count} missing</span>
                  {explanation.suspicious_checks_count > 0 && (
                    <span className="text-amber-700">⚠ {explanation.suspicious_checks_count} suspicious</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default DocumentDetailPanel
