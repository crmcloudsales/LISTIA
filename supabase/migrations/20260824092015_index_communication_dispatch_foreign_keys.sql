create index if not exists communication_dispatches_property_idx on private.communication_dispatches(property_id) where property_id is not null;
create index if not exists communication_dispatches_template_idx on private.communication_dispatches(template_key) where template_key is not null;
create index if not exists communication_dispatches_gestion_idx on private.communication_dispatches(gestion_id) where gestion_id is not null;
