import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom'
import CustomerMenu from './pages/CustomerMenu.jsx'
import KitchenDashboard from './pages/KitchenDashboard.jsx'
import AdminPanel from './pages/AdminPanel.jsx'
import LandingPage from './pages/LandingPage.jsx'
import './index.css'

function CustomerMenuWithKey() {
  const { slug, tableNumber } = useParams()
  return <CustomerMenu key={`${slug}-${tableNumber}`} />
}

function KitchenWithKey() {
  const { slug } = useParams()
  return <KitchenDashboard key={slug} />
}

function AdminWithKey() {
  const { slug } = useParams()
  return <AdminPanel key={slug} />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/r/:slug/menu/:tableNumber" element={<CustomerMenuWithKey />} />
        <Route path="/r/:slug/kitchen" element={<KitchenWithKey />} />
        <Route path="/r/:slug/admin" element={<AdminWithKey />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)