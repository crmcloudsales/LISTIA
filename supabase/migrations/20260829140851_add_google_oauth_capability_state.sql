alter table private.oauth_connection_states
  add column if not exists requested_capabilities text[] not null default array['workspace']::text[];

alter table private.oauth_connection_states
  drop constraint if exists oauth_connection_states_requested_capabilities_check;
alter table private.oauth_connection_states
  add constraint oauth_connection_states_requested_capabilities_check
  check (
    cardinality(requested_capabilities) between 1 and 2
    and requested_capabilities <@ array['workspace','ads']::text[]
  );
