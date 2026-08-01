import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function SignupPage() {
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
        setError('This URL name is already taken, please choose another.')
      } else {
        setError('Could not create restaurant, please try again.')
      }
      return
    }

    navigate(`/r/${slug}/admin`)
  }

  return (
    <div className="login-box" style={{ maxWidth: 420 }}>
      <h1 style={{ fontFamily: 'var(--font-display)' }}>Register your restaurant</h1>
      <form onSubmit={handleSubmit}>
        <input
          placeholder="Restaurant name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (!slug) setSlug(slugify(e.target.value))
          }}
        />
        <input
          placeholder="URL name (e.g. cafe-aroma)"
          value={slug}
          onChange={(e) => setSlug(slugify(e.target.value))}
        />
        <input
          type="password"
          placeholder="Admin password"
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
        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{error}</div>}
        <button className="admin-btn" type="submit" disabled={saving} style={{ width: '100%' }}>
          {saving ? 'Creating...' : 'Create restaurant (30-day free trial)'}
        </button>
      </form>
      {slug && (
        <p style={{ fontSize: 12, opacity: 0.7, marginTop: 10 }}>
          Your links will be: /r/{slug}/admin, /r/{slug}/kitchen, /r/{slug}/menu/1
        </p>
      )}
    </div>
  )
}