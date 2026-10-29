-- Server-side money movement (AUDIT S2/S3/S10).
-- Every balance change now happens in one of these functions, called only by the
-- `money` edge function (service role) after it has verified the user and fetched
-- the real market price. Each call:
--   * locks the customer's profile row (no double-spend from parallel requests)
--   * checks balance / holdings server-side
--   * writes holdings, transactions and cash in ONE transaction
--   * is idempotent: the same (user, key) returns the first result, never twice
-- Fees, lot sizes, lock periods and property prices come from site_settings
-- (admin-editable), seeded with the values the pages used before.

begin;

-- ── settings (same values the pages hard-coded) ─────────────────────────────
insert into public.site_settings (key, value) values
  ('trading', '{
     "spot_fee": 0.001, "invest_fee": 0.001, "invest_slippage": 0.0005,
     "swap_fee": 0.003, "cfd_fee": 0.001, "cfd_margin": 0.1,
     "property_early_penalty": 0.3, "min_trade": 10,
     "lot_values": {"crypto": 1000, "stocks": 500, "property": 2000, "commodity": 1000},
     "lock_days": {"1D": 1, "1W": 7, "1M": 30, "1Y": 365}
   }'::jsonb),
  ('property_prices', '{"LOND": 500, "DXB": 1000, "NYC": 500, "DXB2": 2000, "SGP": 500, "PAR": 1000}'::jsonb)
on conflict (key) do nothing;

-- ── property lock-in lives in the database (was only in the browser) ────────
alter table public.holdings add column if not exists locked_until timestamptz;
alter table public.holdings add column if not exists lock_duration text;

-- ── idempotency ledger ───────────────────────────────────────────────────────
create table if not exists public.money_requests (
  user_id    uuid not null references auth.users(id) on delete cascade,
  key        text not null,
  action     text not null,
  result     jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.money_requests enable row level security;   -- no policies: server only

-- ── helpers ──────────────────────────────────────────────────────────────────
create or replace function public.mx_seen(p_user uuid, p_key text) returns jsonb
language sql stable security definer set search_path = public as $$
  select result from public.money_requests where user_id = p_user and key = p_key;
$$;

create or replace function public.mx_done(p_user uuid, p_key text, p_action text, p_result jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  insert into public.money_requests (user_id, key, action, result) values (p_user, p_key, p_action, p_result);
  return p_result;
end $$;

create or replace function public.mx_lock_profile(p_user uuid) returns numeric
language plpgsql security definer set search_path = public as $$
declare v_cash numeric;
begin
  select cash into v_cash from public.profiles where id = p_user for update;
  if not found then raise exception 'Account not found'; end if;
  return coalesce(v_cash, 0);
end $$;

-- ── BUY (spot trade or investment; optional property lock-in) ───────────────
create or replace function public.mx_buy(
  p_user uuid, p_key text, p_symbol text, p_name text, p_icon text, p_color text,
  p_usd numeric, p_price numeric, p_fee_rate numeric, p_slip_rate numeric,
  p_lock_days int default null, p_lock_label text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_prev jsonb := public.mx_seen(p_user, p_key);
  v_cash numeric; v_fee numeric; v_slip numeric; v_total numeric; v_qty numeric;
  v_h public.holdings%rowtype; v_lock timestamptz; v_tx uuid; v_new_qty numeric; v_new_avg numeric;
begin
  if v_prev is not null then return v_prev; end if;
  if p_usd is null or p_usd <= 0 then raise exception 'Enter an amount greater than zero'; end if;
  if p_price is null or p_price <= 0 then raise exception 'Price unavailable for %, try again shortly', p_symbol; end if;
  v_cash := public.mx_lock_profile(p_user);
  v_fee := round(p_usd * coalesce(p_fee_rate, 0), 2);
  v_slip := round(p_usd * coalesce(p_slip_rate, 0), 2);
  v_total := round(p_usd + v_fee + v_slip, 2);
  if v_total > v_cash then raise exception 'Insufficient balance'; end if;
  v_qty := p_usd / p_price;
  if p_lock_days is not null then v_lock := now() + make_interval(days => p_lock_days); end if;

  select * into v_h from public.holdings where user_id = p_user and symbol = p_symbol order by created_at limit 1 for update;
  if found then
    v_new_qty := v_h.quantity + v_qty;
    v_new_avg := round((v_h.avg_buy_price * v_h.quantity + p_price * v_qty) / v_new_qty, 6);
    update public.holdings set quantity = v_new_qty, avg_buy_price = v_new_avg, updated_at = now(),
      locked_until = greatest(locked_until, v_lock), lock_duration = coalesce(p_lock_label, lock_duration)
    where id = v_h.id;
  else
    v_new_qty := v_qty; v_new_avg := p_price;
    insert into public.holdings (user_id, symbol, name, icon, color, quantity, avg_buy_price, locked_until, lock_duration)
    values (p_user, p_symbol, p_name, coalesce(p_icon, 'fas fa-circle'), coalesce(p_color, '#c9a84c'), v_qty, p_price, v_lock, p_lock_label);
  end if;

  insert into public.transactions (user_id, type, symbol, name, icon, color, quantity, price_at_tx, usd_amount, status, note)
  values (p_user, 'buy', p_symbol, p_name, coalesce(p_icon, 'fas fa-circle'), coalesce(p_color, '#c9a84c'), v_qty, p_price, -v_total, 'approved',
    'Buy ' || p_symbol || ' @ $' || p_price || ' | Fee: $' || v_fee ||
    case when v_slip > 0 then ' | Slip: $' || v_slip else '' end ||
    case when v_lock is not null then ' | Lock: ' || coalesce(p_lock_label, '') || ' until ' || to_char(v_lock, 'YYYY-MM-DD HH24:MI') else '' end)
  returning id into v_tx;

  update public.profiles set cash = round(v_cash - v_total, 2) where id = p_user;
  return public.mx_done(p_user, p_key, 'buy', jsonb_build_object(
    'ok', true, 'tx_id', v_tx, 'symbol', p_symbol, 'price', p_price, 'qty', v_qty, 'fee', v_fee, 'slip', v_slip,
    'total', v_total, 'cash', round(v_cash - v_total, 2), 'holding_qty', v_new_qty, 'avg', v_new_avg, 'locked_until', v_lock));
end $$;

-- ── SELL (by quantity; never more than the customer holds) ──────────────────
create or replace function public.mx_sell(
  p_user uuid, p_key text, p_symbol text, p_qty numeric, p_price numeric, p_fee_rate numeric
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_prev jsonb := public.mx_seen(p_user, p_key);
  v_cash numeric; v_h public.holdings%rowtype; v_gross numeric; v_fee numeric; v_net numeric; v_left numeric; v_tx uuid;
begin
  if v_prev is not null then return v_prev; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Enter an amount greater than zero'; end if;
  if p_price is null or p_price <= 0 then raise exception 'Price unavailable for %, try again shortly', p_symbol; end if;
  v_cash := public.mx_lock_profile(p_user);
  select * into v_h from public.holdings where user_id = p_user and symbol = p_symbol order by created_at limit 1 for update;
  if not found then raise exception 'You don''t hold any %', p_symbol; end if;
  if p_qty > v_h.quantity * 1.000001 then raise exception 'You only hold % %', round(v_h.quantity, 8), p_symbol; end if;
  if v_h.locked_until is not null and v_h.locked_until > now() then
    raise exception '% is locked until %. Use property withdrawal for early exit.', p_symbol, to_char(v_h.locked_until, 'YYYY-MM-DD HH24:MI');
  end if;
  v_gross := round(least(p_qty, v_h.quantity) * p_price, 2);
  v_fee := round(v_gross * coalesce(p_fee_rate, 0), 2);
  v_net := round(v_gross - v_fee, 2);
  v_left := v_h.quantity - least(p_qty, v_h.quantity);
  if v_left <= 0.000001 then delete from public.holdings where id = v_h.id; v_left := 0;
  else update public.holdings set quantity = v_left, updated_at = now() where id = v_h.id; end if;

  insert into public.transactions (user_id, type, symbol, name, icon, color, quantity, price_at_tx, usd_amount, status, note)
  values (p_user, 'sell', p_symbol, v_h.name, coalesce(v_h.icon, 'fas fa-circle'), coalesce(v_h.color, '#c9a84c'), least(p_qty, v_h.quantity), p_price, v_net, 'approved',
    'Sell ' || p_symbol || ' @ $' || p_price || ' | Fee: $' || v_fee)
  returning id into v_tx;

  update public.profiles set cash = round(v_cash + v_net, 2) where id = p_user;
  return public.mx_done(p_user, p_key, 'sell', jsonb_build_object(
    'ok', true, 'tx_id', v_tx, 'symbol', p_symbol, 'price', p_price, 'qty', least(p_qty, v_h.quantity),
    'gross', v_gross, 'fee', v_fee, 'net', v_net, 'cash', round(v_cash + v_net, 2), 'holding_qty', v_left));
end $$;

-- ── PROPERTY WITHDRAWAL (whole holding; early-exit penalty while locked) ─────
create or replace function public.mx_property_withdraw(
  p_user uuid, p_key text, p_symbol text, p_unit_price numeric, p_penalty_rate numeric
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_prev jsonb := public.mx_seen(p_user, p_key);
  v_cash numeric; v_h public.holdings%rowtype; v_val numeric; v_pen numeric := 0; v_net numeric; v_tx uuid; v_early boolean;
begin
  if v_prev is not null then return v_prev; end if;
  if p_unit_price is null or p_unit_price <= 0 then raise exception 'No price configured for %', p_symbol; end if;
  v_cash := public.mx_lock_profile(p_user);
  select * into v_h from public.holdings where user_id = p_user and symbol = p_symbol order by created_at limit 1 for update;
  if not found then raise exception 'You don''t hold any %', p_symbol; end if;
  v_val := round(v_h.quantity * p_unit_price, 2);
  v_early := v_h.locked_until is not null and v_h.locked_until > now();
  if v_early then v_pen := round(v_val * coalesce(p_penalty_rate, 0), 2); end if;
  v_net := round(v_val - v_pen, 2);
  delete from public.holdings where id = v_h.id;
  insert into public.transactions (user_id, type, symbol, name, icon, color, quantity, price_at_tx, usd_amount, status, note)
  values (p_user, 'sell', p_symbol, v_h.name, coalesce(v_h.icon, 'fas fa-circle'), coalesce(v_h.color, '#c9a84c'), v_h.quantity, p_unit_price, v_net, 'approved',
    case when v_early then 'Early withdrawal ' || p_symbol || ' | Value: $' || v_val || ' | Penalty: -$' || v_pen || ' | Net: $' || v_net
         else 'Property withdrawal ' || p_symbol || ' | Amount: $' || v_net end)
  returning id into v_tx;
  update public.profiles set cash = round(v_cash + v_net, 2) where id = p_user;
  return public.mx_done(p_user, p_key, 'property_withdraw', jsonb_build_object(
    'ok', true, 'tx_id', v_tx, 'symbol', p_symbol, 'value', v_val, 'penalty', v_pen, 'net', v_net, 'early', v_early,
    'cash', round(v_cash + v_net, 2)));
end $$;

-- ── SWAP (sell one holding into another, at market prices) ──────────────────
create or replace function public.mx_swap(
  p_user uuid, p_key text, p_from text, p_to text, p_qty numeric, p_from_price numeric, p_to_price numeric,
  p_fee_rate numeric, p_to_name text, p_to_icon text, p_to_color text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_prev jsonb := public.mx_seen(p_user, p_key);
  v_f public.holdings%rowtype; v_t public.holdings%rowtype; v_usd numeric; v_fee numeric; v_recv numeric; v_left numeric; v_tx uuid;
begin
  if v_prev is not null then return v_prev; end if;
  if p_from = p_to then raise exception 'Choose two different assets'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Enter an amount greater than zero'; end if;
  if coalesce(p_from_price, 0) <= 0 or coalesce(p_to_price, 0) <= 0 then raise exception 'Price unavailable, try again shortly'; end if;
  perform public.mx_lock_profile(p_user);
  select * into v_f from public.holdings where user_id = p_user and symbol = p_from order by created_at limit 1 for update;
  if not found or p_qty > v_f.quantity * 1.000001 then raise exception 'Insufficient %', p_from; end if;
  if v_f.locked_until is not null and v_f.locked_until > now() then raise exception '% is locked', p_from; end if;
  v_usd := least(p_qty, v_f.quantity) * p_from_price;
  v_fee := round(v_usd * coalesce(p_fee_rate, 0), 2);
  v_recv := (v_usd - v_fee) / p_to_price;
  v_left := v_f.quantity - least(p_qty, v_f.quantity);
  if v_left <= 0.0000001 then delete from public.holdings where id = v_f.id;
  else update public.holdings set quantity = v_left, updated_at = now() where id = v_f.id; end if;
  select * into v_t from public.holdings where user_id = p_user and symbol = p_to order by created_at limit 1 for update;
  if found then
    update public.holdings set quantity = v_t.quantity + v_recv,
      avg_buy_price = round((v_t.avg_buy_price * v_t.quantity + p_to_price * v_recv) / (v_t.quantity + v_recv), 6), updated_at = now()
    where id = v_t.id;
  else
    insert into public.holdings (user_id, symbol, name, icon, color, quantity, avg_buy_price)
    values (p_user, p_to, p_to_name, coalesce(p_to_icon, 'fas fa-circle'), coalesce(p_to_color, '#c9a84c'), v_recv, p_to_price);
  end if;
  insert into public.transactions (user_id, type, symbol, name, icon, color, quantity, price_at_tx, usd_amount, status, note)
  values (p_user, 'swap', p_to, 'Swap ' || p_from || '→' || p_to, coalesce(p_to_icon, 'fas fa-circle'), coalesce(p_to_color, '#c9a84c'), v_recv, p_to_price, 0, 'approved',
    'Swapped ' || round(least(p_qty, v_f.quantity), 8) || ' ' || p_from || ' → ' || round(v_recv, 8) || ' ' || p_to || ' | Fee: $' || v_fee)
  returning id into v_tx;
  return public.mx_done(p_user, p_key, 'swap', jsonb_build_object(
    'ok', true, 'tx_id', v_tx, 'from', p_from, 'to', p_to, 'sent', least(p_qty, v_f.quantity), 'received', v_recv, 'fee', v_fee));
end $$;

-- ── CFD OPEN ─────────────────────────────────────────────────────────────────
create or replace function public.mx_cfd_open(
  p_user uuid, p_key text, p_symbol text, p_name text, p_icon text, p_color text, p_direction text,
  p_lots numeric, p_price numeric, p_lot_value numeric, p_margin_rate numeric, p_fee_rate numeric,
  p_tp numeric default null, p_sl numeric default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_prev jsonb := public.mx_seen(p_user, p_key);
  v_cash numeric; v_notional numeric; v_margin numeric; v_fee numeric; v_id uuid; v_tx uuid;
begin
  if v_prev is not null then return v_prev; end if;
  if p_direction not in ('long', 'short') then raise exception 'Direction must be long or short'; end if;
  if p_lots is null or p_lots <= 0 then raise exception 'Choose at least one lot'; end if;
  if p_price is null or p_price <= 0 then raise exception 'Price unavailable for %, try again shortly', p_symbol; end if;
  v_cash := public.mx_lock_profile(p_user);
  v_notional := p_lots * p_lot_value;
  v_margin := round(v_notional * p_margin_rate, 2);
  v_fee := round(v_notional * p_fee_rate, 2);
  if v_margin + v_fee > v_cash then raise exception 'Insufficient margin'; end if;
  insert into public.open_trades (user_id, sym, direction, lots, entry_price, take_profit, stop_loss, notional, status)
  values (p_user, p_symbol, p_direction, p_lots, p_price, p_tp, p_sl, v_notional, 'open') returning id into v_id;
  insert into public.transactions (user_id, type, symbol, name, icon, color, quantity, price_at_tx, usd_amount, status, note)
  values (p_user, 'buy', p_symbol, p_name || ' CFD ' || upper(p_direction), coalesce(p_icon, 'fas fa-circle'), coalesce(p_color, '#c9a84c'), p_lots, p_price, -(v_margin + v_fee), 'approved',
    'CFD ' || upper(p_direction) || ' ' || p_lots || ' lot(s) @ $' || p_price || ' | Margin: $' || v_margin || ' | Fee: $' || v_fee)
  returning id into v_tx;
  update public.profiles set cash = round(v_cash - v_margin - v_fee, 2) where id = p_user;
  return public.mx_done(p_user, p_key, 'cfd_open', jsonb_build_object(
    'ok', true, 'trade_id', v_id, 'tx_id', v_tx, 'price', p_price, 'notional', v_notional, 'margin', v_margin, 'fee', v_fee,
    'cash', round(v_cash - v_margin - v_fee, 2)));
end $$;

-- ── CFD CLOSE (P&L = notional × move from entry; long +, short −) ───────────
create or replace function public.mx_cfd_close(
  p_user uuid, p_key text, p_trade_id uuid, p_price numeric, p_margin_rate numeric, p_auto boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_prev jsonb := public.mx_seen(p_user, p_key);
  v_cash numeric; v_t public.open_trades%rowtype; v_pnl numeric; v_margin numeric; v_credit numeric; v_tx uuid;
begin
  if v_prev is not null then return v_prev; end if;
  if p_price is null or p_price <= 0 then raise exception 'Price unavailable, try again shortly'; end if;
  v_cash := public.mx_lock_profile(p_user);
  select * into v_t from public.open_trades where id = p_trade_id and user_id = p_user for update;
  if not found then raise exception 'Trade not found'; end if;
  if v_t.status <> 'open' then raise exception 'This trade is already closed'; end if;
  v_pnl := round(v_t.notional * (p_price - v_t.entry_price) / nullif(v_t.entry_price, 0), 2);
  if v_t.direction = 'short' then v_pnl := -v_pnl; end if;
  v_margin := round(v_t.notional * p_margin_rate, 2);
  v_credit := round(v_margin + v_pnl, 2);
  update public.open_trades set status = 'closed', close_price = p_price, closed_at = now() where id = v_t.id;
  insert into public.transactions (user_id, type, symbol, name, icon, color, quantity, price_at_tx, usd_amount, status, note)
  values (p_user, 'sell', v_t.sym, v_t.sym || ' CFD Close' || case when p_auto then ' [AUTO]' else '' end, 'fas fa-chart-line', '#c9a84c', v_t.lots, p_price, v_credit, 'approved',
    'CFD close ' || upper(v_t.direction) || ' ' || v_t.lots || ' lot(s) @ $' || p_price || ' | Entry: $' || v_t.entry_price || ' | P&L: $' || v_pnl)
  returning id into v_tx;
  update public.profiles set cash = round(v_cash + v_credit, 2) where id = p_user;
  return public.mx_done(p_user, p_key, 'cfd_close', jsonb_build_object(
    'ok', true, 'trade_id', v_t.id, 'tx_id', v_tx, 'price', p_price, 'pnl', v_pnl, 'margin', v_margin, 'credit', v_credit,
    'cash', round(v_cash + v_credit, 2)));
end $$;

-- Only the server (service role) may call these
do $$
declare f text;
begin
  foreach f in array array[
    'mx_seen(uuid,text)', 'mx_done(uuid,text,text,jsonb)', 'mx_lock_profile(uuid)',
    'mx_buy(uuid,text,text,text,text,text,numeric,numeric,numeric,numeric,integer,text)',
    'mx_sell(uuid,text,text,numeric,numeric,numeric)',
    'mx_property_withdraw(uuid,text,text,numeric,numeric)',
    'mx_swap(uuid,text,text,text,numeric,numeric,numeric,numeric,text,text,text)',
    'mx_cfd_open(uuid,text,text,text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,numeric)',
    'mx_cfd_close(uuid,text,uuid,numeric,numeric,boolean)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

commit;

-- Asset classes (CFD lot size by class); taken from the pages' asset lists
update public.site_settings
set value = value || '{"asset_classes": {"crypto": ["BTC","ETH","SOL","BNB","XRP","ADA","LTC"], "stocks": ["AAPL","AMZN","GOOGL","MSFT","NVDA","TSLA"], "commodity": ["GOLD","SILVER","OIL"]}}'::jsonb
where key = 'trading' and not (value ? 'asset_classes');
