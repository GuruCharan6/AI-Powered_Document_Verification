import axios from 'axios'

// For Vite, use VITE_ prefix for environment variables
// If not available (production), default to the hardcoded URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://ai-powered-document-verification.onrender.com'

console.log('🔗 API_BASE_URL:', API_BASE_URL)
console.log('📦 Environment:', import.meta.env.MODE)

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 70000, // 70 seconds for document processing
})

// Add request logging
api.interceptors.request.use((config) => {
  console.log('📤 API Request:', config.method.toUpperCase(), config.url)
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => {
    console.log('📥 API Response:', response.status, response.config.url)
    return response
  },
  (error) => {
    console.error('❌ API Error:', error.message)
    if (error.code === 'ERR_NETWORK') {
      console.error(`Cannot connect to backend at ${API_BASE_URL}`)
    }
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api