import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase, RESTAURANT_NAME } from '../supabaseClient'

const CANCEL_WINDOW_SECONDS = 120

function parseAsUtc(ts) {
  if (/Z$|[+-]\d{2}:\d{2}$/.test(ts)) return new Date(ts)
  return new Date(ts + 'Z')
}

const STATUS_TEXT = {
  pending: { label: 'Order Accepted', desc: 'Kitchen will start preparing shortly.', icon: '\ud83d\udfe1' },
  preparing: { label: 'Getting Prepared', desc: 'Your food is being cooked right now.', icon: '\ud83d\udc68\u200d\ud83c\udf73' },
  served: { label: 'Served', desc: 'Enjoy your meal!', icon: '\u2705' },
  cancelled: { label: 'Order Cancelled', desc: 'This order was cancelled.', icon: '\u274c' },
}

export default function CustomerMenu() {
  const { tableNumber } = useParams()
  const [items, setItems] = useState([])
  const [cart, setCart] = useState({})
  const [loading, setLoading] = useState(true)
  const [placing, setPlacing] = useState(false)
  const [activeOrder, setActiveOrder] = useState(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [removing, setRemoving] = useState(null)

  useEffect(() => {
    async function loadMenu() {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('available', true)
        .order('category')
        .order('name')
      if (!error) setItems(data || [])
      setLoading(false)
    }
    loadMenu()
  }, [])

  useEffect(() => {
    if (!activeOrder) return
    const channel = supabase
      .channel(`order-${activeOrder.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${activeOrder.id}` },
        (payload) => setActiveOrder(payload.new)
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [activeOrder?.id])

  useEffect(() => {
    if (!activeOrder || activeOrder.status !== 'pending') return
    function tick() {
      const elapsed = (Date.now() - parseAsUtc(activeOrder.created_at).getTime()) / 1000
      const remaining = Math.max(0, Math.round(CANCEL_WINDOW_SECONDS - elapsed))
      setSecondsLeft(remaining)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [activeOrder])

  function changeQty(id, delta) {
    setCart((prev) => {
      const next = { ...prev }
      const current = next[id] || 0
      const updated = Math.max(0, current + delta)
      if (updated === 0) delete next[id]
      else next[id] = updated
      return next
    })
  }

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0)
  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const item = items.find((i) => i.id === id)
    return sum + (item ? item.price * qty : 0)
  }, 0)

  async function placeOrder() {
    setPlacing(true)
    const orderItems = Object.entries(cart).map(([id, qty]) => {
      const item = items.find((i) => i.id === id)
      return { id, name: item.name, price: item.price, qty }
    })
    const { data, error } = await supabase
      .from('orders')
      .insert({ table_number: tableNumber, items: orderItems, total: cartTotal, status: 'pending' })
      .select()
      .single()
    setPlacing(false)
    if (!error) {
      setActiveOrder(data)
      setCart({})
    } else {
      alert('Could not place order, please try again or call staff.')
    }
  }

  async function cancelOrder() {
    if (!activeOrder) return
    const { error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', activeOrder.id)
    if (!error) setActiveOrder({ ...activeOrder, status: 'cancelled' })
  }

  async function removeOrderItem(itemIndex) {
    if (!activeOrder) return
    setRemoving(itemIndex)
    const newItems = activeOrder.items.filter((_, idx) => idx !== itemIndex)
    const newTotal = newItems.reduce((sum, it) => sum + it.price * it.qty, 0)

    if (newItems.length === 0) {
      const { error } = await supabase
        .from('orders')
        .update({ items: newItems, total: newTotal, status: 'cancelled' })
        .eq('id', activeOrder.id)
      if (!error) setActiveOrder({ ...activeOrder, items: newItems, total: newTotal, status: 'cancelled' })
    } else {
      const { error } = await supabase
        .from('orders')
        .update({ items: newItems, total: newTotal })
        .eq('id', activeOrder.id)
      if (!error) setActiveOrder({ ...activeOrder, items: newItems, total: newTotal })
    }
    setRemoving(null)
  }

  if (activeOrder) {
    const st = STATUS_TEXT[activeOrder.status] || STATUS_TEXT.pending
    const canCancel = activeOrder.status === 'pending' && secondsLeft > 0
    const mins = Math.floor(secondsLeft / 60)
    const secs = secondsLeft % 60

    return (
      <div className="menu-page">
        <div className="order-confirm">
          <h2>{st.icon} {st.label}</h2>
          <div className="ticket-num">Order #{activeOrder.id.slice(0, 8).toUpperCase()} - Table {tableNumber}</div>
          <p style={{ marginTop: 24 }}>{st.desc}</p>

          {activeOrder.items && activeOrder.items.length > 0 && (
            <div className="order-item-list">
              {activeOrder.items.map((it, idx) => (
                <div className="order-item-row" key={idx}>
                  <span>{it.qty}x {it.name} - Rs{it.price * it.qty}</span>
                  {canCancel && (
                    <button
                      className="remove-item-btn"
                      disabled={removing === idx}
                      onClick={() => removeOrderItem(idx)}
                    >
                      {removing === idx ? '...' : 'Remove'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {canCancel && (
            <>
              <div className="cancel-timer">
                You can cancel items for {mins}:{secs.toString().padStart(2, '0')} more
              </div>
              <button className="cancel-order-btn" onClick={cancelOrder}>Cancel Entire Order</button>
            </>
          )}

          {(activeOrder.status === 'served' || activeOrder.status === 'cancelled') && (
            <button className="place-order-btn" style={{ marginTop: 20 }} onClick={() => setActiveOrder(null)}>
              Order more
            </button>
          )}
        </div>
      </div>
    )
  }

  const categories = [...new Set(items.map((i) => i.category || 'Menu'))]

  return (
    <div className="menu-page">
      <div className="menu-header">
        <div className="table-tag">TABLE {tableNumber}</div>
        <h1>{RESTAURANT_NAME}</h1>
      </div>
      {loading && <div style={{ padding: 40, textAlign: 'center' }}>Loading menu...</div>}
      {!loading && items.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center' }}>Menu is being updated. Please ask staff.</div>
      )}
      {categories.map((cat) => (
        <div key={cat}>
          <div className="menu-category">{cat}</div>
          {items.filter((i) => (i.category || 'Menu') === cat).map((item) => (
            <div className="menu-item" key={item.id}>
              <div>
                <div className="menu-item-name">{item.name}</div>
                <div className="menu-item-price">Rs{item.price}</div>
              </div>
              <div className="qty-control">
                {cart[item.id] ? (
                  <>
                    <button className="qty-btn" onClick={() => changeQty(item.id, -1)}>-</button>
                    <span className="qty-num">{cart[item.id]}</span>
                    <button className="qty-btn" onClick={() => changeQty(item.id, 1)}>+</button>
                  </>
                ) : (
                  <button className="qty-btn add" onClick={() => changeQty(item.id, 1)}>Add</button>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
      {cartCount > 0 && (
        <div className="cart-bar">
          <div>
            <div className="cart-bar-info">{cartCount} item{cartCount > 1 ? 's' : ''}</div>
            <div className="cart-bar-total">Rs{cartTotal}</div>
          </div>
          <button className="place-order-btn" disabled={placing} onClick={placeOrder}>
            {placing ? 'Placing...' : 'Place Order'}
          </button>
        </div>
      )}
    </div>
  )
}