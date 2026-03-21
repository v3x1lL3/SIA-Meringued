/**
 * Subscribes to Supabase Realtime on `public.orders` and refreshes the admin orders list.
 * Enable Realtime for the `orders` table in Supabase Dashboard → Database → Replication (or Table → Enable Realtime).
 * RLS still applies to what your JWT can read; Realtime only notifies — the page reloads merged data.
 */
import { supabase } from './core/supabaseClient.js';

let channel = null;

function reloadAdminOrders() {
  const fn = typeof window !== 'undefined' && window.__reloadAdminOrdersMerged;
  if (typeof fn === 'function') {
    fn();
  }
}

function subscribe() {
  if (channel) return;

  channel = supabase
    .channel('admin-orders-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders' },
      function (payload) {
        console.info('[admin-orders-realtime]', payload.eventType || payload.event, payload.new?.id || payload.old?.id || '');
        reloadAdminOrders();
      }
    )
    .subscribe(function (status, err) {
      if (status === 'SUBSCRIBED') {
        console.info('[admin-orders-realtime] Subscribed to public.orders');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[admin-orders-realtime]', status, err || '');
      }
    });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', subscribe);
  } else {
    subscribe();
  }
}
