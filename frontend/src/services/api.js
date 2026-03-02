import axios from 'axios'

// Use direct URL to backend
const api = axios.create({
  baseURL: 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 70000, // 60 seconds — documents can take up to ~55s to process
})

// Add request logging
api.interceptors.request.use((config) => {
  console.log('API Request:', config.method.toUpperCase(), config.url)
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.config.url)
    return response
  },
  (error) => {
    console.error('API Error:', error.message)
    if (error.code === 'ERR_NETWORK') {
      console.error('Cannot connect to backend at http://localhost:8000')
    }
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api