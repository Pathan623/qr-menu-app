import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Sidebar from './Sidebar'

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

export default function Billing() {
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
    <div className="app-shell">
      <Sidebar restaurantName={restaurant.name} />
      <div className="app-main">
        <div className="admin-page">
          <h1>Billing &amp; Subscription</h1>
          <BillingSection restaurant={restaurant} adminToken={adminToken} onUpdated={setRestaurant} />
        </div>
      </div>
    </div>
  )
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
    <div className="admin-section" style={{ marginTop: 20 }}>
      <h2>Choose your plan</h2>
      <p style={{ fontSize: 14, opacity: 0.8, marginBottom: 18 }}>
        Current status: <strong>{restaurant.subscription_status}</strong>
        {restaurant.trial_ends_at && isTrialing && (
          <> &middot; Trial ends {new Date(restaurant.trial_ends_at).toLocaleDateString()}</>
        )}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 20,
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
                padding: '20px 18px',
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
                    top: 14,
                    right: 14,
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
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19, marginBottom: 6 }}>
                {plan.name}
              </div>
              <div style={{ fontSize: 15, opacity: 0.8, marginBottom: 14, fontFamily: 'var(--font-mono)' }}>
                {plan.priceLabel}
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, opacity: 0.85, lineHeight: 1.8 }}>
                {plan.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </button>
          )
        })}
      </div>

      {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</p>}

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
