-- LISTIA Marketplace only. Approximate zone reference, never exact property GPS.
insert into public.marketplace_qroo_places(place_key,canonical_place,municipality,place_type,latitude,longitude,aliases,coordinate_source_url)
values('tulum-hotel-zone-coba','Zona Hotelera / Avenida Cobá','Tulum','zone',20.201700,-87.433400,array['Zona Hotelera / Avenida Cobá','Zona Hotelera / Avenida Coba','Avenida Cobá, Zona Hotelera','Avenida Coba, Zona Hotelera'],'https://mrplayas.com/blog/tulum-map')
on conflict(place_key) do update set canonical_place=excluded.canonical_place,municipality=excluded.municipality,place_type=excluded.place_type,latitude=excluded.latitude,longitude=excluded.longitude,aliases=excluded.aliases,coordinate_source_url=excluded.coordinate_source_url,updated_at=now();
