create table if not exists private.ai_engine_policy (
  singleton boolean primary key default true check(singleton),
  mode text not null default 'free_only' check(mode in ('free_only','free_first','balanced','quality_first')),
  paid_fallback_enabled boolean not null default false,
  monthly_paid_budget_usd numeric(12,4) not null default 0 check(monthly_paid_budget_usd>=0),
  private_data_google_free_enabled boolean not null default false,
  notes text,
  updated_at timestamptz not null default now()
);
alter table private.ai_engine_policy enable row level security;
revoke all on private.ai_engine_policy from anon, authenticated;
grant select,insert,update on private.ai_engine_policy to service_role;
insert into private.ai_engine_policy(singleton,mode,paid_fallback_enabled,monthly_paid_budget_usd,private_data_google_free_enabled,notes)
values(true,'free_only',false,0,false,'LISTIA launch policy: no premium AI spend. Free/free-tier/self-hosted candidates only until explicitly changed.')
on conflict(singleton) do update set mode='free_only',paid_fallback_enabled=false,monthly_paid_budget_usd=0,private_data_google_free_enabled=false,notes=excluded.notes,updated_at=now();

update private.ai_provider_runtimes set configuration=coalesce(configuration,'{}'::jsonb)||jsonb_build_object('cost_class','free_endpoint_candidate') where runtime_key='nvidia:listia_direct';
update private.ai_provider_runtimes set configuration=coalesce(configuration,'{}'::jsonb)||jsonb_build_object('cost_class','premium') where runtime_key='openai:direct';
