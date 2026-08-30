create table if not exists public.marketplace_coverage_benchmarks (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  territory text not null,
  locality text not null,
  operation_type text not null check (operation_type in ('sale','rent','sale_or_rent','unknown')),
  property_type text not null default 'all',
  observed_count integer not null check (observed_count >= 0),
  source_url text not null,
  observed_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_name,territory,locality,operation_type,property_type)
);

revoke all on public.marketplace_coverage_benchmarks from anon, authenticated;

comment on table public.marketplace_coverage_benchmarks is
  'External public inventory counts used only as coverage benchmarks. Counts are not assumed unique and are never imported as listings.';
