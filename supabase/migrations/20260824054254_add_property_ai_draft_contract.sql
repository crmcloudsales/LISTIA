create table if not exists public.property_drafts (
  property_id uuid primary key references public.properties(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_job_id uuid,
  draft_data jsonb not null default '{}'::jsonb,
  missing_fields text[] not null default '{}'::text[],
  status text not null default 'draft' check (status in ('draft','approved','superseded')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz
);

create index if not exists property_drafts_org_status_idx
  on public.property_drafts(organization_id, status, updated_at desc);

alter table public.property_drafts enable row level security;
revoke all on public.property_drafts from anon, authenticated;
grant select on public.property_drafts to authenticated;
grant all on public.property_drafts to service_role;

drop policy if exists property_drafts_select_member on public.property_drafts;
create policy property_drafts_select_member
on public.property_drafts for select to authenticated
using (
  exists (
    select 1 from public.organization_members m
    where m.organization_id=property_drafts.organization_id
      and m.user_id=(select auth.uid())
      and m.status='active'
  )
);

create or replace function private.apply_property_ai_result(
  p_job_id uuid,
  p_result jsonb,
  p_provider text,
  p_model text,
  p_provider_cost numeric default null,
  p_provider_currency text default 'usd'
)
returns jsonb
language plpgsql
security definer
set search_path=public,private
as $$
declare
  v_job private.property_ai_jobs%rowtype;
  v_property public.properties%rowtype;
  v_plan text := 'free';
  v_markup numeric := 30;
  v_missing text[] := '{}'::text[];
  v_stage text;
  v_title text;
  v_operation text;
  v_property_type text;
  v_description text;
  v_price numeric;
  v_currency text;
  v_commission text;
  v_location text;
  v_postal text;
  v_draft jsonb;
begin
  select * into v_job
  from private.property_ai_jobs
  where id=p_job_id
  for update;

  if not found then
    raise exception 'job_not_found';
  end if;

  if v_job.status not in ('queued','processing') then
    raise exception 'job_not_actionable';
  end if;

  select * into v_property
  from public.properties
  where id=v_job.property_id and organization_id=v_job.organization_id
  for update;

  if not found then
    raise exception 'property_not_found';
  end if;

  v_title := nullif(trim(coalesce(p_result->>'title','')), '');
  v_operation := lower(nullif(trim(coalesce(p_result->>'operation_type','')), ''));
  if v_operation not in ('sale','rent') then v_operation := null; end if;
  v_property_type := nullif(trim(coalesce(p_result->>'property_type','')), '');
  v_description := nullif(trim(coalesce(p_result->>'description','')), '');
  if coalesce(p_result->>'price','') ~ '^[0-9]+([.][0-9]+)?$' then
    v_price := (p_result->>'price')::numeric;
  end if;
  v_currency := upper(nullif(trim(coalesce(p_result->>'currency','')), ''));
  v_commission := nullif(trim(coalesce(p_result->>'commission_text','')), '');
  v_location := nullif(trim(coalesce(p_result->>'location_text','')), '');
  v_postal := nullif(trim(coalesce(p_result->>'postal_code','')), '');

  v_title := coalesce(v_property.title, v_title);
  v_operation := coalesce(v_property.operation_type, v_operation);
  v_property_type := coalesce(v_property.property_type, v_property_type);
  v_description := coalesce(v_property.description, v_description);
  v_price := coalesce(v_property.price, v_price);
  v_currency := coalesce(v_property.currency, v_currency);
  v_commission := coalesce(v_property.commission_text, v_commission);
  v_location := coalesce(v_property.location_text, v_location);
  v_postal := coalesce(v_property.postal_code, v_postal);

  if v_operation is null then v_missing := array_append(v_missing,'operation_type'); end if;
  if v_property_type is null then v_missing := array_append(v_missing,'property_type'); end if;
  if v_location is null then v_missing := array_append(v_missing,'location_text'); end if;
  if v_description is null then v_missing := array_append(v_missing,'description'); end if;
  if v_price is null then v_missing := array_append(v_missing,'price'); end if;
  if v_currency is null then v_missing := array_append(v_missing,'currency'); end if;

  v_stage := case when cardinality(v_missing)=0 then 'draft_ready' else 'needs_input' end;

  v_draft := jsonb_strip_nulls(jsonb_build_object(
    'title',v_title,
    'operation_type',v_operation,
    'property_type',v_property_type,
    'description',v_description,
    'price',v_price,
    'currency',v_currency,
    'commission_text',v_commission,
    'location_text',v_location,
    'postal_code',v_postal,
    'provider',p_provider,
    'model',p_model,
    'source_job_id',p_job_id,
    'generated_at',now()
  ));

  update public.properties
  set title=v_title,
      operation_type=v_operation,
      property_type=v_property_type,
      description=v_description,
      price=v_price,
      currency=v_currency,
      commission_text=v_commission,
      location_text=v_location,
      postal_code=v_postal,
      status='processing',
      processing_state=coalesce(processing_state,'{}'::jsonb) || jsonb_build_object(
        'stage',v_stage,
        'missing_fields',v_missing,
        'ai_provider',p_provider,
        'ai_model',p_model,
        'ai_job_id',p_job_id,
        'ai_completed_at',now(),
        'next_action',case when v_stage='draft_ready' then 'review_draft' else 'request_missing_input' end
      ),
      updated_at=now()
  where id=v_property.id;

  update public.property_processing_state
  set stage=v_stage,
      detected_fields=coalesce(detected_fields,'{}'::jsonb) || coalesce(p_result,'{}'::jsonb),
      missing_fields=v_missing,
      processing_completed_at=now(),
      error_message=null,
      updated_at=now()
  where property_id=v_property.id;

  insert into public.property_drafts(
    property_id,organization_id,source_job_id,draft_data,missing_fields,status,version,updated_at
  ) values (
    v_property.id,v_property.organization_id,p_job_id,v_draft,v_missing,'draft',1,now()
  )
  on conflict (property_id) do update set
    source_job_id=excluded.source_job_id,
    draft_data=excluded.draft_data,
    missing_fields=excluded.missing_fields,
    status='draft',
    version=public.property_drafts.version+1,
    updated_at=now(),
    approved_at=null;

  update private.property_ai_jobs
  set status='completed',
      provider=p_provider,
      model=p_model,
      provider_cost=p_provider_cost,
      provider_currency=lower(coalesce(p_provider_currency,'usd')),
      result=p_result,
      completed_at=now(),
      updated_at=now(),
      error_message=null
  where id=p_job_id;

  if coalesce(p_provider_cost,0) > 0 then
    select coalesce(plan_key,'free'), coalesce(usage_markup_percent,30)
      into v_plan,v_markup
    from public.organization_billing
    where organization_id=v_property.organization_id;

    insert into public.gestiones(
      organization_id,user_id,provider,service,provider_cost,provider_currency,
      plan_key,markup_percent,platform_revenue,final_user_cost,external_reference,billing_state,occurred_at
    ) values (
      v_property.organization_id,
      v_property.created_by,
      coalesce(nullif(p_provider,''),'ai'),
      'property_ai_processing',
      p_provider_cost,
      lower(coalesce(p_provider_currency,'usd')),
      coalesce(v_plan,'free'),
      coalesce(v_markup,30),
      p_provider_cost*(coalesce(v_markup,30)/100.0),
      p_provider_cost*(1+(coalesce(v_markup,30)/100.0)),
      p_job_id::text,
      'pending',
      now()
    );
  end if;

  return jsonb_build_object(
    'ok',true,
    'property_id',v_property.id,
    'stage',v_stage,
    'missing_fields',v_missing,
    'draft',v_draft
  );
end;
$$;

revoke execute on function private.apply_property_ai_result(uuid,jsonb,text,text,numeric,text) from public, anon, authenticated;
grant execute on function private.apply_property_ai_result(uuid,jsonb,text,text,numeric,text) to service_role;
