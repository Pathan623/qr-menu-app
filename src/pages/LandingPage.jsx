import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

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

    if (fetchError || !data) {
      setError('No restaurant found with that name.')
      return
    }
    if (data.admin_password !== password) {
      setError('Wrong password.')
      return
    }

    sessionStorage.setItem(`admin_authed_${cleanSlug}`, '1')
    navigate(`/r/${cleanSlug}/admin`)
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
  const [tier, setTier] = useState('starter')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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

    const maxLogins = tier === 'unlimited' ? 5 : 1

    const { error: insertError } = await supabase.from('restaurants').insert({
      slug,
      name,
      admin_password: password,
      subscription_tier: tier,
      max_admin_logins: maxLogins,
      subscription_status: 'trialing',
    })

    setSaving(false)

    if (insertError) {
      if (insertError.code === '23505') {
        setError('This restaurant name is already taken, please choose another.')
      } else {
        setError('Could not create restaurant, please try again.')
      }
      return
    }

    sessionStorage.setItem(`admin_authed_${slug}`, '1')
    navigate(`/r/${slug}/admin`)
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
      <div className="admin-row" style={{ justifyContent: 'center', marginBottom: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="radio" checked={tier === 'starter'} onChange={() => setTier('starter')} />
          Starter (1 login)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="radio" checked={tier === 'unlimited'} onChange={() => setTier('unlimited')} />
          Unlimited (multi-login)
        </label>
      </div>
      {error && <div className="landing-error">{error}</div>}
      <button className="admin-btn" type="submit" disabled={saving} style={{ width: '100%' }}>
        {saving ? 'Creating...' : 'Create restaurant (30-day free trial)'}
      </button>
      {slug && (
        <p style={{ fontSize: 12, opacity: 0.7, marginTop: 10, textAlign: 'center' }}>
          Your links: /r/{slug}/admin &middot; /r/{slug}/kitchen &middot; /r/{slug}/menu/1
        </p>
      )}
    </form>
  )
}