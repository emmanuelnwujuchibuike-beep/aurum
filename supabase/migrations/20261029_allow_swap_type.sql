-- Swap never worked: the Invest page records swaps as type 'swap', but the
-- check constraint only allowed buy / sell / deposit / withdraw, so every swap
-- failed. Allow 'swap' (nothing else changes).
alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions add constraint transactions_type_check
  check (type = any (array['buy', 'sell', 'deposit', 'withdraw', 'swap']));
