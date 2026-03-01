import { createContext, useState, useContext, useEffect } from 'react'
import api from '../services/api'            // api.js lives in src/hooks/api.js

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  // FIX 3: removed useNavigate() — AuthProvider sits OUTSIDE <Router> in App.jsx
  //         so calling useNavigate() here crashes the app.
  //         Navigation is now handled inside Login.jsx / Signup.jsx instead.

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      fetchUser()
    } else {
      setLoading(false)
    }
  }, [])

  const fetchUser = async () => {
    try {
      const response = await api.get('/auth/me')  // FIX 2: was '/auth/me'
      setUser(response.data)
    } catch (error) {
      // Token expired or invalid — clear silently
      localStorage.removeItem('token')
      delete api.defaults.headers.common['Authorization']
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password })  // FIX 2: was '/auth/login'
    const { access_token, user: userData } = response.data
    localStorage.setItem('token', access_token)
    api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
    setUser(userData)
    // FIX 3: navigate('/') removed — Login.jsx handles redirect after this resolves
  }

  const signup = async (userData) => {
    const response = await api.post('/auth/signup', userData)  // FIX 2: was '/auth/signup'
    const { access_token, user: newUser } = response.data
    localStorage.setItem('token', access_token)
    api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
    setUser(newUser)
    // FIX 3: navigate('/') removed — Signup.jsx handles redirect after this resolves
  }

  const logout = () => {
    localStorage.removeItem('token')
    delete api.defaults.headers.common['Authorization']
    setUser(null)
    // FIX 3: navigate('/login') removed — ProtectedRoute auto-redirects when user is null
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, signup, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
