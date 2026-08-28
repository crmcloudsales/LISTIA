update public.properties p
set status = case
  when ps.stage='needs_input' and coalesce(cardinality(ps.missing_fields),0)>0 then 'needs_info'
  when ps.stage='draft_ready' and coalesce(cardinality(ps.missing_fields),0)=0 then 'ready'
  else p.status
end,
updated_at=now()
from public.property_processing_state ps
where ps.property_id=p.id
  and p.status='processing'
  and ps.processing_completed_at is not null
  and ((ps.stage='needs_input' and coalesce(cardinality(ps.missing_fields),0)>0)
    or (ps.stage='draft_ready' and coalesce(cardinality(ps.missing_fields),0)=0));