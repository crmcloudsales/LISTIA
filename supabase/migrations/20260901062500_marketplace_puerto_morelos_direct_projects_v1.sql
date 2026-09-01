-- LISTIA Marketplace only.
-- Verified direct-project geodata for Puerto Morelos.

update public.marketplace_qroo_places
set aliases = array(select distinct x from unnest(array_cat(aliases,array['Javier Rojo Gómez','Javier Rojo Gomez'])) x), updated_at=now()
where place_key='puerto-morelos-casco-antiguo';

update public.marketplace_listings
set latitude=20.849835, longitude=-86.903341,
    location_text='Ek Balam 36, Puerto Morelos, Quintana Roo, México', updated_at=now()
where id='835a976f-ac76-4b09-b6a1-dcdc1df78f28';

update public.marketplace_listings
set location_text='Javier Rojo Gómez, Supermanzana 02, Manzana 13, Lote 04, Puerto Morelos, Quintana Roo, México, C.P. 77580', updated_at=now()
where id='5fe730e6-6a92-4bd4-8952-e6b042ad89be';
