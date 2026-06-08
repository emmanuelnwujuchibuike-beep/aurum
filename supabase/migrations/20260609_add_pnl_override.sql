-- Add pnl_override column to holdings.
-- When set by admin, this value is displayed as the holding's P&L
-- instead of the calculated (live - avg) * qty, allowing any profit amount.
-- When NULL, normal calculated P&L is used.

ALTER TABLE public.holdings
  ADD COLUMN IF NOT EXISTS pnl_override NUMERIC DEFAULT NULL;
