import { Link, useLocation, useParams } from 'react-router-dom'

const NAV_ITEMS = [
  { section: 'admin', label: 'Admin Panel', desc: 'Menu & tables' },
  { section: 'kitchen', label: 'Kitchen', desc: 'Live orders' },
  { section: 'billing', label: 'Billing', desc: 'Subscription' },
]

export default function Sidebar({ restaurantName }) {
  const { adminToken } = useParams()
  const location = useLocation()
  const currentSection = location.pathname.split('/')[1]

  return (
    <aside className="app-sidebar">
      <div className="sidebar-top">
        <div className="sidebar-brand">TapNServe</div>
        {restaurantName && <div className="sidebar-restaurant">{restaurantName}</div>}
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.section}
            to={`/${item.section}/${adminToken}`}
            className={`sidebar-link ${currentSection === item.section ? 'active' : ''}`}
          >
            <span className="sidebar-link-label">{item.label}</span>
            <span className="sidebar-link-desc">{item.desc}</span>
          </Link>
        ))}
      </nav>

      <Link to={`/dashboard/${adminToken}`} className="sidebar-back">
        &larr; Dashboard
      </Link>
    </aside>
  )
}
