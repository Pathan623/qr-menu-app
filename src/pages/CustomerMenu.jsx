import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase, RESTAURANT_NAME } from '../supabaseClient'

const STATUS_TEXT = {
  pending: { label: 'Order Accepted', desc: 'Kitchen will start preparing shortly.' },
  preparing: { label: 'Getting Prepared', desc: 'Your food is being cooked right now.' },
  served: { label: 'Served', desc: 'Enjoy your meal!' },
}

export default function CustomerMenu() {
  const { tableNumber } = useParams()
  const storageKey = `qr_active_order_table_${tableNumber}`

  const [items, setItems] = useState([])
  const [cart, setCart] = useState({})
  const [loading, setLoading] = useState(true)
  const [placing, setPlacing] = useState(false)
  const [activeOrder, setActiveOrder] = useState(null)

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

  // on load: check if this table has a saved order id, and if so, fetch its latest status
  useEffect(() => {
    const savedId = localStorage.getItem(storageKey)
    if (!savedId) return

    supabase
      .from('orders')
      .select('*')
      .eq('id', savedId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setActiveOrder(data)
        } else {
          localStorage.removeItem(storageKey)
        }
      })
  }, [tableNumber])

  // live status listener
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
      .insert({
        table_number: tableNumber,
        items: orderItems,
        total: cartTotal,
        status: 'pending',
      })
      .select()
      .single()

    setPlacing(false)
    if (!error) {
      setActiveOrder(data)
      localStorage.setItem(storageKey, data.id)
      setCart({})
    } else {
      alert('Could not place order, please try again or call staff.')
    }
  }

  function orderMore() {
    localStorage.removeItem(storageKey)
    setActiveOrder(null)
  }

  if (activeOrder) {
    const st = STATUS_TEXT[activeOrder.status] || STATUS_TEXT.pending
    return (
      <div className="menu-page">
        <div className="order-confirm">
          <h2>{st.label}</h2>
          <div className="ticket-num">
            Order #{activeOrder.id.slice(0, 8).toUpperCase()} - Table {tableNumber}
          </div>
          <p style={{ marginTop: 24 }}>{st.desc}</p>
          {activeOrder.status === 'served' && (
            <button className="place-order-btn" style={{ marginTop: 20 }} onClick={orderMore}>
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
          {items
            .filter((i) => (i.category || 'Menu') === cat)
            .map((item) => (
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
