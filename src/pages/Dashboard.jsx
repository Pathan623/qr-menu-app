import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Dashboard() {
  const { adminToken } = useParams()
  const [restaurant, setRestaurant] = useState(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    supabase.from('restaurants').select('*').eq('admin_token', adminToken).single()
      .then(({ data, error }) => {
        if (error || !data) setNotFound(true)
        else setRestaurant(data)
      })
  }, [adminToken])

  if (notFound) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Restaurant not found.</div>
  }

  if (!restaurant) return null

  return (
    <div className="dashboard-page">
      <h1 style={{ fontFamily: 'var(--font-display)', textAlign: 'center', marginBottom: 4 }}>
        {restaurant.name}
      </h1>
      <p style={{ textAlign: 'center', opacity: 0.7, marginBottom: 36 }}>
        What would you like to open?
      </p>

      <div className="dashboard-choices">
        <Link to={`/admin/${adminToken}`} className="dashboard-card">
          <div className="dashboard-card-title">Admin Panel</div>
          <div className="dashboard-card-desc">Menu items, table QR codes, restaurant settings</div>
        </Link>

        <Link to={`/kitchen/${adminToken}`} className="dashboard-card">
          <div className="dashboard-card-title">Kitchen Dashboard</div>
          <div className="dashboard-card-desc">Live incoming orders, print bills</div>
        </Link>
      </div>
    </div>
  )
}