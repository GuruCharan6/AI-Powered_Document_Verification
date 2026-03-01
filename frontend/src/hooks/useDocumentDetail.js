import { useState } from 'react'
import api from '../services/api'

/**
 * Shared hook: fetch a document's full detail, then fetch AI explanation
 * only when the doc is completed AND has extracted fields.
 */
export function useDocumentDetail() {
  const [doc, setDoc] = useState(null)
  const [explanation, setExplanation] = useState(null)
  const [loadingDoc, setLoadingDoc] = useState(false)
  const [loadingExplain, setLoadingExplain] = useState(false)
  const [error, setError] = useState('')

  const load = async (id) => {
    if (!id) return
    setDoc(null)
    setExplanation(null)
    setError('')
    setLoadingDoc(true)

    try {
      const { data } = await api.get(`/documents/${id}`)
      setDoc(data)
      setLoadingDoc(false)

      // Only call /explain when doc is completed AND has fields to explain
      const hasFields = data.extracted_fields?.length > 0
      const isReady   = data.status === 'completed'

      if (isReady && hasFields) {
        setLoadingExplain(true)
        try {
          const { data: exp } = await api.get(`/documents/${id}/explain`)
          setExplanation(exp)
        } catch (e) {
          console.warn('Explanation unavailable:', e.response?.data?.detail || e.message)
          setExplanation(null)
        } finally {
          setLoadingExplain(false)
        }
      }
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load document')
      setLoadingDoc(false)
    }
  }

  const reset = () => {
    setDoc(null)
    setExplanation(null)
    setError('')
  }

  return { doc, explanation, loadingDoc, loadingExplain, error, load, reset }
}
