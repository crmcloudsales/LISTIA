-- LISTIA Marketplace only.
-- Add a verified zone reference for the SM12 / Maria Irene coastal tract in Puerto Morelos.
-- Reference derived from SEMARNAT's published UTM polygon centroid for predio Maria Irene.
insert into public.marketplace_qroo_places
(place_key,canonical_place,municipality,place_type,latitude,longitude,aliases,coordinate_source_url)
values
('puerto-morelos-sm12-maria-irene','SM12 María Irene','Puerto Morelos','zone',20.897147,-86.856835,
 array['Calle María Irene Supermanzana 12','Supermanzana 12 Manzana 18 Lote 05','SM12 María Irene','María Irene Supermanzana 12'],
 'https://dsiappsdev.semarnat.gob.mx/inai/F69/2018/143/3T/23MP00420918MIA.pdf')
on conflict(place_key) do update set
 canonical_place=excluded.canonical_place, municipality=excluded.municipality,
 place_type=excluded.place_type, latitude=excluded.latitude, longitude=excluded.longitude,
 aliases=excluded.aliases, coordinate_source_url=excluded.coordinate_source_url, updated_at=now();

update public.marketplace_listings
set location_text='Zona Federal Marítimo Terrestre, Calle María Irene Supermanzana 12 Manzana 18 Lote 05, Puerto Morelos, Quintana Roo, México, C.P. 77580', updated_at=now()
where id in ('386b3928-35ee-47ee-8453-d37d51102fec','59a1c413-360d-4fd2-8ca2-42854eaf0db4');
