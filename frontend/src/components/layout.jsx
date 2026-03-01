import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

const Layout = () => {
  return (
    <div className="flex min-h-screen bg-primary-50 dark:bg-dark-100 transition-colors duration-300">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto min-w-0">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default Layout