do $$
begin
  if not exists (select 1 from cron.job where jobname='listia_conversion_signal_dispatch_v2') then
    perform cron.schedule(
      'listia_conversion_signal_dispatch_v2',
      '* * * * *',
      'select private.dispatch_conversion_signal_worker(25);'
    );
  end if;
end $$;
