import { useAuth } from '../../context/AuthContext'
import { Bell, Search, User, Menu } from 'lucide-react'
import Button from './Button'

const Header = ({ onMenuClick, title = 'GovDoc AI' }) => {
  const { user } = useAuth()

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-primary-200/60">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMenuClick}
          >
            <Menu className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-semibold text-primary-900 tracking-tight">
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="hidden md:flex items-center bg-primary-50 rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-primary-400 mr-2" />
            <input
              type="text"
              placeholder="Search..."
              className="bg-transparent text-sm text-primary-900 placeholder:text-primary-400 outline-none w-48"
            />
          </div>

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-5 h-5 text-primary-600" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </Button>

          {/* User */}
          <div className="flex items-center gap-3 pl-4 border-l border-primary-200">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-primary-900">{user?.full_name}</p>
              <p className="text-xs text-primary-500">{user?.role || 'Operator'}</p>
            </div>
            <div className="w-10 h-10 bg-accent-100 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-accent-600" />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header