import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID")!
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET")!
const PLAN_STARTER = Deno.env.get("RAZORPAY_PLAN_STARTER")!
const PLAN_UNLIMITED = Deno.env.get("RAZORPAY_PLAN_UNLIMITED")!

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { adminToken, planId } = await req.json()

    if (!adminToken || !planId) {
      return new Response(JSON.stringify({ error: "Missing adminToken or planId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: restaurant, error: restErr } = await supabase
      .from("restaurants")
      .select("*")
      .eq("admin_token", adminToken)
      .single()

    if (restErr || !restaurant) {
      return new Response(JSON.stringify({ error: "Restaurant not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const razorpayPlanId = planId === "unlimited" ? PLAN_UNLIMITED : PLAN_STARTER

    const authHeader = "Basic " + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)

    const subRes = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        plan_id: razorpayPlanId,
        customer_notify: 1,
        total_count: 120,
        notes: {
          restaurant_id: restaurant.id,
          admin_token: adminToken,
        },
      }),
    })

    const subData = await subRes.json()

    if (!subRes.ok) {
      return new Response(JSON.stringify({ error: subData.error?.description || "Razorpay error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    await supabase
      .from("restaurants")
      .update({
        razorpay_subscription_id: subData.id,
        subscription_tier: planId,
      })
      .eq("id", restaurant.id)

    return new Response(
      JSON.stringify({
        subscriptionId: subData.id,
        keyId: RAZORPAY_KEY_ID,
        restaurantName: restaurant.name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})