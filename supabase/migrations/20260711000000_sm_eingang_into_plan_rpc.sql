-- Transaktionale Übernahme einer Team-Idee in den Redaktionsplan.
-- Ersetzt die zweistufige Client-Logik (createContent + updateEingang), die
-- bei einem Fehler im zweiten Schritt verwaisten Content hinterlassen konnte.
create or replace function public.sm_eingang_into_plan(
  p_eingang_id uuid,
  p_geplant_am date default null
)
returns public.sm_content
language plpgsql security invoker
set search_path to 'public'
as $$
declare
  v_eingang public.sm_ideen_eingang;
  v_content public.sm_content;
begin
  select * into v_eingang from public.sm_ideen_eingang where id = p_eingang_id for update;
  if not found then
    raise exception 'Eingang % nicht gefunden', p_eingang_id;
  end if;

  insert into public.sm_content (titel, beschreibung, kanal, status, geplant_am)
  values (v_eingang.titel, v_eingang.beschreibung, v_eingang.kanal, 'idee', p_geplant_am)
  returning * into v_content;

  update public.sm_ideen_eingang
  set status = 'uebernommen', content_id = v_content.id, updated_at = now()
  where id = p_eingang_id;

  return v_content;
end;
$$;
