alter table public.properties drop constraint if exists properties_locale_check;

alter table public.properties
  add constraint properties_locale_check
  check (locale = any (array[
    'es'::text,
    'en'::text,
    'fr'::text,
    'it'::text,
    'pt-BR'::text,
    'de'::text,
    'ar-AE'::text,
    'ru'::text,
    'he'::text,
    'zh-CN'::text,
    'ja'::text
  ]));
