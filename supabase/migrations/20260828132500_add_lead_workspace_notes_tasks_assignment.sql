alter table public.leads add column if not exists assigned_user_id uuid references public.profiles(id) on delete set null;
create index if not exists leads_org_assigned_idx on public.leads(organization_id,assigned_user_id) where assigned_user_id is not null;

create table if not exists public.lead_notes (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 lead_id uuid not null references public.leads(id) on delete cascade,
 author_user_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check (char_length(body) between 1 and 4000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists lead_notes_lead_time_idx on public.lead_notes(lead_id,created_at desc);
alter table public.lead_notes enable row level security;
drop policy if exists lead_notes_member_select on public.lead_notes;
create policy lead_notes_member_select on public.lead_notes for select to authenticated using (exists(select 1 from public.organization_members m where m.organization_id=lead_notes.organization_id and m.user_id=(select auth.uid()) and m.status='active'));
revoke insert,update,delete on public.lead_notes from anon,authenticated;
grant select on public.lead_notes to authenticated;

create table if not exists public.lead_tasks (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 lead_id uuid not null references public.leads(id) on delete cascade,
 title text not null check (char_length(title) between 1 and 240),
 status text not null default 'open' check (status in ('open','done','cancelled')),
 due_at timestamptz,
 assigned_user_id uuid references public.profiles(id) on delete set null,
 created_by uuid not null references public.profiles(id) on delete cascade,
 completed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists lead_tasks_lead_status_due_idx on public.lead_tasks(lead_id,status,due_at);
alter table public.lead_tasks enable row level security;
drop policy if exists lead_tasks_member_select on public.lead_tasks;
create policy lead_tasks_member_select on public.lead_tasks for select to authenticated using (exists(select 1 from public.organization_members m where m.organization_id=lead_tasks.organization_id and m.user_id=(select auth.uid()) and m.status='active'));
revoke insert,update,delete on public.lead_tasks from anon,authenticated;
grant select on public.lead_tasks to authenticated;