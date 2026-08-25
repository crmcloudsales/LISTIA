create or replace function public.block_seeker_property_writes()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare v_uid uuid;
begin
  v_uid := (select auth.uid());
  if v_uid is not null and exists(select 1 from public.profiles p where p.id=v_uid and p.account_mode='seeker') then
    raise exception 'seeker_accounts_are_read_only' using errcode='42501';
  end if;
  return new;
end;
$$;

drop trigger if exists block_seeker_properties on public.properties;
create trigger block_seeker_properties before insert or update on public.properties for each row execute function public.block_seeker_property_writes();

drop trigger if exists block_seeker_marketplace_publish on public.marketplace_listings;
create trigger block_seeker_marketplace_publish before insert or update on public.marketplace_listings for each row execute function public.block_seeker_property_writes();
