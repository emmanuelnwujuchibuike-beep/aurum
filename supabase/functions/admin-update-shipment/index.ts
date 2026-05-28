import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ── Verify caller is authenticated ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "No auth header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );
    const { data: { user }, error: authErr } = await userClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── IMPORTANT: Frontend sends { action, ...params } (no nested payload) ──
    const body = await req.json();
    const { action, ...params } = body;

    let data: unknown;

    switch (action) {

      // ─────────────────────────────────────────────
      //  USERS
      // ─────────────────────────────────────────────

      case "get_all_users": {
        const { data: rows, error } = await supabaseAdmin
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        data = rows;
        break;
      }

      // ─────────────────────────────────────────────
      //  CASH
      // ─────────────────────────────────────────────

      case "update_cash": {
        // params: { userId, newAmount }
        const { userId, newAmount } = params;
        const { error } = await supabaseAdmin
          .from("profiles")
          .update({ cash: newAmount })
          .eq("id", userId);
        if (error) throw error;
        data = { newCash: newAmount };
        break;
      }

      case "bulk_cash": {
        // params: { amount, mode }  mode = "set" | "add" | "multiply"
        const { amount, mode } = params;
        const { data: allUsers, error: e1 } = await supabaseAdmin
          .from("profiles")
          .select("id, cash");
        if (e1) throw e1;
        for (const u of (allUsers ?? [])) {
          let newVal: number;
          if (mode === "set") newVal = amount;
          else if (mode === "add") newVal = Number(u.cash) + amount;
          else if (mode === "multiply") newVal = Number(u.cash) * amount;
          else newVal = amount;
          await supabaseAdmin.from("profiles").update({ cash: newVal }).eq("id", u.id);
        }
        data = { updated: (allUsers ?? []).length };
        break;
      }

      // ─────────────────────────────────────────────
      //  HOLDINGS
      // ─────────────────────────────────────────────

      case "get_all_holdings": {
        const { data: rows, error } = await supabaseAdmin
          .from("holdings")
          .select("*, profiles(first_name, last_name, email)")
          .order("created_at", { ascending: false });
        if (error) throw error;
        data = rows;
        break;
      }

      case "get_user_holdings": {
        // params: { userId }
        const { userId } = params;
        const { data: rows, error } = await supabaseAdmin
          .from("holdings")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        data = rows;
        break;
      }

      case "upsert_holding": {
        // params: { userId, symbol, name, icon, color, quantity, avgPrice }
        const { userId, symbol, name, icon, color, quantity, avgPrice } = params;
        const { error } = await supabaseAdmin
          .from("holdings")
          .upsert(
            { user_id: userId, symbol, name, icon, color, quantity, avg_buy_price: avgPrice },
            { onConflict: "user_id,symbol" }
          );
        if (error) throw error;
        data = { success: true };
        break;
      }

      case "update_holding": {
        // params: { holdingId, avgPrice, quantity }
        const { holdingId, avgPrice, quantity } = params;
        const { error } = await supabaseAdmin
          .from("holdings")
          .update({ avg_buy_price: avgPrice, quantity })
          .eq("id", holdingId);
        if (error) throw error;
        data = { success: true };
        break;
      }

      case "delete_holding": {
        // params: { holdingId }
        const { holdingId } = params;
        const { error } = await supabaseAdmin
          .from("holdings")
          .delete()
          .eq("id", holdingId);
        if (error) throw error;
        data = { success: true };
        break;
      }

      case "bulk_holding": {
        // params: { symbol, quantity, avgPrice }
        const { symbol, quantity, avgPrice } = params;
        const { data: allUsers, error: e1 } = await supabaseAdmin
          .from("profiles")
          .select("id");
        if (e1) throw e1;
        for (const u of (allUsers ?? [])) {
          // Fetch asset meta from holdings name/icon/color if already exists, else blank
          await supabaseAdmin
            .from("holdings")
            .upsert(
              { user_id: u.id, symbol, quantity, avg_buy_price: avgPrice },
              { onConflict: "user_id,symbol" }
            );
        }
        data = { updated: (allUsers ?? []).length };
        break;
      }

      // ─────────────────────────────────────────────
      //  P&L — adjust avg_buy_price so unrealised P&L
      //  matches a target value across all positions
      // ─────────────────────────────────────────────

      case "apply_target_pnl": {
        // params: { userId, targetPnl, prices }
        const { userId, targetPnl, prices } = params;

        const { data: holdings, error: e1 } = await supabaseAdmin
          .from("holdings")
          .select("*")
          .eq("user_id", userId);
        if (e1) throw e1;

        const hs = holdings ?? [];
        if (!hs.length) throw new Error("User has no holdings");

        // Calculate total market value
        const totalMarketVal = hs.reduce((s: number, h: Record<string, unknown>) => {
          const live = (prices as Record<string, number>)[(h.symbol as string)] ?? Number(h.avg_buy_price);
          return s + live * Number(h.quantity);
        }, 0);

        // Target cost basis
        const targetCostBasis = totalMarketVal - targetPnl;
        if (targetCostBasis <= 0) throw new Error("Target P&L too large — cost basis would be negative");

        // Current cost basis
        const currentCostBasis = hs.reduce((s: number, h: Record<string, unknown>) =>
          s + Number(h.avg_buy_price) * Number(h.quantity), 0);

        // Scale each avg_buy_price proportionally
        const scale = currentCostBasis > 0 ? targetCostBasis / currentCostBasis : 1;

        for (const h of hs) {
          const newAvg = Number(h.avg_buy_price) * scale;
          await supabaseAdmin
            .from("holdings")
            .update({ avg_buy_price: newAvg })
            .eq("id", h.id);
        }

        data = { success: true, scale };
        break;
      }

      // ─────────────────────────────────────────────
      //  TRANSACTIONS
      // ─────────────────────────────────────────────

      case "get_all_transactions": {
        const { data: rows, error } = await supabaseAdmin
          .from("transactions")
          .select("*, profiles(first_name, last_name)")
          .order("created_at", { ascending: false })
          .limit(500);
        if (error) throw error;
        data = rows;
        break;
      }

      case "add_transaction": {
        // params: { userId, type, symbol, name, icon, color, quantity, priceAtTx, usdAmount, note, status }
        const { userId, type, symbol, name, icon, color, quantity, priceAtTx, usdAmount, note, status } = params;
        const { error } = await supabaseAdmin
          .from("transactions")
          .insert({
            user_id: userId, type, symbol, name, icon, color,
            quantity: quantity ?? null,
            price_at_tx: priceAtTx ?? null,
            usd_amount: usdAmount,
            note: note ?? null,
            status: status ?? "approved"
          });
        if (error) throw error;
        data = { success: true };
        break;
      }

      case "delete_transaction": {
        // params: { txId }
        const { txId } = params;
        const { error } = await supabaseAdmin
          .from("transactions")
          .delete()
          .eq("id", txId);
        if (error) throw error;
        data = { success: true };
        break;
      }

      // ─────────────────────────────────────────────
      //  PENDING APPROVALS
      //  Deposit  → status pending, NO cash change yet
      //  Approval → status approved + cash credited/debited
      // ─────────────────────────────────────────────

      case "get_pending": {
        // Returns ALL pending AND recently-rejected so admin can re-approve
        const { data: rows, error } = await supabaseAdmin
          .from("transactions")
          .select("*, profiles(first_name, last_name, email, cash)")
          .in("status", ["pending", "rejected"])
          .order("created_at", { ascending: false });
        if (error) throw error;
        data = rows;          // ← plain array, NOT wrapped in { pending: ... }
        break;
      }

      case "approve_deposit": {
        // params: { txId, userId, amount }
        const { txId, userId, amount } = params;

        // 1. Mark approved
        const { error: e1 } = await supabaseAdmin
          .from("transactions")
          .update({ status: "approved" })
          .eq("id", txId);
        if (e1) throw e1;

        // 2. Credit cash
        const { data: userRow, error: e2 } = await supabaseAdmin
          .from("profiles")
          .select("cash")
          .eq("id", userId)
          .single();
        if (e2) throw e2;

        const newCash = Number(userRow.cash) + Number(amount);
        const { error: e3 } = await supabaseAdmin
          .from("profiles")
          .update({ cash: newCash })
          .eq("id", userId);
        if (e3) throw e3;

        data = { newCash };   // ← frontend expects { newCash }
        break;
      }

      case "approve_withdrawal": {
        // params: { txId, userId, amount }
        const { txId, userId, amount } = params;

        // 1. Check balance
        const { data: userRow, error: e1 } = await supabaseAdmin
          .from("profiles")
          .select("cash")
          .eq("id", userId)
          .single();
        if (e1) throw e1;

        if (Number(userRow.cash) < Number(amount)) {
          throw new Error(`Insufficient balance — user has $${Number(userRow.cash).toFixed(2)}, needs $${Number(amount).toFixed(2)}`);
        }

        // 2. Mark approved
        const { error: e2 } = await supabaseAdmin
          .from("transactions")
          .update({ status: "approved" })
          .eq("id", txId);
        if (e2) throw e2;

        // 3. Deduct cash
        const newCash = Number(userRow.cash) - Number(amount);
        const { error: e3 } = await supabaseAdmin
          .from("profiles")
          .update({ cash: newCash })
          .eq("id", userId);
        if (e3) throw e3;

        data = { newCash };   // ← frontend expects { newCash }
        break;
      }

      case "reject_pending": {
        // params: { txId, reason }
        const { txId, reason } = params;
        const note = reason ? `Rejected: ${reason}` : "Rejected by admin";
        const { error } = await supabaseAdmin
          .from("transactions")
          .update({ status: "rejected", note })
          .eq("id", txId);
        if (error) throw error;
        data = { success: true };
        break;
      }

      // ─────────────────────────────────────────────
      //  DESTRUCTIVE BULK OPS
      // ─────────────────────────────────────────────

      case "nuke_transactions": {
        const { error } = await supabaseAdmin
          .from("transactions")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) throw error;
        data = { success: true };
        break;
      }

      case "nuke_holdings": {
        const { error } = await supabaseAdmin
          .from("holdings")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) throw error;
        data = { success: true };
        break;
      }

      // ─────────────────────────────────────────────
      //  GENERIC DB HELPERS (used by sbAdmin shim)
      // ─────────────────────────────────────────────

      case "db_query": {
        const { table, select, filter, in: inFilter, order, range, limit, single } = params;
        let q = supabaseAdmin.from(table).select(select || "*");
        if (filter) {
          for (const [k, v] of Object.entries(filter)) q = (q as ReturnType<typeof supabaseAdmin.from>).eq(k, v as string);
        }
        if (inFilter) {
          for (const [k, v] of Object.entries(inFilter)) q = (q as ReturnType<typeof supabaseAdmin.from>).in(k, v as string[]);
        }
        if (order) q = (q as ReturnType<typeof supabaseAdmin.from>).order(order.col, { ascending: order.ascending ?? false });
        if (range) q = (q as ReturnType<typeof supabaseAdmin.from>).range(range[0], range[1]);
        else if (limit) q = (q as ReturnType<typeof supabaseAdmin.from>).limit(limit);
        const { data: rows, error } = single
          ? await (q as ReturnType<typeof supabaseAdmin.from>).single()
          : await q;
        if (error) throw error;
        data = rows;
        break;
      }

      case "db_update": {
        const { table, data: updateData, filter } = params;
        let q = supabaseAdmin.from(table).update(updateData);
        for (const [k, v] of Object.entries(filter)) q = (q as ReturnType<typeof supabaseAdmin.from>).eq(k, v as string);
        const { error } = await q;
        if (error) throw error;
        data = { success: true };
        break;
      }

      case "db_insert": {
        const { table, data: insertData } = params;
        const { error } = await supabaseAdmin.from(table).insert(insertData);
        if (error) throw error;
        data = { success: true };
        break;
      }

      case "db_upsert": {
        const { table, data: upsertData, opts } = params;
        const { error } = await supabaseAdmin.from(table).upsert(upsertData, opts);
        if (error) throw error;
        data = { success: true };
        break;
      }

      case "db_delete": {
        const { table, filter } = params;
        let q = supabaseAdmin.from(table).delete();
        for (const [k, v] of Object.entries(filter)) q = (q as ReturnType<typeof supabaseAdmin.from>).eq(k, v as string);
        const { error } = await q;
        if (error) throw error;
        data = { success: true };
        break;
      }

      case "db_delete_all": {
        const { table } = params;
        const { error } = await supabaseAdmin
          .from(table)
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) throw error;
        data = { success: true };
        break;
      }

      default:
        throw new Error(`Unknown action: "${action}"`);
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});