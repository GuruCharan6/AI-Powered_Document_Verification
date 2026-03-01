import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'

export const useDocuments = () => {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/documents/')
      setDocuments(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const getDocument = async (id) => {
    try {
      const { data } = await api.get(`/documents/${id}`)
      return data
    } catch (err) {
      throw err
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  return { documents, loading, error, fetchDocuments, getDocument }
}

export default useDocuments