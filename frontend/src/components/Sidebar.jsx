import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/Themecontext'
import {
  FileCheck,
  LayoutDashboard,
  ClipboardList,
  LogOut,
  User,
  Sun,
  Moon,
} from 'lucide-react'
import DocSentinelLogo from './DocSentinelLogo'

const Sidebar = () => {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const navigation = [
    { name: 'Verify Doc',  href: '/',          icon: FileCheck       },
    { name: 'Dashboard',   href: '/dashboard',  icon: LayoutDashboard },
    { name: 'Audit Logs',  href: '/logs',       icon: ClipboardList   },
  ]

  return (
    <div style={theme === 'dark' ? { backgroundColor: '#1e2535', borderColor: '#2d3748' } : {}}
      className="w-64 bg-white border-r border-primary-200/60 flex flex-col h-screen sticky top-0 transition-colors duration-300">

      {/* Logo */}
      <div className="p-5 border-b border-primary-100"
        style={theme === 'dark' ? { borderColor: '#2d3748' } : {}}>
        <div className="flex items-center gap-3">
          <DocSentinelLogo size={38} />
          <div>
            <h1 className="font-black tracking-tight text-base leading-tight"
              style={theme === 'dark' ? { color: '#d1d5db' } : { color: '#0f172a' }}>
              DocSentinel
            </h1>
            <p className="text-xs font-medium"
              style={theme === 'dark' ? { color: '#6b7280' } : { color: '#94a3b8' }}>
              AI Verification
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <p className="text-xs font-bold uppercase tracking-widest px-4 mb-3"
          style={theme === 'dark' ? { color: '#4b5563' } : { color: '#cbd5e1' }}>
          Menu
        </p>
        {navigation.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.name}
              to={item.href}
              end={item.href === '/'}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.name}
            </NavLink>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="p-4 space-y-2 border-t border-primary-100"
        style={theme === 'dark' ? { borderColor: '#2d3748' } : {}}>

        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
          style={theme === 'dark'
            ? { color: '#9ca3af', backgroundColor: 'transparent' }
            : { color: '#475569' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = theme === 'dark' ? '#252d40' : '#f1f5f9'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <div className="flex items-center gap-3">
            {theme === 'dark'
              ? <Sun  className="w-4 h-4 text-amber-500" />
              : <Moon className="w-4 h-4 text-primary-500" />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </div>
          {/* Toggle pill */}
          <div className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${theme === 'dark' ? 'bg-accent-600' : 'bg-primary-200'}`}>
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${theme === 'dark' ? 'left-5' : 'left-0.5'}`} />
          </div>
        </button>

        {/* User */}
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
          style={theme === 'dark' ? { backgroundColor: '#252d40' } : { backgroundColor: '#f8fafc' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={theme === 'dark' ? { backgroundColor: 'rgba(37,99,235,0.2)' } : { backgroundColor: '#dbeafe' }}>
            <User className="w-4 h-4 text-accent-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate leading-tight"
              style={theme === 'dark' ? { color: '#d1d5db' } : { color: '#0f172a' }}>
              {user?.full_name}
            </p>
            <p className="text-xs truncate"
              style={theme === 'dark' ? { color: '#6b7280' } : { color: '#94a3b8' }}>
              {user?.email}
            </p>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-500 rounded-xl hover:bg-red-50 transition-colors duration-200"
          style={theme === 'dark' ? { color: '#f87171' } : {}}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(239,68,68,0.1)' : '#fef2f2'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  )
}

export default Sidebar