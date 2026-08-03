# Matriz de permisos — GastroWare OS

> Implementación: políticas RLS en Postgres (capa que manda) + helpers `can()` en
> UI. Roles: direccion, admin, comercial, marketing, tecnico, distribuidor.
> "Propios" = registro asignado al usuario (comercial_id / tecnico_id) o sin dueño.
> "Su cartera" = registros con su distribuidor_id.

| Recurso | Dirección | Admin | Comercial | Marketing | Técnico | Distribuidor |
|---|---|---|---|---|---|---|
| usuarios | CRUD | CRUD (no dirección) | propio (leer/editar perfil) | propio | propio | propio |
| distribuidores | CRUD | CRUD | leer | leer | — | propio (leer) |
| clientes | CRUD | CRUD | CRUD propios | leer (sin notas comerciales) | leer vinculados a sus OTs | CRUD su cartera |
| sucursales/contactos | CRUD | CRUD | CRUD de sus clientes | leer | leer vinculados | CRUD su cartera |
| equipos | CRUD | CRUD | CRUD de sus clientes | leer | leer/editar asignados (vía OT) | CRUD su cartera |
| oportunidades | CRUD | CRUD | CRUD propias | leer agregados | — | CRUD su cartera |
| cotizaciones | CRUD | CRUD | CRUD de sus oportunidades | — | — | su cartera |
| ordenes_trabajo | CRUD | CRUD | leer de sus clientes; crear | leer agregados | CRUD asignadas; crear | su cartera |
| ot_items/tiempos/fotos | CRUD | CRUD + aprobar | leer | — | CRUD de sus OTs (hasta cierre técnico) | su cartera |
| aprobar facturación / nro factura | ✔ | ✔ | — | — | — | — |
| tareas | CRUD | CRUD | CRUD propias | CRUD propias | CRUD propias | su cartera |
| documentos | CRUD | CRUD | de sus clientes | leer marketing | de sus OTs/equipos | su cartera |
| plantillas/productos/modelos/repuestos (catálogos) | CRUD | CRUD | leer | leer | leer | leer |
| config/tarifas | CRUD | CRUD | — | — | — | — |
| reportes | todo | todo | propios | marketing | propios | su cartera |
| campañas/segmentos | CRUD | leer | leer | CRUD | — | — |
| notificaciones | propias | propias | propias | propias | propias | propias |
| aprobaciones | decidir | decidir | solicitar | solicitar | solicitar | solicitar |
| audit_log | leer | leer | — | — | — | — |
| export CSV | todo | todo | propios | marketing | — | su cartera |

## Reglas duras (en RLS, no negociables por UI)

1. Técnico NUNCA lee `oportunidades`, `cotizaciones` ni montos comerciales.
2. Distribuidor NUNCA ve registros de otra cartera (filtro por distribuidor_id en
   todas las tablas con esa columna).
3. `audit_log`: solo INSERT por trigger; SELECT solo dirección/admin; sin UPDATE/DELETE para nadie.
4. Cambios de estado de OT validados contra `ot_transiciones` + rol por trigger.
5. `usuarios.rol` solo lo modifica dirección (admin puede crear comercial/marketing/tecnico).
6. Soft delete: roles no administrativos nunca ven `deleted_at not null`.
7. Storage privado: acceso solo por URL firmada generada en el servidor tras chequeo de permisos sobre la entidad dueña del documento.

## Casos de prueba mínimos (automatizados en Etapa 1)

- Token de técnico: `GET oportunidades` → 0 filas; `GET ordenes_trabajo` → solo asignadas; `PATCH clientes` ajeno → rechazado.
- Token de comercial: `GET ordenes_trabajo` de cliente ajeno → 0 filas; `POST` aprobar facturación → rechazado.
- Token de distribuidor (cuando se active): todo filtrado por su cartera.
- Dirección: acceso total verificado.
