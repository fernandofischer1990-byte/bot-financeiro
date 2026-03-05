import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export async function trackEvent(
  userId: string,
  eventName: string,
  properties?: Record<string, string | number | boolean | null>
): Promise<void> {
  try {
    await supabase.from('analytics_events').insert([{
      user_id: userId,
      event_name: eventName,
      properties: (properties ?? null) as Json,
    }]);
  } catch (err) {
    console.warn('[Analytics] Failed to track event:', eventName, err);
  }
}
