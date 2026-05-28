// supabase/functions/admin-proxy/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    // 1. Verify the caller is a logged-in user (uses their JWT from anon client)
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return new Response("Unauthorized", { status: 401 })

    // 2. Build an anon client to verify the JWT
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    )
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    )
    if (authError || !user) return new Response("Unauthorized", { status: 401 })

    // 3. Check this user is an admin (uses your profiles table)
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single()

    if (!profile?.is_admin) return new Response("Forbidden", { status: 403 })

    // 4. Parse the action request
    const { action, payload } = await req.json()

    let result = null

    // ── APPROVE DEPOSIT ──
    if (action === "approve_deposit") {
      const { tx_id, user_id, amount } = payload

      const { error: txError } = await serviceClient
        .from("transactions")
        .update({ status: "approved" })
        .eq("id", tx_id)
      if (txError) throw txError

      const { data: freshUser, error: userError } = await serviceClient
        .from("profiles")
        .select("cash")
        .eq("id", user_id)
        .single()
      if (userError) throw userError

      const newCash = Number(freshUser.cash || 0) + Number(amount)
      const { error: cashError } = await serviceClient
        .from("profiles")
        .update({ cash: newCash })
        .eq("id", user_id)
      if (cashError) throw cashError

      result = { success: true, new_cash: newCash }
    }

    // ── APPROVE WITHDRAWAL ──
    else if (action === "approve_withdrawal") {
      const { tx_id, user_id, amount } = payload

      const { data: freshUser, error: userError } = await serviceClient
        .from("profiles")
        .select("cash")
        .eq("id", user_id)
        .single()
      if (userError) throw userError

      const currentCash = Number(freshUser.cash || 0)
      if (currentCash < amount) throw new Error(`Insufficient balance: $${currentCash}`)

      const { error: txError } = await serviceClient
        .from("transactions")
        .update({ status: "approved" })
        .eq("id", tx_id)
      if (txError) throw txError

      const newCash = currentCash - Number(amount)
      const { error: cashError } = await serviceClient
        .from("profiles")
        .update({ cash: newCash })
        .eq("id", user_id)
      if (cashError) throw cashError

      result = { success: true, new_cash: newCash }
    }

    // ── REJECT PENDING ──
    else if (action === "reject_pending") {
      const { tx_id, reason } = payload
      const { error } = await serviceClient
        .from("transactions")
        .update({ status: "rejected", note: reason ? "REJECTED: " + reason : undefined })
        .eq("id", tx_id)
      if (error) throw error
      result = { success: true }
    }

    // ── READ ALL USERS (admin only) ──
    else if (action === "get_all_users") {
      const { data, error } = await serviceClient
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })
      if (error) throw error
      result = { success: true, data }
    }

    // ── SET CASH ──
    else if (action === "set_cash") {
      const { user_id, amount } = payload
      const { error } = await serviceClient
        .from("profiles")
        .update({ cash: amount })
        .eq("id", user_id)
      if (error) throw error
      result = { success: true }
    }

    // ── GET PENDING TRANSACTIONS ──
    else if (action === "get_pending") {
      const { data, error } = await serviceClient
        .from("transactions")
        .select("*")
        .in("status", ["pending", "rejected"])
        .order("created_at", { ascending: false })
      if (error) throw error
      result = { success: true, data }
    }

    // ── GET ALL HOLDINGS ──
    else if (action === "get_all_holdings") {
      const { data, error } = await serviceClient
        .from("holdings")
        .select("*, profiles(first_name, last_name, email)")
        .order("created_at", { ascending: false })
      if (error) throw error
      result = { success: true, data }
    }

    // ── UPSERT HOLDING ──
    else if (action === "upsert_holding") {
      const { error } = await serviceClient
        .from("holdings")
        .upsert(payload, { onConflict: "user_id,symbol" })
      if (error) throw error
      result = { success: true }
    }

    // ── DELETE HOLDING ──
    else if (action === "delete_holding") {
      const { error } = await serviceClient
        .from("holdings")
        .delete()
        .eq("id", payload.id)
      if (error) throw error
      result = { success: true }
    }

    // ── GET ALL TRANSACTIONS ──
    else if (action === "get_all_transactions") {
      const { data, error } = await serviceClient
        .from("transactions")
        .select("*, profiles(first_name, last_name)")
        .order("created_at", { ascending: false })
        .limit(200)
      if (error) throw error
      result = { success: true, data }
    }

    // ── ADD TRANSACTION ──
    else if (action === "add_transaction") {
      const { error } = await serviceClient
        .from("transactions")
        .insert({ ...payload, status: "approved" })
      if (error) throw error
      result = { success: true }
    }

    // ── DELETE TRANSACTION ──
    else if (action === "delete_transaction") {
      const { error } = await serviceClient
        .from("transactions")
        .delete()
        .eq("id", payload.id)
      if (error) throw error
      result = { success: true }
    }

    else {
      return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders })
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})