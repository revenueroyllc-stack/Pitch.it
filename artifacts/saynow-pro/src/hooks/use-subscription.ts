import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { isAdmin } from '@/lib/billing';

export type SubStatus = 'loading' | 'active' | 'inactive' | 'admin';

export function useSubscription(userId?: string, email?: string): SubStatus {
  const [status, setStatus] = useState<SubStatus>('loading');

  useEffect(() => {
    if (!userId) { setStatus('inactive'); return; }

    if (isAdmin(email)) { setStatus('admin'); return; }

    async function check() {
      if (!supabase) { setStatus('inactive'); return; }
      try {
        const { data } = await supabase
          .from('subscriptions')
          .select('status')
          .eq('user_id', userId)
          .eq('status', 'active')
          .maybeSingle();
        setStatus(data ? 'active' : 'inactive');
      } catch {
        setStatus('inactive');
      }
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('subscribed') === 'true') {
      setTimeout(check, 2000);
      window.history.replaceState({}, '', window.location.pathname);
    } else {
      check();
    }
  }, [userId, email]);

  return status;
}
