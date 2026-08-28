create table if not exists public.conversion_signals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  signal_type text not null check (signal_type in ('qualified_lead','appointment','conversion')),
  source_event_type text not null,
  source_event_id uuid not null,
  event_time timestamptz not null,
  quality_score numeric,
  platforms text[] not null default array['meta','google','tiktok','linkedin']::text[],
  payload jsonb not null default '{}'::jsonb,
  delivery_status text not null default 'pending' check (delivery_status in ('pending','processing','sent','partial','failed','suppressed')),
  attempts integer not null default 0,
  last_error text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_event_type,source_event_id,signal_type)
);
create index if not exists conversion_signals_pending_idx on public.conversion_signals(delivery_status,created_at) where delivery_status in ('pending','failed');
create index if not exists conversion_signals_org_idx on public.conversion_signals(organization_id,created_at desc);
alter table public.conversion_signals enable row level security;
drop policy if exists conversion_signals_member_select on public.conversion_signals;
create policy conversion_signals_member_select on public.conversion_signals for select to authenticated using (exists(select 1 from public.organization_members m where m.organization_id=conversion_signals.organization_id and m.user_id=auth.uid() and m.status='active'));
revoke all on public.conversion_signals from anon, authenticated;
grant select on public.conversion_signals to authenticated;

create or replace function public.enqueue_lead_conversion_signal() returns trigger language plpgsql security definer set search_path='pg_catalog','public' as $$
declare v_stage text:=lower(coalesce(new.to_stage,'')); v_event text:=lower(coalesce(new.event_type,'')); v_type text; v_property uuid;
begin
  if v_event in ('qualified','qualified_lead','lead_qualified') or v_stage in ('qualified','qualified_lead','mql','sql') then v_type:='qualified_lead';
  elsif v_event in ('won','closed_won','conversion','converted','sale','deal_won') or v_stage in ('won','closed_won','converted','sold') then v_type:='conversion';
  elsif v_event in ('appointment','appointment_booked','meeting_booked') or v_stage in ('appointment','appointment_booked','meeting') then v_type:='appointment';
  else return new; end if;
  select property_id into v_property from public.leads where id=new.lead_id;
  insert into public.conversion_signals(organization_id,lead_id,property_id,signal_type,source_event_type,source_event_id,event_time,quality_score,payload)
  values(new.organization_id,new.lead_id,v_property,v_type,'lead_event',new.id,coalesce(new.occurred_at,now()),new.quality_score,jsonb_build_object('from_stage',new.from_stage,'to_stage',new.to_stage,'event_type',new.event_type,'source',new.source))
  on conflict do nothing;
  return new;
end $$;
revoke all on function public.enqueue_lead_conversion_signal() from public,anon,authenticated;

drop trigger if exists trg_enqueue_lead_conversion_signal on public.lead_events;
create trigger trg_enqueue_lead_conversion_signal after insert on public.lead_events for each row execute function public.enqueue_lead_conversion_signal();

create or replace function public.enqueue_appointment_conversion_signal() returns trigger language plpgsql security definer set search_path='pg_catalog','public' as $$
begin
  if lower(coalesce(new.status,'')) in ('cancelled','canceled','deleted') then return new; end if;
  insert into public.conversion_signals(organization_id,lead_id,property_id,signal_type,source_event_type,source_event_id,event_time,payload)
  values(new.organization_id,new.lead_id,new.property_id,'appointment','appointment',new.id,coalesce(new.created_at,now()),jsonb_build_object('status',new.status,'meeting_type',new.meeting_type,'starts_at',new.starts_at))
  on conflict do nothing;
  return new;
end $$;
revoke all on function public.enqueue_appointment_conversion_signal() from public,anon,authenticated;

drop trigger if exists trg_enqueue_appointment_conversion_signal on public.appointments;
create trigger trg_enqueue_appointment_conversion_signal after insert on public.appointments for each row execute function public.enqueue_appointment_conversion_signal();