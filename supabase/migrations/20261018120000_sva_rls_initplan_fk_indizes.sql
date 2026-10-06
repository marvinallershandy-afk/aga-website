-- ─────────────────────────────────────────────────────────────────────────────
-- v25-C4: Performance-Härtung aus den Supabase-Advisors (ohne Verhaltensänderung
-- für Fans). Zwei Teile:
--   1. auth_rls_initplan: SELECT-Policies, die auth.uid() PRO ZEILE auswerten, auf
--      (select auth.uid()) umstellen — der Planer wertet den Ausdruck dann EINMAL
--      aus (initplan) statt je Zeile. Gleiche Semantik, nur schneller bei großen
--      Ranglisten/Tipp-Mengen. Liste: audit-v25/technik/advisors_performance.json.
--      (sme_members gehört einer anderen App im selben Projekt — NICHT angefasst,
--       wie matches/match_events/match_current_score.)
--   2. unindexed_foreign_keys: fehlende Deck-Indizes für Fremdschlüssel in den
--      Live-/Wertungs-/Album-Pfaden (sva_ticker, sva_tipp_*, sva_album_*, sm_spiele).
--      Robust per DO-Block: liest die FK-Spalten aus pg_constraint, überspringt noch
--      nicht existierende Tabellen (z. B. das parallel entstehende Pack-System v24)
--      und FKs, die bereits ein deckendes Index haben. Idempotent.
--      matches/match_events/View match_current_score bleiben unberührt.
-- Reihenfolge: nach 20261018100000. PGlite-Test deckt die bestehenden Tipp-Tests ab.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. RLS-Policies: auth.uid() → (select auth.uid()) ───────────────────────
drop policy if exists sva_tipp_teilnehmer_select on public.sva_tipp_teilnehmer;
create policy sva_tipp_teilnehmer_select on public.sva_tipp_teilnehmer for select to authenticated
  using (user_id = (select auth.uid()) or public.is_sm_admin());

drop policy if exists sva_tipp_punkte_select on public.sva_tipp_punkte;
create policy sva_tipp_punkte_select on public.sva_tipp_punkte for select to authenticated
  using (user_id = (select auth.uid()) or public.is_sm_admin());

drop policy if exists sva_tipp_abzeichen_select on public.sva_tipp_abzeichen;
create policy sva_tipp_abzeichen_select on public.sva_tipp_abzeichen for select to authenticated
  using (user_id = (select auth.uid()) or public.is_sm_admin());

drop policy if exists sva_tipp_ligen_select on public.sva_tipp_ligen;
create policy sva_tipp_ligen_select on public.sva_tipp_ligen for select to authenticated
  using (public.is_sm_admin() or exists (select 1 from public.sva_tipp_liga_mitglieder m where m.liga_id = id and m.user_id = (select auth.uid())));

drop policy if exists sva_tipp_liga_mitglieder_select on public.sva_tipp_liga_mitglieder;
create policy sva_tipp_liga_mitglieder_select on public.sva_tipp_liga_mitglieder for select to authenticated
  using (user_id = (select auth.uid()) or public.is_sm_admin());

drop policy if exists sva_tipp_tipps_select on public.sva_tipp_tipps;
create policy sva_tipp_tipps_select on public.sva_tipp_tipps for select to authenticated
  using (user_id = (select auth.uid()) or not public.sva_tipp_offen(spiel_id));

drop policy if exists sva_tipp_elf_select on public.sva_tipp_elf;
create policy sva_tipp_elf_select on public.sva_tipp_elf for select to authenticated
  using (user_id = (select auth.uid()) or not public.sva_tipp_offen(spiel_id));

-- ── 2. Deck-Indizes für unindizierte Fremdschlüssel (nur unsere Pfade) ──────
do $$
declare
  c record;
  v_cols text;
  v_name text;
begin
  for c in
    select con.oid, con.conname, con.conrelid, con.conkey,
           con.conrelid::regclass::text as tbl
      from pg_constraint con
     where con.contype = 'f'
       and con.connamespace = 'public'::regnamespace
       and (
         con.conrelid::regclass::text in ('sva_ticker', 'sm_spiele')
         or con.conrelid::regclass::text like 'sva\_tipp\_%'
         or con.conrelid::regclass::text like 'sva\_album\_%'
       )
       -- noch kein deckendes Index (ein Index, dessen erste Spalte die erste
       -- FK-Spalte ist — deckt den FK-Lookup ab)
       and not exists (
         select 1 from pg_index i
          where i.indrelid = con.conrelid
            and i.indkey[0] = con.conkey[1]
       )
  loop
    select string_agg(quote_ident(a.attname), ', ' order by k.ord),
           string_agg(a.attname, '_' order by k.ord)
      into v_cols, v_name
      from unnest(c.conkey) with ordinality k(attnum, ord)
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum;
    execute format('create index if not exists %I on public.%I (%s)',
                   'idx_' || c.tbl || '_' || v_name, c.tbl, v_cols);
  end loop;
end $$;
