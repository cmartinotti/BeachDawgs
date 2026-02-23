-- Helper function called by checkin-verify Edge Function
-- Atomically increments user totals after a verified check-in
CREATE OR REPLACE FUNCTION public.increment_user_stats(
  p_user_id    UUID,
  p_points     INTEGER,
  p_new_beach  BOOLEAN
) RETURNS VOID AS $$
BEGIN
  UPDATE public.user_profiles
  SET
    total_points         = total_points + p_points,
    checkin_count        = checkin_count + 1,
    unique_beaches_count = unique_beaches_count + CASE WHEN p_new_beach THEN 1 ELSE 0 END,
    updated_at           = now()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
