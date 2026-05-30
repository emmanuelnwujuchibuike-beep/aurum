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

            /**
       * ADD THESE CASES to your existing admin-update-shipment edge function
       * inside the main switch/if-else block that handles `action`.
       *
       * These allow portfolio-sync.js to close trades + admin to manage them
       * via the service-role key (never exposed to the browser).
       */

      // ── close_trade ────────────────────────────────────────────────────────
      // Called when a user closes a CFD position via portfolio-sync.js
      if (action === 'close_trade') {
        const { tradeId, closePrice, pnl, returnAmount, userId } = params;

        // 1. Mark trade as closed
        const { error: tradeErr } = await supabaseAdmin
          .from('open_trades')
          .update({
            status:      'closed',
            close_price: closePrice,
            closed_at:   new Date().toISOString(),
          })
          .eq('id', tradeId);
        if (tradeErr) throw tradeErr;

        // 2. Add return amount back to user cash
        const { data: profile, error: profErr } = await supabaseAdmin
          .from('profiles')
          .select('cash')
          .eq('id', userId)
          .single();
        if (profErr) throw profErr;

        const newCash = Number(profile.cash || 0) + returnAmount;
        const { error: cashErr } = await supabaseAdmin
          .from('profiles')
          .update({ cash: newCash })
          .eq('id', userId);
        if (cashErr) throw cashErr;

        return { success: true, data: { newCash } };
      }

      // ── get_open_trades ────────────────────────────────────────────────────
      if (action === 'get_open_trades') {
        const { userId } = params;
        const { data, error } = await supabaseAdmin
          .from('open_trades')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'open')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return { success: true, data };
      }

      // ── get_all_open_trades (admin view) ──────────────────────────────────
      if (action === 'get_all_open_trades') {
        const { data, error } = await supabaseAdmin
          .from('open_trades')
          .select(`
            *,
            profiles:user_id (first_name, last_name, email)
          `)
          .eq('status', 'open')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return { success: true, data };
      }

      // ── admin_close_trade ─────────────────────────────────────────────────
      if (action === 'admin_close_trade') {
        const { tradeId, closePrice, pnl, returnAmount, userId } = params;

        const { error: tradeErr } = await supabaseAdmin
          .from('open_trades')
          .update({
            status:      'closed',
            close_price: closePrice,
            closed_at:   new Date().toISOString(),
          })
          .eq('id', tradeId);
        if (tradeErr) throw tradeErr;

        if (returnAmount != null && userId) {
          const { data: p } = await supabaseAdmin.from('profiles').select('cash').eq('id', userId).single();
          const newCash = Number(p?.cash || 0) + returnAmount;
          await supabaseAdmin.from('profiles').update({ cash: newCash }).eq('id', userId);
        }

        return { success: true, data: { closed: true } };
      }

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
    } else if (action === "save_address") {
      const { symbol, address } = body
      const { error } = await svc.from("crypto_addresses").upsert(
        { symbol, address: address || "", updated_at: new Date().toISOString() },
        { onConflict: "symbol" }
      )
      if (error) throw error
      result = {}

    // ── SAVE ASSET PRICE ─────────────────────────────
    // Called by both dashboard.html and invest.html admin panels
    // Using service role so it bypasses RLS — guaranteed to work
    } else if (action === "save_price") {
      const { sym, price, chg } = body
      if (!sym || isNaN(Number(price)) || Number(price) <= 0) {
        throw new Error("Invalid price data: sym=" + sym + " price=" + price)
      }
      const { error } = await svc.from("asset_prices").upsert(
        { sym, price: Number(price), chg: Number(chg || 0), updated_at: new Date().toISOString() },
        { onConflict: "sym" }
      )
      if (error) throw error
      result = { sym, price: Number(price), chg: Number(chg || 0) }

    // ── SAVE ALL PRICES (batch) ──────────────────────
    // Accepts array: [{ sym, price, chg }]
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