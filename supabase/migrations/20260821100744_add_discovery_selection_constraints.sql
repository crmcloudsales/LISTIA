alter table public.discovery_items
  add constraint discovery_items_name_not_blank check (char_length(trim(name)) > 0) not valid;

alter table public.discovery_items validate constraint discovery_items_name_not_blank;

create index if not exists discovery_items_source_external_idx
  on public.discovery_items (organization_id, source_type, external_id)
  where external_id is not null;
