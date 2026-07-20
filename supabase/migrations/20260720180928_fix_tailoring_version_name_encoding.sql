do $migration$
declare
  v_definition text;
  v_bad_dash text := pg_catalog.chr(226) || pg_catalog.chr(8364) || pg_catalog.chr(8221);
  v_bad_separator text := pg_catalog.chr(194) || pg_catalog.chr(183);
begin
  select pg_catalog.pg_get_functiondef(
    'public.finalize_tailoring_generation(uuid,text,text,text,jsonb)'::regprocedure
  )
  into v_definition;

  v_definition := pg_catalog.replace(v_definition, v_bad_dash, '-');
  v_definition := pg_catalog.replace(v_definition, v_bad_separator, '-');
  execute v_definition;

  update public.resume_versions as version
  set name = pg_catalog.replace(
    pg_catalog.replace(version.name, v_bad_dash, '-'),
    v_bad_separator,
    '-'
  )
  where exists (
    select 1
    from public.tailoring_generation_reservations as reservation
    where reservation.resume_version_id = version.id
  );
end;
$migration$;
