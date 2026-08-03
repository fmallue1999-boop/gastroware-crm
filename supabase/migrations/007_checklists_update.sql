-- 007: Etapa 2 — el técnico necesita ACTUALIZAR las respuestas del checklist
-- de su OT (la 004 solo dio select+insert a ot_checklists).

drop policy if exists ot_checklists_upd on ot_checklists;
create policy ot_checklists_upd on ot_checklists for update to authenticated
  using (fn_puede_ver_ot(ot_id))
  with check (fn_puede_ver_ot(ot_id));

-- Borrar fotos de equipo ya lo permite equipo_fotos_all (for all).
