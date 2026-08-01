import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function KitchenDashboard() {
  const { adminToken } = useParams()
  const [restaurantId, setRestaurantId] = useState(null)
  const [orders, setOrders] = useState([])
  const [soundEnabled, setSoundEnabled] = useState(false)
  const audioCtxRef = useRef(null)

  useEffect(() => {
    supabase.from('restaurants').select('id').eq('admin_token', adminToken).single()
      .then(({ data }) => { if (data) setRestaurantId(data.id) })
  }, [adminToken])

  useEffect(() => {
    if (!restaurantId) return

    loadOrders()

    const channel = supabase
      .channel(`orders-live-${restaurantId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        () => {
          loadOrders()
          playBeep()
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        () => loadOrders()
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [restaurantId])

  function enableSound() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    audioCtxRef.current = ctx
    setSoundEnabled(true)
  }

  function playBeep() {
    const ctx = audioCtxRef.current
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.5)
    setTimeout(() => {
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'sine'
      osc2.frequency.value = 1046
      gain2.gain.setValueAtTime(0.001, ctx.currentTime)
      gain2.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02)
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start()
      osc2.stop(ctx.currentTime + 0.4)
    }, 250)
  }

  async function loadOrders() {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .in('status', ['pending', 'preparing'])
      .order('created_at', { ascending: true })

    if (!error) setOrders(data || [])
  }

  async function updateStatus(id, status) {
    await supabase.from('orders').update({ status }).eq('id', id)
  }

  async function removeItem(order, itemIndex) {
    const newItems = order.items.filter((_, idx) => idx !== itemIndex)
    const newTotal = newItems.reduce((sum, it) => sum + it.price * it.qty, 0)

    if (newItems.length === 0) {
      await supabase.from('orders').update({ items: newItems, total: newTotal, status: 'cancelled' }).eq('id', order.id)
    } else {
      await supabase.from('orders').update({ items: newItems, total: newTotal }).eq('id', order.id)
    }
    loadOrders()
  }

  function timeAgo(ts) {
    const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
    if (mins < 1) return 'just now'
    return `${mins} min ago`
  }

  return (
    <div className="kitchen-page">
      <div className="kitchen-topbar">
        <h1><span className="live-dot" />Kitchen Orders</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!soundEnabled && (
            <button className="admin-btn" onClick={enableSound}>🔊 Enable Sound</button>
          )}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, opacity: 0.7, color: 'var(--ticket)' }}>
            {orders.length} active
          </div>
        </div>
      </div>

      {orders.length === 0 && (
        <div className="empty-state">No active orders — waiting for tables to order…</div>
      )}

      <div className="ticket-grid">
        {orders.map((order) => (
          <div className="ticket" key={order.id}>
            <div className="ticket-perf" />
            <div className="ticket-head">
              <div className="ticket-table">TABLE {order.table_number}</div>
              <div className="ticket-time">{timeAgo(order.created_at)}</div>
            </div>
            <div className="ticket-body">
              <span className={`status-pill ${order.status}`}>{order.status.toUpperCase()}</span>
              <div style={{ marginTop: 10 }}>
                {order.items.map((it, idx) => (
                  <div className="ticket-line" key={idx}>
                    <span>{it.qty}× {it.name}</span>
                    <button
                      className="ticket-line-remove"
                      title="Remove this item (out of stock)"
                      onClick={() => removeItem(order, idx)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="ticket-actions">
              {order.status === 'pending' && (
                <button className="prep" onClick={() => updateStatus(order.id, 'preparing')}>
                  START PREPARING
                </button>
              )}
              {order.status === 'preparing' && (
                <button className="done" onClick={() => updateStatus(order.id, 'served')}>
                  MARK SERVED
                </button>
              )}
              {order.status === 'pending' && (
                <button className="done" onClick={() => updateStatus(order.id, 'served')}>
                  MARK SERVED
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
