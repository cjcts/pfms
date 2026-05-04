import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import ExpenseEntry from './pages/ExpenseEntry.jsx'
import CreditCard from './pages/CreditCard.jsx'
import Income from './pages/Income.jsx'
import HomeExpenses from './pages/HomeExpenses.jsx'
import OwedOwing from './pages/OwedOwing.jsx'
import History from './pages/History.jsx'
import PredictableExpenses from './pages/PredictableExpenses.jsx'
import BudgetPlanner from './pages/BudgetPlanner.jsx'
import Admin from './pages/Admin.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"    element={<Dashboard />} />
        <Route path="expenses"     element={<ExpenseEntry />} />
        <Route path="credit-card"  element={<CreditCard />} />
        <Route path="income"       element={<Income />} />
        <Route path="home"         element={<HomeExpenses />} />
        <Route path="owed-owing"   element={<OwedOwing />} />
        <Route path="history"      element={<History />} />
        <Route path="predictable"  element={<PredictableExpenses />} />
        <Route path="budget"       element={<BudgetPlanner />} />
        <Route path="admin"        element={<Admin />} />
      </Route>
    </Routes>
  )
}
