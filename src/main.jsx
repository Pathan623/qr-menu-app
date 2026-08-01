import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom'
import CustomerMenu from './pages/CustomerMenu.jsx'
import KitchenDashboard from './pages/KitchenDashboard.jsx'
import AdminPanel from './pages/AdminPanel.jsx'
import SignupPage from './pages/SignupPage.jsx'
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

function Home() {
  return (
    <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h2>TapNServe</h2>
      <p>Use your restaurant link, e.g. /r/your-restaurant-slug/admin</p>
      <p><a href="/signup">Register a new restaurant</a></p>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/r/:slug/menu/:tableNumber" element={<CustomerMenuWithKey />} />
        <Route path="/r/:slug/kitchen" element={<KitchenWithKey />} />
        <Route path="/r/:slug/admin" element={<AdminWithKey />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)