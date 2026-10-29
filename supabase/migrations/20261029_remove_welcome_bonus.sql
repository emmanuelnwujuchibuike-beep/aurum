-- Remove the $20 welcome bonus for new sign-ups (owner request, 2026-10-29).
-- Only the bonus changes: WELCOME_CASH 20 -> 0, so no bonus cash, no "Welcome Bonus"
-- transaction, and welcome_bonus_active = false. Profile creation is unchanged.
-- Existing customers keep any bonus they already received.

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  WELCOME_CASH  CONSTANT NUMERIC := 0;       -- welcome bonus removed 2026-10-29 (owner request)
  v_first       TEXT;
  v_last        TEXT;
  v_initials    TEXT;
  v_email       TEXT;
BEGIN
  v_email  := COALESCE(NEW.email, '');
  v_first  := COALESCE(
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'firstName',
    split_part(COALESCE(NEW.email,'user'), '@', 1),
    'User'
  );
  v_last   := COALESCE(
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'lastName',
    ''
  );
  v_initials := UPPER(LEFT(v_first,1) || LEFT(v_last,1));
  IF v_initials = '' THEN v_initials := '??'; END IF;

  INSERT INTO public.profiles (
    id, email, first_name, last_name, avatar_initials,
    cash, welcome_bonus_active
  )
  VALUES (
    NEW.id, v_email, v_first, v_last, v_initials,
    WELCOME_CASH, WELCOME_CASH > 0
  )
  ON CONFLICT (id) DO NOTHING;

  IF WELCOME_CASH > 0 THEN
    INSERT INTO public.transactions (
      user_id, type, symbol, name, icon, color, usd_amount, note
    ) VALUES (
      NEW.id, 'deposit', 'USD', 'Welcome Bonus',
      'fas fa-gift', '#c9a84c', WELCOME_CASH,
      'Welcome bonus — compliments of Aurum Capital'
    );
  END IF;

  RETURN NEW;
END;
$function$;
