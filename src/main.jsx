import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import CustomerMenu from './pages/CustomerMenu.jsx'
import KitchenDashboard from './pages/KitchenDashboard.jsx'
import AdminPanel from './pages/AdminPanel.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/menu/:tableNumber" element={<CustomerMenu />} />
        <Route path="/kitchen" element={<KitchenDashboard />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)