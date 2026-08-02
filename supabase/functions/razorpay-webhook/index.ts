import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET")!

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

async function verifySignature(body: string, signature: string, secret: string) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body))
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("")
  return hex === signature
}

serve(async (req) => {
  const rawBody = await req.text()
  const signature = req.headers.get("x-razorpay-signature") || ""

  const valid = await verifySignature(rawBody, signature, WEBHOOK_SECRET)
  if (!valid) {
    return new Response("Invalid signature", { status: 400 })
  }

  const payload = JSON.parse(rawBody)
  const event = payload.event
  const subEntity = payload.payload?.subscription?.entity

  if (!subEntity) {
    return new Response("ok", { status: 200 })
  }

  const subscriptionId = subEntity.id
  const currentPeriodEnd = subEntity.current_end
    ? new Date(subEntity.current_end * 1000).toISOString()
    : null

  let newStatus: string | null = null
  if (event === "subscription.activated" || event === "subscription.charged") {
    newStatus = "active"
  } else if (event === "subscription.pending" || event === "subscription.halted") {
    newStatus = "past_due"
  } else if (event === "subscription.cancelled" || event === "subscription.completed") {
    newStatus = "cancelled"
  }

  if (newStatus) {
    await supabase
      .from("restaurants")
      .update({
        subscription_status: newStatus,
        current_period_end: currentPeriodEnd,
      })
      .eq("razorpay_subscription_id", subscriptionId)
  }

  return new Response("ok", { status: 200 })
})