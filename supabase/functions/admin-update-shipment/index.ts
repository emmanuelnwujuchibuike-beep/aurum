// supabase/functions/admin-update-shipment/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    // 1. Verify caller is logged in
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return new Response("Unauthorized", { status: 401 })

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    )
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    )
    if (authError || !user) return new Response("Unauthorized", { status: 401 })

    // 2. Build service role client (key lives only here, never in browser)
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 3. Check caller is admin
    const { data: profile } = await svc
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single()

    if (!profile?.is_admin) return new Response("Forbidden", { status: 403 })

    // 4. Parse action
    const body = await req.json()
    const { action } = body
    let result: unknown = null

    // ── APPROVE DEPOSIT ──────────────────────────────
    if (action === "approve_deposit") {
      const { txId, userId, amount } = body
      const { error: e1 } = await svc.from("transactions").update({ status: "approved" }).eq("id", txId)
      if (e1) throw e1
      const { data: u, error: e2 } = await svc.from("profiles").select("cash").eq("id", userId).single()
      if (e2) throw e2
      const newCash = Number(u.cash || 0) + Number(amount)
      const { error: e3 } = await svc.from("profiles").update({ cash: newCash }).eq("id", userId)
      if (e3) throw e3
      result = { newCash }

    // ── APPROVE WITHDRAWAL ───────────────────────────
    } else if (action === "approve_withdrawal") {
      const { txId, userId, amount } = body
      const { data: u, error: e1 } = await svc.from("profiles").select("cash").eq("id", userId).single()
      if (e1) throw e1
      const currentCash = Number(u.cash || 0)
      if (currentCash < Number(amount)) throw new Error(`Insufficient balance: $${currentCash.toFixed(2)}`)
      const { error: e2 } = await svc.from("transactions").update({ status: "approved" }).eq("id", txId)
      if (e2) throw e2
      const newCash = currentCash - Number(amount)
      const { error: e3 } = await svc.from("profiles").update({ cash: newCash }).eq("id", userId)
      if (e3) throw e3
      result = { newCash }

    // ── REJECT PENDING ───────────────────────────────
    } else if (action === "reject_pending") {
      const { txId, reason } = body
      const updateData: Record<string, unknown> = { status: "rejected" }
      if (reason?.trim()) updateData.note = "REJECTED: " + reason.trim()
      const { error } = await svc.from("transactions").update(updateData).eq("id", txId)
      if (error) throw error
      result = {}

    // ── GET PENDING ──────────────────────────────────
    } else if (action === "get_pending") {
      const { data, error } = await svc
        .from("transactions")
        .select("*")
        .in("status", ["pending", "rejected"])
        .order("created_at", { ascending: false })
      if (error) throw error
      result = data

    // ── GET ALL USERS ────────────────────────────────
    } else if (action === "get_all_users") {
      const { data, error } = await svc
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })
      if (error) throw error
      result = data

    // ── UPDATE CASH ──────────────────────────────────
    } else if (action === "update_cash") {
      const { userId, newAmount } = body
      const { error } = await svc.from("profiles").update({ cash: newAmount }).eq("id", userId)
      if (error) throw error
      result = {}

    // ── BULK CASH ────────────────────────────────────
    } else if (action === "bulk_cash") {
      const { amount, mode } = body
      const { data: users, error: e1 } = await svc.from("profiles").select("id, cash")
      if (e1) throw e1
      let successCount = 0
      for (const u of (users || [])) {
        let newVal: number
        if (mode === "set") newVal = Number(amount)
        else if (mode === "add") newVal = Number(u.cash || 0) + Number(amount)
        else if (mode === "multiply") newVal = Number(u.cash || 0) * Number(amount)
        else newVal = Number(amount)
        const { error } = await svc.from("profiles").update({ cash: newVal }).eq("id", u.id)
        if (!error) successCount++
      }
      result = { successCount }

    // ── GET ALL HOLDINGS ─────────────────────────────
    } else if (action === "get_all_holdings") {
      const { data, error } = await svc
        .from("holdings")
        .select("*, profiles(first_name, last_name, email)")
        .order("created_at", { ascending: false })
      if (error) throw error
      result = data

    // ── GET USER HOLDINGS ────────────────────────────
    } else if (action === "get_user_holdings") {
      const { userId } = body
      const { data, error } = await svc
        .from("holdings")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
      if (error) throw error
      result = data

    // ── GET USER TRANSACTIONS ────────────────────────
    } else if (action === "get_user_transactions") {
      const { userId, limit = 15 } = body
      const { data, error } = await svc
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit)
      if (error) throw error
      result = data

    // ── UPSERT HOLDING ───────────────────────────────
    } else if (action === "upsert_holding") {
      const { userId, symbol, name, icon, color, quantity, avgPrice } = body
      const { error } = await svc.from("holdings").upsert(
        { user_id: userId, symbol, name, icon, color, quantity, avg_buy_price: avgPrice },
        { onConflict: "user_id,symbol" }
      )
      if (error) throw error
      result = {}

    // ── UPDATE HOLDING (P&L editor) ──────────────────
    } else if (action === "update_holding") {
      const { holdingId, avgPrice, quantity } = body
      const { error } = await svc.from("holdings")
        .update({ avg_buy_price: avgPrice, quantity })
        .eq("id", holdingId)
      if (error) throw error
      result = {}

    // ── DELETE HOLDING ───────────────────────────────
    } else if (action === "delete_holding") {
      const { holdingId } = body
      const { error } = await svc.from("holdings").delete().eq("id", holdingId)
      if (error) throw error
      result = {}

    // ── APPLY TARGET P&L ─────────────────────────────
    } else if (action === "apply_target_pnl") {
      const { userId, targetPnl, prices } = body
      const { data: holdings, error: e1 } = await svc
        .from("holdings").select("*").eq("user_id", userId)
      if (e1) throw e1
      const hs = holdings || []
      if (!hs.length) throw new Error("User has no holdings")
      const totalVal = hs.reduce((s: number, h: Record<string, unknown>) => {
        return s + (Number(prices[h.symbol as string] || h.avg_buy_price) * Number(h.quantity))
      }, 0)
      if (totalVal === 0) throw new Error("No portfolio value to work with")
      for (const h of hs) {
        const live = Number(prices[h.symbol as string] || h.avg_buy_price)
        const weight = (live * Number(h.quantity)) / totalVal
        const newAvg = live - (Number(targetPnl) * weight / Number(h.quantity))
        if (newAvg > 0) {
          await svc.from("holdings").update({ avg_buy_price: newAvg }).eq("id", h.id)
        }
      }
      result = {}

    // ── BULK HOLDING ─────────────────────────────────
    } else if (action === "bulk_holding") {
      const { symbol, quantity, avgPrice } = body
      const { data: users, error: e1 } = await svc.from("profiles").select("id")
      if (e1) throw e1
      let successCount = 0
      for (const u of (users || [])) {
        const { error } = await svc.from("holdings").upsert(
          { user_id: u.id, symbol, quantity, avg_buy_price: avgPrice },
          { onConflict: "user_id,symbol" }
        )
        if (!error) successCount++
      }
      result = { successCount }

    // ── GET ALL TRANSACTIONS ─────────────────────────
    } else if (action === "get_all_transactions") {
      const { data, error } = await svc
        .from("transactions")
        .select("*, profiles(first_name, last_name)")
        .order("created_at", { ascending: false })
        .limit(200)
      if (error) throw error
      result = data

    // ── ADD TRANSACTION ──────────────────────────────
    } else if (action === "add_transaction") {
      const { userId, type, symbol, name, icon, color, quantity, priceAtTx, usdAmount, note, status } = body
      const { error } = await svc.from("transactions").insert({
        user_id: userId, type, symbol, name, icon, color,
        quantity, price_at_tx: priceAtTx, usd_amount: usdAmount,
        note, status: status || "approved"
      })
      if (error) throw error
      result = {}

    // ── DELETE TRANSACTION ───────────────────────────
    } else if (action === "delete_transaction") {
      const { txId } = body
      const { error } = await svc.from("transactions").delete().eq("id", txId)
      if (error) throw error
      result = {}

    // ── NUKE TRANSACTIONS ────────────────────────────
    } else if (action === "nuke_transactions") {
      const { error } = await svc.from("transactions")
        .delete().neq("id", "00000000-0000-0000-0000-000000000000")
      if (error) throw error
      result = {}

    // ── NUKE HOLDINGS ────────────────────────────────
    } else if (action === "nuke_holdings") {
      const { error } = await svc.from("holdings")
        .delete().neq("id", "00000000-0000-0000-0000-000000000000")
      if (error) throw error
      result = {}

    // ── SAVE CRYPTO ADDRESS ──────────────────────────
    //    This is what the Save button calls.
    //    Writes to crypto_addresses table in DB.
    } else if (action === "save_address") {
      const { symbol, address } = body
      const { error } = await svc.from("crypto_addresses").upsert(
        { symbol, address: address || "", updated_at: new Date().toISOString() },
        { onConflict: "symbol" }
      )
      if (error) throw error
      result = {}

    } else {
      return new Response(
        JSON.stringify({ success: false, error: "Unknown action: " + action }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})