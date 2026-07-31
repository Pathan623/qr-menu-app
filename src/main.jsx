import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import CustomerMenu from './pages/CustomerMenu.jsx'
import KitchenDashboard from './pages/KitchenDashboard.jsx'
import AdminPanel from './pages/AdminPanel.jsx'
import './index.css'

function CustomerMenuWithKey() {
  const { tableNumber } = useParams()
  return <CustomerMenu key={tableNumber} />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/menu/:tableNumber" element={<CustomerMenuWithKey />} />
        <Route path="/kitchen" element={<KitchenDashboard />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
