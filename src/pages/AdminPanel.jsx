import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const CATEGORIES = ['Starters', 'Main Course', 'Desserts', 'Beverages', 'Snacks']

const BILLING_PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    priceLabel: 'Rs.800/mo',
    features: ['1 admin login', 'Up to 10 tables', 'Kitchen dashboard', 'QR code menus'],
  },
  {
    id: 'unlimited',
    name: 'Unlimited',
    priceLabel: 'Rs.2,500/mo',
    features: ['5 admin logins', 'Unlimited tables', 'Kitchen dashboard', 'QR code menus'],
  },
]

export default function AdminPanel() {
  const { adminToken } = useParams()
  const [restaurant, setRestaurant] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [authed, setAuthed] = useState(sessionStorage.getItem(`admin_authed_${adminToken}`) === '1')
  const [pw, setPw] = useState('')

  useEffect(() => {
    supabase.from('restaurants').select('*').eq('admin_token', adminToken).single()
      .then(({ data, error }) => {
        if (error || !data) setNotFound(true)
        else setRestaurant(data)
      })
  }, [adminToken])

  function tryLogin() {
    if (!restaurant) return
    if (pw === restaurant.admin_password) {
      sessionStorage.setItem(`admin_authed_${adminToken}`, '1')
      setAuthed(true)
    } else {
      alert('Wrong password')
    }
  }

  if (notFound) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Restaurant not found.</div>
  }

  if (!restaurant) return null

  if (!authed) {
    return (
      <div className="login-box">
        <h1 style={{ fontFamily: 'var(--font-display)' }}>Admin Login</h1>
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
          <h1>{restaurant.name}</h1>
          <div className="admin-sub">
            Menu &amp; table management &middot; Plan: {restaurant.subscription_tier} &middot; Status: {restaurant.subscription_status}
          </div>
        </div>
        <Link to={`/kitchen/${adminToken}`}>
          <button className="admin-btn">Go to Kitchen</button>
        </Link>
      </div>
      <BillingSection restaurant={restaurant} adminToken={adminToken} onUpdated={setRestaurant} />
      <RestaurantSettings restaurant={restaurant} onUpdated={setRestaurant} />
      <MenuManager restaurantId={restaurant.id} />
      <TableManager slug={restaurant.slug} />
    </div>
  )
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function BillingSection({ restaurant, adminToken, onUpdated }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [planId, setPlanId] = useState(
    restaurant.subscription_tier === 'unlimited' ? 'unlimited' : 'starter'
  )

  async function handleSubscribe() {
    setLoading(true)
    setError('')

    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-subscription', {
        body: { adminToken, planId },
      })

      if (fnError) throw fnError
      if (!data) throw new Error('No response from server')
      if (data.error) throw new Error(data.error)

      const { subscriptionId, keyId, restaurantName } = data

      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://checkout.razorpay.com/v1/checkout.js'
          script.onload = resolve
          script.onerror = reject
          document.body.appendChild(script)
        })
      }

      const options = {
        key: keyId,
        subscription_id: subscriptionId,
        name: 'TapNServe Subscription',
        description: `${planId === 'unlimited' ? 'Unlimited' : 'Starter'} plan`,
        handler: function () {
          alert('Payment successful! Your subscription will update shortly.')
          window.location.reload()
        },
        prefill: { name: restaurantName },
        theme: { color: '#3F6652' },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      console.error(err)
      setError(err.message || 'Something went wrong, please try again.')
    } finally {
      setLoading(false)
    }
  }

  const isTrialing = restaurant.subscription_status === 'trialing'
  const isActive = restaurant.subscription_status === 'active'
  const selectedPlan = BILLING_PLANS.find((p) => p.id === planId)

  return (
    <div className="admin-section">
      <h2>Billing</h2>
      <p style={{ fontSize: 14, opacity: 0.8, marginBottom: 18 }}>
        Current status: <strong>{restaurant.subscription_status}</strong>
        {restaurant.trial_ends_at && isTrialing && (
          <> &middot; Trial ends {new Date(restaurant.trial_ends_at).toLocaleDateString()}</>
        )}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 14,
          marginBottom: 18,
        }}
      >
        {BILLING_PLANS.map((plan) => {
          const isSelected = plan.id === planId
          const isCurrentPlan = plan.id === restaurant.subscription_tier

          return (
            <button
              type="button"
              key={plan.id}
              onClick={() => setPlanId(plan.id)}
              style={{
                textAlign: 'left',
                cursor: 'pointer',
                borderRadius: 12,
                padding: '18px 16px',
                border: isSelected ? '2px solid var(--cardamom)' : '1.5px solid var(--line)',
                background: isSelected ? 'rgba(63, 102, 82, 0.08)' : 'white',
                position: 'relative',
                transition: 'all 0.15s ease',
              }}
            >
              {isCurrentPlan && (
                <span
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    color: 'var(--cardamom-deep)',
                    background: 'rgba(63, 102, 82, 0.12)',
                    padding: '3px 8px',
                    borderRadius: 20,
                  }}
                >
                  CURRENT
                </span>
              )}
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, marginBottom: 4 }}>
                {plan.name}
              </div>
              <div style={{ fontSize: 14, opacity: 0.8, marginBottom: 12, fontFamily: 'var(--font-mono)' }}>
                {plan.priceLabel}
              </div>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5, opacity: 0.85, lineHeight: 1.7 }}>
                {plan.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </button>
          )
        })}
      </div>

      {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{error}</p>}

      <button className="admin-btn" disabled={loading} onClick={handleSubscribe}>
        {loading
          ? 'Processing...'
          : isActive && planId === restaurant.subscription_tier
          ? `Renew ${selectedPlan.name} Plan`
          : `Subscribe to ${selectedPlan.name} - ${selectedPlan.priceLabel}`}
      </button>
    </div>
  )
}

function RestaurantSettings({ restaurant, onUpdated }) {
  const [name, setName] = useState(restaurant.name)
  const [slug, setSlug] = useState(restaurant.slug)
  const [saving, setSaving] = useState(false)

  async function save() {
    const cleanSlug = slugify(slug)
    if (!cleanSlug) return alert('Slug cannot be empty')

    setSaving(true)

    const { data, error } = await supabase
      .from('restaurants')
      .update({ name, slug: cleanSlug })
      .eq('id', restaurant.id)
      .select()
      .single()
    setSaving(false)

    if (error) {
      if (error.code === '23505') {
        alert('That URL slug is already taken. Please choose a different one.')
      } else {
        alert('Could not save, please try again.')
      }
      return
    }

    onUpdated(data)
    setSlug(data.slug)
    alert('Saved! Your admin/kitchen links stay the same. Menu QR codes use the new URL - reprint them from the Table QR codes section below.')
  }

  return (
    <div className="admin-section">
      <h2>Restaurant name &amp; URL</h2>
      <div className="admin-row">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Restaurant name" />
      </div>
      <div className="admin-row" style={{ marginTop: 8 }}>
        <label style={{ fontSize: 14, opacity: 0.8 }}>Menu URL slug:</label>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="restaurant-url-slug"
        />
        <button className="admin-btn" disabled={saving} onClick={save}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
      <p style={{ fontSize: 13, opacity: 0.7, marginTop: 6 }}>
        This slug is only used in your customer-facing menu links (QR codes). Your admin and kitchen links never change.
      </p>
    </div>
  )
}

function emptyRow(defaultCategory = CATEGORIES[0]) {
  return { key: crypto.randomUUID(), name: '', price: '', category: defaultCategory }
}

const LAST_CATEGORY_KEY = 'menu_last_category'

function MenuManager({ restaurantId }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  function getLastCategory() {
    const stored = localStorage.getItem(`${LAST_CATEGORY_KEY}_${restaurantId}`)
    return CATEGORIES.includes(stored) ? stored : CATEGORIES[0]
  }

  function rememberCategory(cat) {
    localStorage.setItem(`${LAST_CATEGORY_KEY}_${restaurantId}`, cat)
  }

  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState(getLastCategory())

  const [bulkMode, setBulkMode] = useState(false)
  const [bulkRows, setBulkRows] = useState([emptyRow(getLastCategory()), emptyRow(getLastCategory()), emptyRow(getLastCategory())])
  const [bulkSaving, setBulkSaving] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState({ name: '', price: '', category: CATEGORIES[0] })

  useEffect(() => { loadItems() }, [restaurantId])

  async function loadItems() {
    setLoading(true)
    const { data } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('category')
      .order('name')
    setItems(data || [])
    setLoading(false)
  }

  async function addItem() {
    if (!name || !price) return alert('Enter name and price')
    const { error } = await supabase.from('menu_items').insert({
      restaurant_id: restaurantId,
      name,
      price: Number(price),
      category,
      available: true,
    })
    if (!error) {
      rememberCategory(category)
      setName(''); setPrice('')
      loadItems()
    } else {
      alert('Could not add item, please try again.')
    }
  }

  function updateBulkRow(key, field, value) {
    setBulkRows((rows) => rows.map((r) => (r.key === key ? { ...r, [field]: value } : r)))
  }

  function addBulkRow() {
    setBulkRows((rows) => [...rows, emptyRow(getLastCategory())])
  }

  function removeBulkRow(key) {
    setBulkRows((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== key) : rows))
  }

  async function saveBulkRows() {
    const validRows = bulkRows.filter((r) => r.name.trim() && r.price !== '')
    if (validRows.length === 0) {
      alert('Fill in at least one item (name + price) before saving.')
      return
    }
    setBulkSaving(true)
    const payload = validRows.map((r) => ({
      restaurant_id: restaurantId,
      name: r.name.trim(),
      price: Number(r.price),
      category: r.category,
      available: true,
    }))
    const { error } = await supabase.from('menu_items').insert(payload)
    setBulkSaving(false)
    if (!error) {
      rememberCategory(validRows[validRows.length - 1].category)
      const lastCat = getLastCategory()
      setBulkRows([emptyRow(lastCat), emptyRow(lastCat), emptyRow(lastCat)])
      setBulkMode(false)
      loadItems()
    } else {
      alert('Could not save items, please try again.')
    }
  }

  function startEdit(item) {
    setEditingId(item.id)
    setEditDraft({ name: item.name, price: String(item.price), category: item.category || CATEGORIES[0] })
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function saveEdit(id) {
    if (!editDraft.name || editDraft.price === '') return alert('Enter name and price')
    const { error } = await supabase
      .from('menu_items')
      .update({ name: editDraft.name, price: Number(editDraft.price), category: editDraft.category })
      .eq('id', id)
    if (!error) {
      setEditingId(null)
      loadItems()
    } else {
      alert('Could not save changes, please try again.')
    }
  }

  async function removeItem(id) {
    if (!window.confirm('Delete this item?')) return
    await supabase.from('menu_items').delete().eq('id', id)
    loadItems()
  }

  async function toggleAvailable(id, current) {
    await supabase.from('menu_items').update({ available: !current }).eq('id', id)
    loadItems()
  }

  const grouped = CATEGORIES.map((cat) => ({
    cat,
    items: items.filter((i) => (i.category || CATEGORIES[0]) === cat),
  })).filter((g) => g.items.length > 0)

  const uncategorized = items.filter((i) => !CATEGORIES.includes(i.category))

  return (
    <div className="admin-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h2>Menu items</h2>
        <button className="admin-btn ghost" onClick={() => setBulkMode((v) => !v)}>
          {bulkMode ? 'Switch to single add' : '+ Add multiple items'}
        </button>
      </div>

      {!bulkMode ? (
        <div className="admin-row">
          <input placeholder="Item name" value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="Price (Rs)" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button className="admin-btn" onClick={addItem}>Add item</button>
        </div>
      ) : (
        <div style={{ marginTop: 10 }}>
          {bulkRows.map((row) => (
            <div className="admin-row" key={row.key} style={{ marginBottom: 8 }}>
              <input
                placeholder="Item name"
                value={row.name}
                onChange={(e) => updateBulkRow(row.key, 'name', e.target.value)}
              />
              <input
                placeholder="Price (Rs)"
                type="number"
                value={row.price}
                onChange={(e) => updateBulkRow(row.key, 'price', e.target.value)}
              />
              <select
                value={row.category}
                onChange={(e) => updateBulkRow(row.key, 'category', e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button className="admin-btn ghost" onClick={() => removeBulkRow(row.key)}>Remove</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button className="admin-btn ghost" onClick={addBulkRow}>+ Add another row</button>
            <button className="admin-btn" disabled={bulkSaving} onClick={saveBulkRows}>
              {bulkSaving ? 'Saving...' : 'Save all items'}
            </button>
          </div>
        </div>
      )}

      {loading && <p style={{ marginTop: 16, opacity: 0.7 }}>Loading menu...</p>}

      {!loading && grouped.map(({ cat, items: catItems }) => (
        <div key={cat} style={{ marginTop: 18 }}>
          <div className="menu-category">{cat}</div>
          {catItems.map((item) => (
            <MenuRow
              key={item.id}
              item={item}
              isEditing={editingId === item.id}
              editDraft={editDraft}
              setEditDraft={setEditDraft}
              onStartEdit={() => startEdit(item)}
              onCancelEdit={cancelEdit}
              onSaveEdit={() => saveEdit(item.id)}
              onToggleAvailable={() => toggleAvailable(item.id, item.available)}
              onRemove={() => removeItem(item.id)}
            />
          ))}
        </div>
      ))}

      {!loading && uncategorized.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div className="menu-category">Other</div>
          {uncategorized.map((item) => (
            <MenuRow
              key={item.id}
              item={item}
              isEditing={editingId === item.id}
              editDraft={editDraft}
              setEditDraft={setEditDraft}
              onStartEdit={() => startEdit(item)}
              onCancelEdit={cancelEdit}
              onSaveEdit={() => saveEdit(item.id)}
              onToggleAvailable={() => toggleAvailable(item.id, item.available)}
              onRemove={() => removeItem(item.id)}
            />
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <p style={{ marginTop: 16, opacity: 0.7 }}>No menu items yet - add your first one above.</p>
      )}
    </div>
  )
}

function MenuRow({ item, isEditing, editDraft, setEditDraft, onStartEdit, onCancelEdit, onSaveEdit, onToggleAvailable, onRemove }) {
  if (isEditing) {
    return (
      <div className="admin-list-item">
        <div className="admin-row" style={{ flex: 1, margin: 0 }}>
          <input
            value={editDraft.name}
            onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
          />
          <input
            type="number"
            value={editDraft.price}
            onChange={(e) => setEditDraft((d) => ({ ...d, price: e.target.value }))}
          />
          <select
            value={editDraft.category}
            onChange={(e) => setEditDraft((d) => ({ ...d, category: e.target.value }))}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <span>
          <button className="admin-btn" style={{ marginRight: 8 }} onClick={onSaveEdit}>Save</button>
          <button className="admin-btn ghost" onClick={onCancelEdit}>Cancel</button>
        </span>
      </div>
    )
  }

  return (
    <div className="admin-list-item">
      <span style={{ opacity: item.available ? 1 : 0.4 }}>
        {item.name} - Rs{item.price} <em style={{ opacity: 0.6 }}>({item.category})</em>
      </span>
      <span>
        <button
          className="admin-btn"
          style={{ marginRight: 8, background: item.available ? 'var(--cardamom)' : '#999' }}
          onClick={onToggleAvailable}
        >
          {item.available ? 'Available' : 'Hidden'}
        </button>
        <button className="admin-btn ghost" style={{ marginRight: 8 }} onClick={onStartEdit}>Edit</button>
        <button className="admin-btn ghost" onClick={onRemove}>Delete</button>
      </span>
    </div>
  )
}

function TableManager({ slug }) {
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
            <QRCodeSVG value={`${baseUrl}/r/${slug}/menu/${n}`} size={128} />
            <div className="table-label">TABLE {n}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
