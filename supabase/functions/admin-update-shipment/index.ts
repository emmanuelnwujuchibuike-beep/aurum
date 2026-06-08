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
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return new Response("Unauthorized", { status: 401 })

    // ── Verify caller is authenticated ──────────────────────────────────────
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    )
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    )
    if (authError || !user) return new Response("Unauthorized", { status: 401 })

    // ── Service-role client (bypasses RLS) ──────────────────────────────────
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // ── Admin gate ──────────────────────────────────────────────────────────
    const { data: profile, error: profileErr } = await svc
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single()

    if (profileErr || !profile?.is_admin) return new Response("Forbidden", { status: 403 })

    const body = await req.json()
    const { action } = body
    let result: unknown = null

    // ────────────────────────────────────────────────────────────────────────
    //  DEPOSITS & WITHDRAWALS
    // ────────────────────────────────────────────────────────────────────────

    if (action === "approve_deposit") {
      const { txId, userId, amount } = body

      const { error: e1 } = await svc
        .from("transactions")
        .update({ status: "approved" })
        .eq("id", txId)
      if (e1) throw e1

      const { data: u, error: e2 } = await svc
        .from("profiles")
        .select("cash")
        .eq("id", userId)
        .single()
      if (e2) throw e2

      const newCash = Number(u.cash || 0) + Number(amount)
      const { error: e3 } = await svc
        .from("profiles")
        .update({ cash: newCash })
        .eq("id", userId)
      if (e3) throw e3

      result = { newCash }

    } else if (action === "approve_withdrawal") {
      const { txId, userId, amount } = body

      const { data: u, error: e1 } = await svc
        .from("profiles")
        .select("cash")
        .eq("id", userId)
        .single()
      if (e1) throw e1

      const currentCash = Number(u.cash || 0)
      if (currentCash < Number(amount))
        throw new Error(`Insufficient balance: $${currentCash.toFixed(2)}`)

      const { error: e2 } = await svc
        .from("transactions")
        .update({ status: "approved" })
        .eq("id", txId)
      if (e2) throw e2

      const newCash = currentCash - Number(amount)
      const { error: e3 } = await svc
        .from("profiles")
        .update({ cash: newCash })
        .eq("id", userId)
      if (e3) throw e3

      result = { newCash }

    } else if (action === "reject_pending") {
      const { txId, reason } = body
      const updateData: Record<string, unknown> = { status: "rejected" }
      if (reason?.trim()) updateData.note = "REJECTED: " + reason.trim()
      const { error } = await svc
        .from("transactions")
        .update(updateData)
        .eq("id", txId)
      if (error) throw error
      result = {}

    } else if (action === "get_pending") {
      const { data, error } = await svc
        .from("transactions")
        .select("*")
        .in("status", ["pending", "rejected"])
        .order("created_at", { ascending: false })
      if (error) throw error

      // Enrich with profile data separately to avoid FK join issues
      const userIds = [...new Set((data || []).map((t: Record<string, unknown>) => t.user_id))]
      const { data: profiles } = await svc
        .from("profiles")
        .select("id, first_name, last_name, email, cash")
        .in("id", userIds)
      const profileMap = Object.fromEntries((profiles || []).map((p: Record<string, unknown>) => [p.id, p]))
      result = (data || []).map((t: Record<string, unknown>) => ({
        ...t,
        profiles: profileMap[t.user_id as string] || null
      }))

    // ────────────────────────────────────────────────────────────────────────
    //  USERS
    // ────────────────────────────────────────────────────────────────────────

    } else if (action === "get_all_users") {
      const { data, error } = await svc
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })
      if (error) throw error
      result = data

    } else if (action === "update_cash") {
      const { userId, newAmount } = body
      const { error } = await svc
        .from("profiles")
        .update({ cash: newAmount })
        .eq("id", userId)
      if (error) throw error
      result = {}

    } else if (action === "bulk_cash") {
      const { amount, mode } = body
      const { data: users, error: e1 } = await svc.from("profiles").select("id, cash")
      if (e1) throw e1
      let successCount = 0
      for (const u of (users || [])) {
        let newVal: number
        if (mode === "set")           newVal = Number(amount)
        else if (mode === "add")      newVal = Number(u.cash || 0) + Number(amount)
        else if (mode === "multiply") newVal = Number(u.cash || 0) * Number(amount)
        else                          newVal = Number(amount)
        const { error } = await svc.from("profiles").update({ cash: newVal }).eq("id", u.id)
        if (!error) successCount++
      }
      result = { successCount }

    // ────────────────────────────────────────────────────────────────────────
    //  HOLDINGS
    // ────────────────────────────────────────────────────────────────────────

    } else if (action === "get_all_holdings") {
      const { userId } = body
      let query = svc
        .from("holdings")
        .select("*")
        .order("created_at", { ascending: false })
      if (userId) query = query.eq("user_id", userId)
      const { data, error } = await query
      if (error) throw error

      // Enrich with profile data separately
      const userIds = [...new Set((data || []).map((h: Record<string, unknown>) => h.user_id))]
      const { data: profiles } = await svc
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", userIds)
      const profileMap = Object.fromEntries((profiles || []).map((p: Record<string, unknown>) => [p.id, p]))
      result = (data || []).map((h: Record<string, unknown>) => ({
        ...h,
        profiles: profileMap[h.user_id as string] || null
      }))

    } else if (action === "get_user_holdings") {
      const { userId } = body
      if (!userId) throw new Error("userId is required for get_user_holdings")

      const { data, error } = await svc
        .from("holdings")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
      if (error) throw error

      // Enrich with profile data separately
      const { data: profileData } = await svc
        .from("profiles")
        .select("id, first_name, last_name, email")
        .eq("id", userId)
        .single()
      result = (data || []).map((h: Record<string, unknown>) => ({
        ...h,
        profiles: profileData || null
      }))

    } else if (action === "upsert_holding") {
      const { userId, symbol, name, icon, color, quantity, avgPrice } = body
      const { error } = await svc.from("holdings").upsert(
        { user_id: userId, symbol, name, icon, color, quantity, avg_buy_price: avgPrice },
        { onConflict: "user_id,symbol" }
      )
      if (error) throw error
      result = {}

    } else if (action === "update_holding") {
      const { holdingId, avgPrice, quantity } = body

      if (!holdingId) throw new Error("holdingId is required")

      const parsedAvg = Number(avgPrice)
      const parsedQty = Number(quantity)

      if (isNaN(parsedAvg) || parsedAvg <= 0)
        throw new Error(`Invalid avgPrice: ${avgPrice}`)
      if (isNaN(parsedQty) || parsedQty <= 0)
        throw new Error(`Invalid quantity: ${quantity}`)

      // Verify holding exists first
      const { data: existing, error: fetchErr } = await svc
        .from("holdings")
        .select("id, user_id, symbol")
        .eq("id", holdingId)
        .single()

      if (fetchErr || !existing)
        throw new Error(`Holding not found: ${holdingId}`)

      // FIXED: plain .select() — no profile join that requires FK relationship
      const { data: updated, error: updateErr } = await svc
        .from("holdings")
        .update({
          avg_buy_price: parsedAvg,
          quantity: parsedQty,
          pnl_override: null,   // clear any admin override — manual avg takes effect
          updated_at: new Date().toISOString(),
        })
        .eq("id", holdingId)
        .select()

      if (updateErr) throw updateErr
      if (!updated || updated.length === 0)
        throw new Error(`Update wrote 0 rows for holding: ${holdingId}`)

      result = updated[0]

    } else if (action === "delete_holding") {
      const { holdingId } = body
      const { error } = await svc.from("holdings").delete().eq("id", holdingId)
      if (error) throw error
      result = {}

    } else if (action === "apply_target_pnl") {
      const { userId, targetPnl, prices } = body

      if (!userId) throw new Error("userId is required")
      const parsedTarget = Number(targetPnl)
      if (isNaN(parsedTarget)) throw new Error(`Invalid targetPnl: ${targetPnl}`)

      const { data: holdings, error: e1 } = await svc
        .from("holdings")
        .select("*")
        .eq("user_id", userId)
      if (e1) throw e1

      const hs = holdings || []
      if (!hs.length) throw new Error("User has no holdings")

      // Distribute target P&L across holdings by portfolio weight.
      // Uses pnl_override column so ANY amount can be stored — no avg_buy_price math,
      // no clamping, no upper limit on profit.
      const totalVal = hs.reduce((s: number, h: Record<string, unknown>) => {
        const livePrice = Number((prices as Record<string, number>)[h.symbol as string])
          || Number(h.avg_buy_price)
        return s + livePrice * Number(h.quantity)
      }, 0)

      if (totalVal === 0) throw new Error("Portfolio value is zero — cannot distribute P&L")

      const updated: unknown[] = []
      const failed: string[]   = []

      for (const h of hs) {
        const sym    = h.symbol as string
        const live   = Number((prices as Record<string, number>)[sym]) || Number(h.avg_buy_price)
        const qty    = Number(h.quantity)
        const weight = (live * qty) / totalVal
        // Store exact target P&L share — no minimum, no maximum, any value works
        const pnlShare = Number((parsedTarget * weight).toFixed(2))

        const { data: updRow, error: updErr } = await svc
          .from("holdings")
          .update({
            pnl_override: pnlShare,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId as string)
          .eq("symbol", sym)
          .select()

        if (updErr) {
          failed.push(`${sym}: ${updErr.message}`)
        } else if (!updRow || updRow.length === 0) {
          failed.push(`${sym}: update matched 0 rows`)
        } else {
          updated.push(updRow[0])
        }
      }

      result = { updated: updated.length, failed }

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

    // ────────────────────────────────────────────────────────────────────────
    //  TRANSACTIONS
    // ────────────────────────────────────────────────────────────────────────

    } else if (action === "get_all_transactions") {
      const { userId, limit = 200 } = body
      let query = svc
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit)
      if (userId) query = query.eq("user_id", userId)
      const { data, error } = await query
      if (error) throw error

      // Enrich with profile data separately
      const userIds = [...new Set((data || []).map((t: Record<string, unknown>) => t.user_id))]
      const { data: profiles } = await svc
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", userIds)
      const profileMap = Object.fromEntries((profiles || []).map((p: Record<string, unknown>) => [p.id, p]))
      result = (data || []).map((t: Record<string, unknown>) => ({
        ...t,
        profiles: profileMap[t.user_id as string] || null
      }))

    } else if (action === "get_user_transactions") {
      const { userId, limit = 15 } = body
      if (!userId) throw new Error("userId is required for get_user_transactions")

      const { data, error } = await svc
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit)
      if (error) throw error

      // Enrich with profile data separately
      const { data: profileData } = await svc
        .from("profiles")
        .select("id, first_name, last_name, email")
        .eq("id", userId)
        .single()
      result = (data || []).map((t: Record<string, unknown>) => ({
        ...t,
        profiles: profileData || null
      }))

    } else if (action === "add_transaction") {
      const { userId, type, symbol, name, icon, color, quantity, priceAtTx, usdAmount, note, status } = body
      const { error } = await svc.from("transactions").insert({
        user_id: userId, type, symbol, name, icon, color,
        quantity, price_at_tx: priceAtTx, usd_amount: usdAmount,
        note, status: status || "approved"
      })
      if (error) throw error
      result = {}

    } else if (action === "delete_transaction") {
      const { txId } = body
      const { error } = await svc.from("transactions").delete().eq("id", txId)
      if (error) throw error
      result = {}

    } else if (action === "nuke_transactions") {
      const { error } = await svc
        .from("transactions")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000")
      if (error) throw error
      result = {}

    } else if (action === "nuke_holdings") {
      const { error } = await svc
        .from("holdings")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000")
      if (error) throw error
      result = {}

    // ────────────────────────────────────────────────────────────────────────
    //  PRICES
    // ────────────────────────────────────────────────────────────────────────

    } else if (action === "save_price") {
      const { sym, price, chg } = body
      if (!sym || isNaN(Number(price)) || Number(price) <= 0)
        throw new Error("Invalid price data: sym=" + sym + " price=" + price)

      const { error } = await svc.from("asset_prices").upsert(
        { sym, price: Number(price), chg: Number(chg || 0), updated_at: new Date().toISOString() },
        { onConflict: "sym" }
      )
      if (error) throw error
      result = { sym, price: Number(price), chg: Number(chg || 0) }

    } else if (action === "save_prices_batch") {
      const { rows } = body
      if (!Array.isArray(rows) || !rows.length) throw new Error("No price rows provided")
      const validRows = rows
        .filter((r: Record<string, unknown>) => r.sym && !isNaN(Number(r.price)) && Number(r.price) > 0)
        .map((r: Record<string, unknown>) => ({
          sym: r.sym,
          price: Number(r.price),
          chg: Number(r.chg || 0),
          updated_at: new Date().toISOString()
        }))
      if (!validRows.length) throw new Error("No valid price rows")
      const { error } = await svc.from("asset_prices").upsert(validRows, { onConflict: "sym" })
      if (error) throw error
      result = { saved: validRows.length }

    // ────────────────────────────────────────────────────────────────────────
    //  ADDRESSES
    // ────────────────────────────────────────────────────────────────────────

    } else if (action === "save_address") {
      const { symbol, address } = body
      const { error } = await svc.from("crypto_addresses").upsert(
        { symbol, address: address || "", updated_at: new Date().toISOString() },
        { onConflict: "symbol" }
      )
      if (error) throw error
      result = {}

    // ────────────────────────────────────────────────────────────────────────
    //  OPEN TRADES
    // ────────────────────────────────────────────────────────────────────────

    } else if (action === "close_trade") {
      const { tradeId, closePrice, returnAmount, userId } = body
      const { error: tradeErr } = await svc
        .from("open_trades")
        .update({ status: "closed", close_price: closePrice, closed_at: new Date().toISOString() })
        .eq("id", tradeId)
      if (tradeErr) throw tradeErr

      const { data: p, error: profErr } = await svc
        .from("profiles").select("cash").eq("id", userId).single()
      if (profErr) throw profErr

      const newCash = Number(p.cash || 0) + Number(returnAmount)
      const { error: cashErr } = await svc
        .from("profiles").update({ cash: newCash }).eq("id", userId)
      if (cashErr) throw cashErr
      result = { newCash }

    } else if (action === "get_open_trades") {
      const { userId } = body
      if (!userId) throw new Error("userId is required for get_open_trades")
      const { data, error } = await svc
        .from("open_trades")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "open")
        .order("created_at", { ascending: false })
      if (error) throw error
      result = data

    } else if (action === "get_all_open_trades") {
      const { userId, includeAll = false } = body
      let query = svc
        .from("open_trades")
        .select("*")
        .order("created_at", { ascending: false })
      if (!includeAll) query = query.eq("status", "open")
      if (userId) query = query.eq("user_id", userId)
      const { data, error } = await query
      if (error) throw error
      result = data

    } else if (action === "admin_close_trade") {
      const { tradeId, closePrice, returnAmount, userId } = body
      const { error: tradeErr } = await svc
        .from("open_trades")
        .update({ status: "closed", close_price: closePrice, closed_at: new Date().toISOString() })
        .eq("id", tradeId)
      if (tradeErr) throw tradeErr

      if (returnAmount != null && userId) {
        const { data: p } = await svc
          .from("profiles").select("cash").eq("id", userId).single()
        const newCash = Number(p?.cash || 0) + Number(returnAmount)
        await svc.from("profiles").update({ cash: newCash }).eq("id", userId)
      }
      result = { closed: true }

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
    console.error("[admin-update-shipment] ERROR:", message)
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})