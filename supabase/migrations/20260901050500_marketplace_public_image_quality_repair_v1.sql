-- LISTIA Marketplace only.
-- Repair the final public listings whose covers fail the Marketplace HTTPS/image rule.
-- No unrelated assets are introduced; replacements come from each listing's own source/gallery.

update public.marketplace_listings
set cover_image_url = case id
  when 'df29807a-4a92-4edb-88f2-c79aa69a6b59'::uuid then 'https://cozumelcapital.com/wp-content/uploads/2024/02/condos-nala-web.jpg'
  when '0a4bb554-fd1a-4954-a6be-88ace7642983'::uuid then 'https://cozumelcapital.com/wp-content/uploads/2024/03/terreno-demita-zona-inddustrial-web.jpg'
  else regexp_replace(cover_image_url,'^http://','https://','i')
end,
gallery = case id
  when 'df29807a-4a92-4edb-88f2-c79aa69a6b59'::uuid then '["https://cozumelcapital.com/wp-content/uploads/2024/02/condos-nala-web.jpg","https://cozumelcapital.com/wp-content/uploads/2024/10/price-list-nala-1024x764.jpg","https://cozumelcapital.com/wp-content/uploads/2024/10/discounts-nala-1024x756.jpg","https://cozumelcapital.com/wp-content/uploads/2024/10/positions-nala-1024x756.jpg","https://cozumelcapital.com/wp-content/uploads/2024/02/1-150x150.jpg","https://cozumelcapital.com/wp-content/uploads/2024/02/2-150x150.jpg","https://cozumelcapital.com/wp-content/uploads/2024/02/3-150x150.jpg","https://cozumelcapital.com/wp-content/uploads/2024/02/4-150x150.jpg"]'::jsonb
  when '0a4bb554-fd1a-4954-a6be-88ace7642983'::uuid then '["https://cozumelcapital.com/wp-content/uploads/2024/03/terreno-demita-zona-inddustrial-web.jpg","https://cozumelcapital.com/wp-content/uploads/2024/03/0cf2c9c5-f280-4b7d-abc0-adb385c0e50d.jpg","https://cozumelcapital.com/wp-content/uploads/2024/03/0cf2c9c5-f280-4b7d-abc0-adb385c0e50d-300x225.jpg","https://cozumelcapital.com/wp-content/uploads/2024/03/0cf2c9c5-f280-4b7d-abc0-adb385c0e50d-768x576.jpg"]'::jsonb
  else gallery
end,
updated_at=now()
where id in (
  'df29807a-4a92-4edb-88f2-c79aa69a6b59'::uuid,
  '0a4bb554-fd1a-4954-a6be-88ace7642983'::uuid,
  'c4254de6-4ca1-4d22-b386-ae55f21f6f83'::uuid,
  'f184a0fa-feb5-4f31-8198-733881b7eabd'::uuid,
  'f78980ad-a505-469d-a99b-6a6cabcea92d'::uuid,
  '98dcf6de-5eec-4cb2-85c1-dafa024efe4f'::uuid,
  '4e3505bf-30e1-43e0-be9d-93f207bab335'::uuid,
  '2fffde4f-f3e8-4e92-bec7-1ffaf717b0e2'::uuid
)
and visibility='public' and status='published';
