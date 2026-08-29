create table if not exists private.marketplace_state_expansion_queue (
  state_code text primary key,
  state_name text not null unique,
  priority integer not null,
  status text not null default 'queued' check (status in ('queued','active','coverage_review','complete')),
  source_count integer not null default 0,
  published_count integer not null default 0,
  last_discovery_at timestamptz,
  last_ingest_at timestamptz,
  notes text,
  updated_at timestamptz not null default now()
);

insert into private.marketplace_state_expansion_queue(state_code,state_name,priority,status) values
('ROO','Quintana Roo',1,'active'),('YUC','Yucatán',2,'queued'),('CMX','Ciudad de México',3,'queued'),('MEX','Estado de México',4,'queued'),('NLE','Nuevo León',5,'queued'),('JAL','Jalisco',6,'queued'),('QUE','Querétaro',7,'queued'),('MOR','Morelos',8,'queued'),('PUE','Puebla',9,'queued'),('GUA','Guanajuato',10,'queued'),('BCN','Baja California',11,'queued'),('BCS','Baja California Sur',12,'queued'),('NAY','Nayarit',13,'queued'),('SIN','Sinaloa',14,'queued'),('VER','Veracruz',15,'queued'),('GRO','Guerrero',16,'queued'),('CHH','Chihuahua',17,'queued'),('COA','Coahuila',18,'queued'),('TAM','Tamaulipas',19,'queued'),('SLP','San Luis Potosí',20,'queued'),('SON','Sonora',21,'queued'),('HID','Hidalgo',22,'queued'),('AGS','Aguascalientes',23,'queued'),('MIC','Michoacán',24,'queued'),('OAX','Oaxaca',25,'queued'),('CHP','Chiapas',26,'queued'),('TAB','Tabasco',27,'queued'),('CAM','Campeche',28,'queued'),('COL','Colima',29,'queued'),('DUR','Durango',30,'queued'),('ZAC','Zacatecas',31,'queued'),('TLA','Tlaxcala',32,'queued')
on conflict(state_code) do update set state_name=excluded.state_name,priority=excluded.priority,updated_at=now();

revoke all on private.marketplace_state_expansion_queue from public, anon, authenticated;
