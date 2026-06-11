-- =====================================================================
-- Noor Dentofacial Clinic — 0014 OS push notifications (closed-app)
-- =====================================================================
-- Every in-app notification (0012) now also lands on the recipient's
-- phone(s) as an OS push, so staff are alerted even when the app is
-- closed. The trigger POSTs straight to Expo's push API via pg_net —
-- async + fire-and-forget, so the business write never waits on (or
-- fails because of) push delivery. No Edge Function / server needed.
--
-- Device tokens come from the existing device_tokens table (0003),
-- registered by the app (src/lib/push.ts).
-- =====================================================================

create extension if not exists pg_net;

create or replace function public.tg_push_notify() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_messages jsonb;
begin
  -- One Expo batch with every device this recipient has registered.
  select jsonb_agg(jsonb_build_object(
    'to',        t.token,
    'title',     new.title,
    'body',      coalesce(new.body, ''),
    'data',      coalesce(new.data, '{}'::jsonb)
                   || jsonb_build_object('type', new.type, 'notification_id', new.id),
    'sound',     'default',
    'priority',  'high',
    'channelId', 'default'
  ))
  into v_messages
  from public.device_tokens t
  where t.profile_id = new.recipient_id;

  if v_messages is not null then
    perform net.http_post(
      url     := 'https://exp.host/--/api/v2/push/send',
      body    := v_messages,
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
  end if;
  return new;
exception when others then
  -- Push is best-effort: never block the insert that triggered it.
  return new;
end;
$$;

drop trigger if exists push_notify on public.in_app_notifications;
create trigger push_notify after insert on public.in_app_notifications
  for each row execute function public.tg_push_notify();
