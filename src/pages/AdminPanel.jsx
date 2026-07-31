import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Link } from 'react-router-dom'
import { supabase, RESTAURANT_NAME } from '../supabaseClient'

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'changeme'

export default function AdminPanel() {
  const [authed, setAuthed] = useState(sessionStorage.getItem('admin_authed') === '1')
  const [pw, setPw] = useState('')

  function tryLogin() {
    if (pw === ADMIN_PASSWORD) {
      sessionStorage.setItem('admin_authed', '1')
      setAuthed(true)
    } else {
      alert('Wrong password')
    }
  }

  if (!authed) {
    return (
      <div className="login-box">
        <h1 style={{ fontFamily: 'var(--font-display)' }}>{RESTAURANT_NAME} Admin</h1>
        <input
          type="password"
          placeholder="Admin password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && tryLogin()}
        />
        <button className="admin-btn" onClick={tryLogin}>Log in</button>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>{RESTAURANT_NAME}</h1>
          <div className="admin-sub">Menu &amp; table management</div>
        </div>
        <Link to="/kitchen">
          <button className="admin-btn">Go to Kitchen</button>
        </Link>
      </div>
      <RestaurantSettings />
      <MenuManager />
      <TableManager />
    </div>
  )
}

function RestaurantSettings() {
  const [name, setName] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    supabase.from('restaurant_settings').select('*').eq('id', 1).single()
      .then(({ data }) => {
        setName(data?.name || RESTAURANT_NAME)
        setLoaded(true)
      })
  }, [])

  async function save() {
    const { error } = await supabase
      .from('restaurant_settings')
      .upsert({ id: 1, name })
    if (!error) alert('Saved! Refresh menu/kitchen pages to see the new name.')
    else alert('Could not save, please try again.')
  }

  if (!loaded) return null

  return (
    <div className="admin-section">
      <h2>Restaurant name</h2>
      <div className="admin-row">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Restaurant name" />
        <button className="admin-btn" onClick={save}>Save</button>
      </div>
    </div>
  )
}

function MenuManager() {
  const [items, setItems] = useState([])
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('')

  useEffect(() => { loadItems() }, [])

  async function loadItems() {
    const { data } = await supabase.from('menu_items').select('*').order('category').order('name')
    setItems(data || [])
  }

  async function addItem() {
    if (!name || !price) return alert('Enter name and price')
    const { error } = await supabase.from('menu_items').insert({
      name,
      price: Number(price),
      category: category || 'Menu',
      available: true,
    })
    if (!error) {
      setName(''); setPrice(''); setCategory('')
      loadItems()
    }
  }

  async function removeItem(id) {
    await supabase.from('menu_items').delete().eq('id', id)
    loadItems()
  }

  async function toggleAvailable(id, current) {
    await supabase.from('menu_items').update({ available: !current }).eq('id', id)
    loadItems()
  }

  return (
    <div className="admin-section">
      <h2>Menu items</h2>
      <div className="admin-row">
        <input placeholder="Item name" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Price (Rs)" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
        <input placeholder="Category (e.g. Starters)" value={category} onChange={(e) => setCategory(e.target.value)} />
        <button className="admin-btn" onClick={addItem}>Add item</button>
      </div>

      {items.map((item) => (
        <div className="admin-list-item" key={item.id}>
          <span style={{ opacity: item.available ? 1 : 0.4 }}>
            {item.name} - Rs{item.price} <em style={{ opacity: 0.6 }}>({item.category})</em>
          </span>
          <span>
            <button
              className="admin-btn"
              style={{ marginRight: 8, background: item.available ? 'var(--cardamom)' : '#999' }}
              onClick={() => toggleAvailable(item.id, item.available)}
            >
              {item.available ? 'Available' : 'Hidden'}
            </button>
            <button className="admin-btn ghost" onClick={() => removeItem(item.id)}>Delete</button>
          </span>
        </div>
      ))}
    </div>
  )
}

function TableManager() {
  const [tableCount, setTableCount] = useState(10)
  const baseUrl = window.location.origin

  const tables = Array.from({ length: tableCount }, (_, i) => i + 1)

  return (
    <div className="admin-section">
      <h2>Table QR codes</h2>
      <div className="admin-row" style={{ alignItems: 'center' }}>
        <label style={{ fontSize: 14 }}>Number of tables:</label>
        <input
          type="number"
          value={tableCount}
          min={1}
          style={{ maxWidth: 90 }}
          onChange={(e) => setTableCount(Number(e.target.value) || 1)}
        />
        <button className="admin-btn" onClick={() => window.print()}>Print all QR codes</button>
      </div>

      <div className="qr-grid">
        {tables.map((n) => (
          <div className="qr-card" key={n}>
            <QRCodeSVG value={`${baseUrl}/menu/${n}`} size={128} />
            <div className="table-label">TABLE {n}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
