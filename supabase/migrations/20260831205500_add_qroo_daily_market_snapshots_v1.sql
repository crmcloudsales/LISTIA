create table if not exists private.marketplace_qroo_daily_snapshots (
  snapshot_date date not null,
  canonical_place text not null,
  municipality text,
  operation_type text not null,
  currency text not null,
  inventory_count bigint not null default 0,
  source_count bigint not null default 0,
  price_samples bigint not null default 0,
  price_m2_samples bigint not null default 0,
  median_price numeric,
  median_price_per_m2 numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(snapshot_date,canonical_place,operation_type,currency)
);
alter table private.marketplace_qroo_daily_snapshots enable row level security;
revoke all on private.marketplace_qroo_daily_snapshots from public,anon,authenticated;

create index if not exists marketplace_qroo_daily_snapshots_place_date_idx
  on private.marketplace_qroo_daily_snapshots(canonical_place,snapshot_date desc);

create or replace function private.refresh_marketplace_qroo_daily_snapshot()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_date date := (now() at time zone 'America/Cancun')::date;
  v_rows bigint := 0;
begin
  insert into private.marketplace_qroo_daily_snapshots(
    snapshot_date,canonical_place,municipality,operation_type,currency,
    inventory_count,source_count,price_samples,price_m2_samples,
    median_price,median_price_per_m2,updated_at
  )
  select
    v_date,
    l.canonical_place,
    max(l.municipality) as municipality,
    case when lower(coalesce(l.operation_type,'')) in ('sale','rent') then lower(l.operation_type) else 'unknown' end,
    upper(coalesce(nullif(btrim(l.currency),''),'UNKNOWN')),
    count(*) filter(where not (
      coalesce(l.title,'') ~* '(Quer[eé]taro|Zapopan|Jalisco|Tapalpa|La Barca|Boca del R[ií]o|Veracruz|Guanajuato|Abu Dhabi)'
      and coalesce(l.title,'') !~* '(Quintana Roo|Solidaridad|Playa del Carmen|Canc[uú]n|Tulum|Bacalar|Cozumel|Puerto Morelos|Isla Mujeres|Chetumal|Akumal)'
    ))::bigint,
    count(distinct l.source_id) filter(where not (
      coalesce(l.title,'') ~* '(Quer[eé]taro|Zapopan|Jalisco|Tapalpa|La Barca|Boca del R[ií]o|Veracruz|Guanajuato|Abu Dhabi)'
      and coalesce(l.title,'') !~* '(Quintana Roo|Solidaridad|Playa del Carmen|Canc[uú]n|Tulum|Bacalar|Cozumel|Puerto Morelos|Isla Mujeres|Chetumal|Akumal)'
    ))::bigint,
    count(*) filter(where l.price is not null and not (
      coalesce(l.title,'') ~* '(Quer[eé]taro|Zapopan|Jalisco|Tapalpa|La Barca|Boca del R[ií]o|Veracruz|Guanajuato|Abu Dhabi)'
      and coalesce(l.title,'') !~* '(Quintana Roo|Solidaridad|Playa del Carmen|Canc[uú]n|Tulum|Bacalar|Cozumel|Puerto Morelos|Isla Mujeres|Chetumal|Akumal)'
    ))::bigint,
    count(*) filter(where l.price is not null and l.area_m2 is not null and l.area_m2>0 and not (
      coalesce(l.title,'') ~* '(Quer[eé]taro|Zapopan|Jalisco|Tapalpa|La Barca|Boca del R[ií]o|Veracruz|Guanajuato|Abu Dhabi)'
      and coalesce(l.title,'') !~* '(Quintana Roo|Solidaridad|Playa del Carmen|Canc[uú]n|Tulum|Bacalar|Cozumel|Puerto Morelos|Isla Mujeres|Chetumal|Akumal)'
    ))::bigint,
    percentile_cont(0.5) within group(order by l.price) filter(where l.price is not null and not (
      coalesce(l.title,'') ~* '(Quer[eé]taro|Zapopan|Jalisco|Tapalpa|La Barca|Boca del R[ií]o|Veracruz|Guanajuato|Abu Dhabi)'
      and coalesce(l.title,'') !~* '(Quintana Roo|Solidaridad|Playa del Carmen|Canc[uú]n|Tulum|Bacalar|Cozumel|Puerto Morelos|Isla Mujeres|Chetumal|Akumal)'
    ))::numeric,
    percentile_cont(0.5) within group(order by (l.price/l.area_m2)) filter(where l.price is not null and l.area_m2 is not null and l.area_m2>0 and not (
      coalesce(l.title,'') ~* '(Quer[eé]taro|Zapopan|Jalisco|Tapalpa|La Barca|Boca del R[ií]o|Veracruz|Guanajuato|Abu Dhabi)'
      and coalesce(l.title,'') !~* '(Quintana Roo|Solidaridad|Playa del Carmen|Canc[uú]n|Tulum|Bacalar|Cozumel|Puerto Morelos|Isla Mujeres|Chetumal|Akumal)'
    ))::numeric,
    now()
  from public.marketplace_qroo_mapped_listings l
  where l.map_precision <> 'unmapped' and l.canonical_place is not null
  group by l.canonical_place,
           case when lower(coalesce(l.operation_type,'')) in ('sale','rent') then lower(l.operation_type) else 'unknown' end,
           upper(coalesce(nullif(btrim(l.currency),''),'UNKNOWN'))
  having count(*) filter(where not (
      coalesce(l.title,'') ~* '(Quer[eé]taro|Zapopan|Jalisco|Tapalpa|La Barca|Boca del R[ií]o|Veracruz|Guanajuato|Abu Dhabi)'
      and coalesce(l.title,'') !~* '(Quintana Roo|Solidaridad|Playa del Carmen|Canc[uú]n|Tulum|Bacalar|Cozumel|Puerto Morelos|Isla Mujeres|Chetumal|Akumal)'
    )) > 0
  on conflict(snapshot_date,canonical_place,operation_type,currency)
  do update set municipality=excluded.municipality,inventory_count=excluded.inventory_count,
    source_count=excluded.source_count,price_samples=excluded.price_samples,
    price_m2_samples=excluded.price_m2_samples,median_price=excluded.median_price,
    median_price_per_m2=excluded.median_price_per_m2,updated_at=now();
  get diagnostics v_rows = row_count;
  return jsonb_build_object('ok',true,'snapshot_date',v_date,'rows',v_rows);
end;
$function$;
revoke all on function private.refresh_marketplace_qroo_daily_snapshot() from public,anon,authenticated;
grant execute on function private.refresh_marketplace_qroo_daily_snapshot() to service_role;

create or replace view public.marketplace_qroo_market_trends as
select snapshot_date,canonical_place,municipality,operation_type,currency,
       inventory_count,source_count,price_samples,price_m2_samples,
       median_price,median_price_per_m2
from private.marketplace_qroo_daily_snapshots;
revoke all on public.marketplace_qroo_market_trends from anon,authenticated;
grant select on public.marketplace_qroo_market_trends to service_role;

select cron.unschedule(jobid) from cron.job where jobname='listia-marketplace-qroo-daily-snapshot';
select cron.schedule('listia-marketplace-qroo-daily-snapshot','35 6 * * *','select private.refresh_marketplace_qroo_daily_snapshot();');