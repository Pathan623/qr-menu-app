import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 800,
    priceLabel: '10-day free trial, then Rs.800/mo',
    maxLogins: 1,
    tableLimit: 10,
    features: ['1 admin login', 'Up to 10 tables', 'Kitchen dashboard', 'QR code menus'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 1500,
    priceLabel: 'Rs.1,500/mo',
    maxLogins: 3,
    tableLimit: 20,
    features: ['3 admin logins', 'Up to 20 tables', 'Kitchen dashboard', 'QR code menus'],
  },
  {
    id: 'unlimited',
    name: 'Unlimited',
    price: 2500,
    priceLabel: 'Rs.2,500/mo',
    maxLogins: 5,
    tableLimit: null,
    features: ['5 admin logins', 'Unlimited tables', 'Kitchen dashboard', 'QR code menus'],
  },
]

export default function LandingPage() {
  const [mode, setMode] = useState('existing') // 'existing' | 'new'

  return (
    <div className="landing-page">
      <h1 style={{ fontFamily: 'var(--font-display)', textAlign: 'center', marginBottom: 6 }}>TapNServe</h1>
      <p style={{ textAlign: 'center', opacity: 0.7, marginBottom: 28 }}>QR ordering &amp; kitchen alerts for restaurants</p>

      <div className="landing-tabs">
        <button
          className={`landing-tab ${mode === 'existing' ? 'active' : ''}`}
          onClick={() => setMode('existing')}
        >
          Existing Restaurant
        </button>
        <button
          className={`landing-tab ${mode === 'new' ? 'active' : ''}`}
          onClick={() => setMode('new')}
        >
          New Restaurant
        </button>
      </div>

      {mode === 'existing' ? <ExistingRestaurantForm /> : <NewRestaurantForm />}
    </div>
  )
}

function ExistingRestaurantForm() {
  const navigate = useNavigate()
  const [slug, setSlug] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    if (!slug || !password) {
      setError('Please enter both restaurant name and password')
      return
    }
    setChecking(true)

    const cleanSlug = slug.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    const { data, error: fetchError } = await supabase
      .from('restaurants')
      .select('*')
      .eq('slug', cleanSlug)
      .single()

    setChecking(false)

    if (fetchError || !data || data.admin_password !== password) {
      setError('Invalid restaurant name or password.')
      return
    }

    sessionStorage.setItem(`admin_authed_${data.admin_token}`, '1')
    navigate(`/dashboard/${data.admin_token}`)
  }

  return (
    <form className="landing-form" onSubmit={handleLogin}>
      <input
        placeholder="Restaurant name (e.g. cafe-aroma)"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
      />
      <input
        type="password"
        placeholder="Admin password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <div className="landing-error">{error}</div>}
      <button className="admin-btn" type="submit" disabled={checking} style={{ width: '100%' }}>
        {checking ? 'Checking...' : 'Log in to Admin Panel'}
      </button>
    </form>
  )
}

function NewRestaurantForm() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [password, setPassword] = useState('')
  const [planId, setPlanId] = useState('starter')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedPlan = PLANS.find((p) => p.id === planId)

  function slugify(text) {
    return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!name || !slug || !password) {
      setError('Please fill all fields')
      return
    }
    setSaving(true)

    const trialEndsAt =
      planId === 'starter'
        ? new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
        : null

    const { data, error: insertError } = await supabase
      .from('restaurants')
      .insert({
        slug,
        name,
        admin_password: password,
        subscription_tier: selectedPlan.id,
        max_admin_logins: selectedPlan.maxLogins,
        subscription_status: 'trialing',
        trial_ends_at: trialEndsAt,
      })
      .select()
      .single()

    setSaving(false)

    if (insertError || !data) {
      if (insertError?.code === '23505') {
        setError('This restaurant name is already taken, please choose another.')
      } else {
        setError('Could not create restaurant, please try again.')
      }
      return
    }

    sessionStorage.setItem(`admin_authed_${data.admin_token}`, '1')
    navigate(`/dashboard/${data.admin_token}`)
  }

  return (
    <form className="landing-form" onSubmit={handleSubmit}>
      <input
        placeholder="Restaurant name"
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          if (!slug) setSlug(slugify(e.target.value))
        }}
      />
      <input
        placeholder="Choose a unique restaurant ID (e.g. cafe-aroma)"
        value={slug}
        onChange={(e) => setSlug(slugify(e.target.value))}
      />
      <input
        type="password"
        placeholder="Set an admin password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 12,
          margin: '18px 0',
        }}
      >
        {PLANS.map((plan) => {
          const isSelected = plan.id === planId
          return (
            <button
              type="button"
              key={plan.id}
              onClick={() => setPlanId(plan.id)}
              style={{
                textAlign: 'left',
                cursor: 'pointer',
                borderRadius: 12,
                padding: '16px 14px',
                border: isSelected ? '2px solid var(--cardamom, #2f6b4f)' : '1px solid #ddd',
                background: isSelected ? 'rgba(47, 107, 79, 0.08)' : '#fff',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{plan.name}</div>
              <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 10 }}>{plan.priceLabel}</div>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5, opacity: 0.85, lineHeight: 1.6 }}>
                {plan.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </button>
          )
        })}
      </div>

      {error && <div className="landing-error">{error}</div>}
      <button className="admin-btn" type="submit" disabled={saving} style={{ width: '100%' }}>
        {saving
          ? 'Creating...'
          : planId === 'starter'
          ? 'Create restaurant (10-day free trial)'
          : `Create restaurant (${selectedPlan.priceLabel})`}
      </button>
      {slug && (
        <p style={{ fontSize: 12, opacity: 0.7, marginTop: 10, textAlign: 'center' }}>
          Your menu link: /r/{slug}/menu/1 &middot; your private admin &amp; kitchen links are generated after you create your account
        </p>
      )}
    </form>
  )
}
