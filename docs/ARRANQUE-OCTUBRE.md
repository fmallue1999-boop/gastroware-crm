# Arranque del modelo por puestos (1° de octubre 2026)

Checklist para pasar de "hoy no funciona" a "la empresa trabaja así desde
octubre". Los pasos marcados **(dirección)** los hace dirección en el CRM; los
marcados **(técnico)** se hacen con Claude Code y el OK de dirección.

## Estado al 27 de septiembre

Diagnóstico de producción (solo cantidades):

| Qué | Cuánto |
|---|---|
| Usuarios activos | 2 dirección, 3 comercial, 2 técnico (1 técnico inactivo) |
| Usuarios que parecen de prueba | 2 |
| Intereses abiertos | 305 (291 interesados, 10 en seguimiento, 3 cotizados, 1 en espera) |
| Intereses abiertos sin próximo contacto | 303 |
| Ventas en curso | 26 (quedan en el circuito nuevo: ver abajo) |
| Services abiertos | 37 (25 esperando revisión de administración) |
| Contactos | 5.607 (5.101 sin vendedor asignado) |

## 1. Base de datos **(técnico, con OK de dirección)**

1. Aplicar la migración **027** (consulta web con fecha y último movimiento
   real) y la **028** (puestos, territorios, facturas, casos, aliados,
   aprobaciones, informes, permisos).
2. Verificar: la 028 reacomoda las ventas en curso al circuito nuevo
   (para facturar → vendido; para entregar → a preparar; pendiente de pago →
   facturado; finalizado → entregado).
3. Publicar la rama `octubre` (merge a `main`: Vercel despliega solo).

## 2. Equipo y puestos **(dirección)**

Administración → Equipo:

1. Poner a cada usuario su **puesto**: dirección general, dirección de
   administración, administrativa, vendedor de territorio, técnico, marketing.
   (La administrativa hoy figura como dirección: cambiarla a "Administrativa y
   atención comercial".)
2. A cada vendedor, su **territorio** y su **teléfono**.
3. Territorios: elegir el **responsable** de "CABA y AMBA" y de "Mar del
   Plata, costa e interior" (si está vacante, dejar "Vacante": responde
   dirección general).
4. Desactivar los usuarios de prueba.
5. Crear los usuarios que falten (marketing, dirección de administración) con
   su puesto.

## 3. Reglas y datos base **(dirección / administración)**

- Administración → Reglas: días de atraso que frenan un despacho (30 por
  defecto), descuento que un vendedor puede dar sin consultar (0 %), plazo de
  pago a aliados, tarifa de service.
- Services → Aliados: cargar los técnicos aliados (zona, teléfono, tarifa).
- Administración → Repuestos: stock mínimo de los repuestos críticos.
- Marketing → Videos: el link del video instructivo de cada modelo.
- Catálogo: precios de lista al día (la aprobación fuera de lista compara
  contra ese precio).

## 4. Puesta a cero del trabajo abierto **(técnico, con OK de dirección)**

Se conservan contactos, historial, ventas en curso y services. Se propone:

- Cerrar los intereses **sin movimiento real en los últimos 30 días** con el
  motivo "Puesta a cero octubre 2026" (la lista de espera queda).
- A los que quedan abiertos sin fecha, próximo contacto el 1° de octubre.
- Los services viejos que esperan revisión: los controla dirección de
  administración con el circuito nuevo (aprobar para facturar o cerrar).

El script está en `supabase/scripts/puesta_a_cero_octubre.sql`: primero se
corre la vista previa (cuántos se cierran y cuántos quedan) y dirección
decide.

## 5. Primer día

- Cada uno entra y ve **Mi día** (o el Embudo si vende).
- Activar los avisos al celular: Más → Avisos al celular.
- Guía de uso por puesto: `docs/GUIA-POR-PUESTO.md`.
