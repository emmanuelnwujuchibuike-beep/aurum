-- Fix: Admin P&L editor could only set LOSS, not PROFIT on holdings.
-- Root cause: A WITH CHECK RLS policy and/or BEFORE UPDATE trigger was
-- preventing avg_buy_price from being LOWERED (lower avg = profit condition).

-- 1. Drop any RLS policies whose WITH CHECK prevents lowering avg_buy_price.
DROP POLICY IF EXISTS restrict_avg_price        ON public.holdings;
DROP POLICY IF EXISTS prevent_profit            ON public.holdings;
DROP POLICY IF EXISTS enforce_loss_only         ON public.holdings;
DROP POLICY IF EXISTS holdings_price_guard      ON public.holdings;
DROP POLICY IF EXISTS avg_price_increase_only   ON public.holdings;
DROP POLICY IF EXISTS holdings_update_policy    ON public.holdings;
DROP POLICY IF EXISTS holdings_write_guard      ON public.holdings;
DROP POLICY IF EXISTS no_avg_price_decrease     ON public.holdings;

-- 2. Re-create a clean permissive update policy (users can only edit own rows,
--    no restriction on price direction). Service role bypasses this entirely.
DROP POLICY IF EXISTS holdings_update_own ON public.holdings;
CREATE POLICY holdings_update_own ON public.holdings
  FOR UPDATE
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Drop ALL UPDATE triggers on the holdings table.
--    A BEFORE UPDATE trigger that returns NULL silently cancels the write,
--    returning 0 affected rows with no error -- exactly the profit-block symptom.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT trigger_name
    FROM information_schema.triggers
    WHERE event_object_schema = 'public'
      AND event_object_table  = 'holdings'
      AND event_manipulation  = 'UPDATE'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.holdings CASCADE', r.trigger_name);
    RAISE NOTICE 'Dropped UPDATE trigger: %', r.trigger_name;
  END LOOP;
END;
$$;

-- 4. Drop commonly-named guard functions that may back the triggers above.
DROP FUNCTION IF EXISTS prevent_avg_price_decrease()  CASCADE;
DROP FUNCTION IF EXISTS check_avg_buy_price_change()  CASCADE;
DROP FUNCTION IF EXISTS validate_holding_update()     CASCADE;
DROP FUNCTION IF EXISTS holdings_price_guard()        CASCADE;
DROP FUNCTION IF EXISTS enforce_no_profit()           CASCADE;
DROP FUNCTION IF EXISTS restrict_avg_price_fn()       CASCADE;
