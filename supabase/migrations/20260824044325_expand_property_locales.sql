alter table public.properties drop constraint if exists properties_locale_check;
alter table public.properties add constraint properties_locale_check check (locale in ('es','en','fr','it','pt-BR','de','ar-AE'));
