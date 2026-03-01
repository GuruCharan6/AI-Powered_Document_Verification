import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/Themecontext'
import Layout from './components/layout'
import Login from './components/Login'
import Signup from './components/Signup'
import VerifyDoc from './components/VerifyDoc'
import ExtractedDetails from './components/ExtractedDetails'
import Dashboard from './components/Dashboard'
import AuditLogs from './components/Auditlogs'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login"  element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route index            element={<VerifyDoc />} />
              <Route path="details"   element={<ExtractedDetails />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="logs"      element={<AuditLogs />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  )
}

export default App