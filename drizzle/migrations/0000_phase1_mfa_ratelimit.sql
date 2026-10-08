DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['activity_log','analytics_events','category_mappings','chat_messages','import_history','mapping_templates','profiles'] LOOP
    EXECUTE format('CREATE POLICY "Require MFA when enrolled" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (private.mfa_satisfied()) WITH CHECK (private.mfa_satisfied())', t);
  END LOOP;
END $$;

CREATE TABLE public.rate_limit_hits (
  id bigserial PRIMARY KEY,
  bucket text NOT NULL,
  hit_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rate_limit_hits_bucket_time_idx ON public.rate_limit_hits (bucket, hit_at DESC);
GRANT ALL ON public.rate_limit_hits TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.rate_limit_hits_id_seq TO service_role;
ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(p_bucket text, p_limit int, p_window_seconds int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int; v_oldest timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_bucket));
  DELETE FROM public.rate_limit_hits WHERE bucket = p_bucket AND hit_at < now() - make_interval(secs => p_window_seconds);
  SELECT count(*), min(hit_at) INTO v_count, v_oldest FROM public.rate_limit_hits WHERE bucket = p_bucket;
  IF v_count >= p_limit THEN
    RETURN jsonb_build_object('allowed', false, 'retry_after',
      GREATEST(1, ceil(extract(epoch FROM (v_oldest + make_interval(secs => p_window_seconds) - now())))::int));
  END IF;
  INSERT INTO public.rate_limit_hits (bucket) VALUES (p_bucket);
  RETURN jsonb_build_object('allowed', true, 'retry_after', 0);
END $$;
REVOKE ALL ON FUNCTION public.consume_rate_limit(text,int,int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text,int,int) TO service_role;