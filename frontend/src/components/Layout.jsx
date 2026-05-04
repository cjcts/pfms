import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, PlusCircle, CreditCard, TrendingUp, Home, Users, FileText, CalendarClock, Target, Settings } from 'lucide-react'

const nav = [
  { to: '/dashboard',   label: 'Dashboard',     icon: LayoutDashboard },
  { to: '/expenses',    label: 'Add Expenses',  icon: PlusCircle      },
  { to: '/predictable', label: 'Fixed Expenses',icon: CalendarClock   },
  { to: '/credit-card', label: 'Credit Card',   icon: CreditCard      },
  { to: '/income',      label: 'Income',        icon: TrendingUp      },
  { to: '/owed-owing',  label: 'Owed & Owing',  icon: Users           },
  { to: '/home',        label: 'Home Expenses', icon: Home            },
  { to: '/history',     label: 'Trends',        icon: FileText        },
  { to: '/budget',      label: 'Budget Planner',icon: Target          },
]

export default function Layout() {
  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-medium text-teal-600">PFMS</p>
          <p className="text-xs text-gray-400">Personal Finance</p>
        </div>
        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors
               ${isActive ? 'bg-teal-50 text-teal-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`
            }>
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
          <hr className="border-gray-200 my-2" />
          <NavLink to="/admin" className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors
             ${isActive ? 'bg-teal-50 text-teal-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`
          }>
            <Settings size={16} />
            Admin
          </NavLink>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
