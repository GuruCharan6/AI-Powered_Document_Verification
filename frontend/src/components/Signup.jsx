import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'  // FIX 3: useNavigate moved here
import { useAuth } from '../context/AuthContext'
import { Shield, Loader2 } from 'lucide-react'

const Signup = () => {
  const [form, setForm] = useState({ email: '', password: '', full_name: '', department: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signup } = useAuth()
  const navigate = useNavigate()  // FIX 3: navigation handled here, inside the Router

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signup(form)
      navigate('/')  // FIX 3: redirect to home after successful signup
    } catch (err) {
      let errorMsg = 'Signup failed'
      if (err.response) {
        errorMsg = err.response.data?.detail || err.response.data?.message || `Server error: ${err.response.status}`
      } else if (err.request) {
        errorMsg = 'Cannot connect to server. Is the backend running on port 8000?'
      } else {
        errorMsg = err.message
      }
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-accent-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-accent-500/30">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-primary-900">Create account</h1>
          <p className="text-primary-500 mt-1">Start verifying documents</p>
        </div>

        <div className="card p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm">
              <p className="font-medium">Error: {error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label-text block mb-2">Full Name</label>
              <input type="text" required className="input-field" value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="John Doe" />
            </div>

            <div>
              <label className="label-text block mb-2">Email</label>
              <input type="email" required className="input-field" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@example.com" />
            </div>

            <div>
              <label className="label-text block mb-2">Department (Optional)</label>
              <input type="text" className="input-field" value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="IT, HR, etc." />
            </div>

            <div>
              <label className="label-text block mb-2">Password</label>
              <input type="password" required minLength={8} className="input-field" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
              <p className="text-xs text-primary-400 mt-1">Minimum 8 characters</p>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating account...
                </span>
              ) : 'Create account'}
            </button>
          </form>

          <p className="text-center text-sm text-primary-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-accent-600 font-medium hover:text-accent-700">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Signup
