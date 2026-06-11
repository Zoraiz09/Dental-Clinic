import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isMock } from './supabase';
import { listMyNotifications } from '../api/queries';
import { qk } from './queryKeys';

/**
 * The signed-in user's in-app notifications, kept live.
 *
 * Loads the persisted list via React Query, then (in live mode) opens a
 * Supabase Realtime channel filtered to this user's rows — so a new
 * notification refetches the list the instant the DB trigger writes it,
 * with no polling. Falls back to a plain query in mock mode.
 */
export function useNotifications(userId?: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: qk.notifications(),
    queryFn: listMyNotifications,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (isMock || !userId) return;
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'in_app_notifications', filter: `recipient_id=eq.${userId}` },
        () => { qc.invalidateQueries({ queryKey: qk.notifications() }); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc, userId]);

  return query;
}
