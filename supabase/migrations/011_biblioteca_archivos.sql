-- 011: Biblioteca comercial con archivos propios
-- Bucket PÚBLICO a propósito: es material de marketing pensado para
-- compartirse con clientes (fichas, folletos, listas). El link no vence.
-- Lo sensible (cotizaciones, firmas, tickets) sigue en buckets privados.

insert into storage.buckets (id, name, public)
values ('biblioteca', 'biblioteca', true)
on conflict (id) do nothing;

drop policy if exists biblioteca_insert on storage.objects;
create policy biblioteca_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'biblioteca'
    and (fn_es_gestor() or fn_rol() = 'marketing')
  );

drop policy if exists biblioteca_delete on storage.objects;
create policy biblioteca_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'biblioteca'
    and (fn_es_gestor() or fn_rol() = 'marketing')
  );
