create index if not exists ai_runs_provider_created_idx
  on private.ai_runs(provider_key, created_at desc)
  where provider_key is not null;
